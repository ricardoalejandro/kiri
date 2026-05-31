package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/naperu/kiri/internal/domain"
	"golang.org/x/crypto/bcrypt"
)

type RegisterAccountInput struct {
	AccountName       string
	DisplayName       string
	Email             string
	Password          string
	PlanCode          string
	SecurityVerified  bool
	IPHash            string
	FingerprintHash   string
	UserAgentHash     string
	TurnstileSuccess  bool
	TurnstileHostname string
	TurnstileAction   string
	Referrer          string
	UTMSource         string
	UTMMedium         string
	UTMCampaign       string
	RiskScore         int
	RiskReasons       []string
}

type RegisterAccountResult struct {
	Account         *domain.Account
	User            *domain.User
	Subscription    *domain.Subscription
	SignupRequestID uuid.UUID
}

var signupSlugPattern = regexp.MustCompile(`[^a-z0-9]+`)

const publicSignupStorageLimitBytes int64 = 100 * 1024 * 1024

func (s *AuthService) RegisterAccount(ctx context.Context, input RegisterAccountInput) (*RegisterAccountResult, error) {
	if !input.SecurityVerified {
		return nil, fmt.Errorf("verificación de seguridad requerida")
	}

	accountName := strings.TrimSpace(input.AccountName)
	displayName := strings.TrimSpace(input.DisplayName)
	email := strings.ToLower(strings.TrimSpace(input.Email))

	if accountName == "" {
		return nil, fmt.Errorf("el nombre de la empresa es obligatorio")
	}
	if displayName == "" {
		displayName = accountName
	}
	if email == "" || !strings.Contains(email, "@") {
		return nil, fmt.Errorf("ingresa un correo válido")
	}
	if len(input.Password) < 8 {
		return nil, fmt.Errorf("la contraseña debe tener al menos 8 caracteres")
	}

	plan, err := s.repos.Subscription.GetPlan(ctx, "free")
	if err != nil {
		return nil, err
	}
	if plan == nil {
		return nil, fmt.Errorf("plan gratuito no disponible para registro automático")
	}
	publicSignupRole, err := s.repos.Role.GetPublicSignupDefault(ctx)
	if err != nil {
		return nil, err
	}
	var publicSignupRoleID *uuid.UUID
	if publicSignupRole != nil {
		publicSignupRoleID = &publicSignupRole.ID
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(input.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	riskReasonsJSON, err := json.Marshal(input.RiskReasons)
	if err != nil {
		riskReasonsJSON = []byte("[]")
	}
	now := time.Now()
	maxUsersOverride := 1
	signupRequestID := uuid.New()
	account := &domain.Account{
		ID:                uuid.New(),
		CompanyName:       accountName,
		Plan:              plan.Code,
		MaxDevices:        5,
		MaxUsersOverride:  &maxUsersOverride,
		StorageLimitBytes: publicSignupStorageLimitBytes,
		IsActive:          true,
		CreationSource:    domain.AccountCreationSourcePublicWeb,
		ReviewStatus:      domain.AccountReviewStatusPending,
		SignupRequestID:   &signupRequestID,
		SignupRiskScore:   input.RiskScore,
		SignupRiskReasons: json.RawMessage(riskReasonsJSON),
	}
	user := &domain.User{
		ID:             uuid.New(),
		AccountID:      account.ID,
		Username:       email,
		Email:          email,
		PasswordHash:   string(passwordHash),
		DisplayName:    displayName,
		Role:           domain.RoleAgent,
		IsAdmin:        false,
		IsSuperAdmin:   false,
		IsActive:       true,
		CreationSource: domain.AccountCreationSourcePublicWeb,
		EmailVerified:  false,
	}
	subscriptionMetadata, _ := json.Marshal(map[string]any{
		"source":            "public_signup",
		"review_status":     domain.AccountReviewStatusPending,
		"limits":            "free_public",
		"signup_request_id": signupRequestID.String(),
		"risk_score":        input.RiskScore,
	})
	subscription := &domain.Subscription{
		ID:                 uuid.New(),
		AccountID:          account.ID,
		PlanCode:           plan.Code,
		Status:             domain.SubscriptionStatusActive,
		CurrentPeriodStart: &now,
		Metadata:           json.RawMessage(subscriptionMetadata),
	}

	databaseTx, err := s.repos.DB().Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer databaseTx.Rollback(ctx)

	if err := databaseTx.QueryRow(ctx, `SELECT 'KIR-' || LPAD(nextval('account_code_seq')::text, 6, '0')`).Scan(&account.AccountCode); err != nil {
		return nil, err
	}
	account.Name = account.AccountCode
	account.Slug = signupSlug(account.AccountCode)

	err = databaseTx.QueryRow(ctx, `
		INSERT INTO accounts (id, account_code, name, company_name, slug, plan, max_devices, max_users_override, storage_limit_bytes, is_active, creation_source, review_status, signup_request_id, signup_risk_score, signup_risk_reasons)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10, $11, $12, $13, $14::jsonb)
		RETURNING created_at, updated_at
	`, account.ID, account.AccountCode, account.Name, account.CompanyName, account.Slug, account.Plan, account.MaxDevices, maxUsersOverride, account.StorageLimitBytes,
		account.CreationSource, account.ReviewStatus, signupRequestID, account.SignupRiskScore, string(account.SignupRiskReasons)).Scan(&account.CreatedAt, &account.UpdatedAt)
	if err != nil {
		return nil, registrationError(err)
	}

	err = databaseTx.QueryRow(ctx, `
		INSERT INTO users (id, account_id, username, email, password_hash, display_name, is_admin, is_super_admin, role, is_active, creation_source, email_verified)
		VALUES ($1, $2, $3, $4, $5, $6, FALSE, FALSE, $7, TRUE, $8, FALSE)
		RETURNING created_at, updated_at
	`, user.ID, user.AccountID, user.Username, user.Email, user.PasswordHash, user.DisplayName, user.Role, user.CreationSource).Scan(&user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, registrationError(err)
	}

	_, err = databaseTx.Exec(ctx, `
		INSERT INTO user_accounts (user_id, account_id, role, role_id, is_default)
		VALUES ($1, $2, $3, $4, TRUE)
	`, user.ID, account.ID, domain.RoleAgent, publicSignupRoleID)
	if err != nil {
		return nil, registrationError(err)
	}

	err = databaseTx.QueryRow(ctx, `
		INSERT INTO account_signup_requests (
			id, account_id, user_id, email, email_domain, company_name, contact_name,
			ip_hash, fingerprint_hash, user_agent_hash,
			turnstile_success, turnstile_hostname, turnstile_action,
			referrer, utm_source, utm_medium, utm_campaign,
			risk_score, risk_reasons, status, metadata
		)
		VALUES (
			$1, $2, $3, $4, $5, $6, $7,
			$8, $9, $10,
			$11, $12, $13,
			$14, $15, $16, $17,
			$18, $19::jsonb, $20, $21::jsonb
		)
		RETURNING created_at
	`, signupRequestID, account.ID, user.ID, email, emailDomain(email), accountName, displayName,
		input.IPHash, input.FingerprintHash, input.UserAgentHash,
		input.TurnstileSuccess, input.TurnstileHostname, input.TurnstileAction,
		input.Referrer, input.UTMSource, input.UTMMedium, input.UTMCampaign,
		input.RiskScore, string(riskReasonsJSON), domain.AccountReviewStatusPending,
		`{"source":"public_signup"}`).Scan(&account.SignupCreatedAt)
	if err != nil {
		return nil, registrationError(err)
	}

	err = databaseTx.QueryRow(ctx, `
		INSERT INTO subscriptions (id, account_id, plan_code, status, trial_started_at, trial_ends_at, current_period_start, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
		RETURNING created_at, updated_at
	`, subscription.ID, subscription.AccountID, subscription.PlanCode, subscription.Status, subscription.TrialStartedAt,
		subscription.TrialEndsAt, subscription.CurrentPeriodStart, string(subscription.Metadata)).Scan(&subscription.CreatedAt, &subscription.UpdatedAt)
	if err != nil {
		return nil, registrationError(err)
	}

	if err := databaseTx.Commit(ctx); err != nil {
		return nil, err
	}

	user.AccountName = account.Name
	user.AccountCode = account.AccountCode
	user.AccountCompanyName = account.CompanyName
	user.AccountCreationSource = account.CreationSource
	user.AccountReviewStatus = account.ReviewStatus
	account.SignupEmail = email
	account.SignupEmailDomain = emailDomain(email)
	account.SignupContactName = displayName
	account.SignupIPHash = input.IPHash
	account.SignupFingerprintHash = input.FingerprintHash
	account.SignupUserAgentHash = input.UserAgentHash
	account.SignupTurnstileSuccess = input.TurnstileSuccess
	account.SignupReferrer = input.Referrer
	account.SignupUTMSource = input.UTMSource
	account.SignupUTMMedium = input.UTMMedium
	account.SignupUTMCampaign = input.UTMCampaign
	return &RegisterAccountResult{Account: account, User: user, Subscription: subscription, SignupRequestID: signupRequestID}, nil
}

func isSelfServicePlan(planCode string) bool {
	switch planCode {
	case "trial", "starter", "pro", "business":
		return true
	default:
		return false
	}
}

func signupSlug(value string) string {
	slug := strings.ToLower(strings.TrimSpace(value))
	slug = signupSlugPattern.ReplaceAllString(slug, "-")
	slug = strings.Trim(slug, "-")
	if slug == "" {
		return "cuenta"
	}
	if len(slug) > 60 {
		slug = strings.Trim(slug[:60], "-")
	}
	return slug
}

func emailDomain(email string) string {
	parts := strings.Split(strings.ToLower(strings.TrimSpace(email)), "@")
	if len(parts) != 2 {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func signupPlanInt(plan *domain.Plan, key string, fallback int) int {
	if plan == nil || plan.Entitlements == nil {
		return fallback
	}
	value, ok := plan.Entitlements[key]
	if !ok {
		return fallback
	}
	var number int
	if err := json.Unmarshal(value, &number); err == nil && number > 0 {
		return number
	}
	return fallback
}

func registrationError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && pgErr.Code == "23505" {
		constraint := strings.ToLower(pgErr.ConstraintName)
		if strings.Contains(constraint, "username") || strings.Contains(constraint, "email") {
			return fmt.Errorf("ya existe un usuario con ese correo")
		}
		return fmt.Errorf("ya existe un registro con esos datos")
	}
	return err
}
