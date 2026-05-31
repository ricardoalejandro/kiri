package api

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/naperu/kiri/internal/service"
)

type registerRequest struct {
	AccountName     string `json:"account_name"`
	DisplayName     string `json:"display_name"`
	Email           string `json:"email"`
	Password        string `json:"password"`
	PasswordConfirm string `json:"password_confirm"`
	PlanCode        string `json:"plan_code"`
	TurnstileToken  string `json:"turnstile_token"`
	Website         string `json:"website"`
	FormStartedAt   int64  `json:"form_started_at"`
	Referrer        string `json:"referrer"`
	UTMSource       string `json:"utm_source"`
	UTMMedium       string `json:"utm_medium"`
	UTMCampaign     string `json:"utm_campaign"`
}

func (s *Server) handleRegister(c *fiber.Ctx) error {
	var req registerRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "Invalid request"})
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if req.Password != req.PasswordConfirm {
		return c.Status(fiber.StatusBadRequest).JSON(fiber.Map{"success": false, "error": "Las contraseñas no coinciden"})
	}

	securityContext, err := s.validateSignupAbuseControls(c, email, req.TurnstileToken, req.Website, req.FormStartedAt)
	if err != nil {
		return err
	}
	referrer := trimmedLimit(req.Referrer, 1000)
	if referrer == "" {
		referrer = trimmedLimit(c.Get("Referer"), 1000)
	}
	s.recordSecurityEvent(c.Context(), "signup_submitted", email, c, map[string]interface{}{
		"email_domain":      emailDomain(email),
		"ip_hash":           securityContext.IPHash,
		"fingerprint_hash":  securityContext.FingerprintHash,
		"risk_score":        securityContext.RiskScore,
		"risk_reasons":      securityContext.RiskReasons,
		"turnstile_success": securityContext.TurnstileSuccess,
	})

	result, err := s.services.Auth.RegisterAccount(c.Context(), service.RegisterAccountInput{
		AccountName:       req.AccountName,
		DisplayName:       req.DisplayName,
		Email:             email,
		Password:          req.Password,
		PlanCode:          req.PlanCode,
		SecurityVerified:  true,
		IPHash:            securityContext.IPHash,
		FingerprintHash:   securityContext.FingerprintHash,
		UserAgentHash:     securityContext.UserAgentHash,
		TurnstileSuccess:  securityContext.TurnstileSuccess,
		TurnstileHostname: securityContext.TurnstileHostname,
		TurnstileAction:   securityContext.TurnstileAction,
		Referrer:          referrer,
		UTMSource:         trimmedLimit(req.UTMSource, 255),
		UTMMedium:         trimmedLimit(req.UTMMedium, 255),
		UTMCampaign:       trimmedLimit(req.UTMCampaign, 255),
		RiskScore:         securityContext.RiskScore,
		RiskReasons:       securityContext.RiskReasons,
	})
	if err != nil {
		status := fiber.StatusBadRequest
		if strings.Contains(err.Error(), "ya existe") {
			status = fiber.StatusConflict
		}
		return c.Status(status).JSON(fiber.Map{"success": false, "error": err.Error()})
	}
	s.recordSecurityEventWithRefs(c.Context(), "signup_created", email, c, &result.Account.ID, &result.User.ID, &result.SignupRequestID, map[string]interface{}{
		"account_code":      result.Account.AccountCode,
		"company_name":      result.Account.CompanyName,
		"review_status":     result.Account.ReviewStatus,
		"risk_score":        securityContext.RiskScore,
		"risk_reasons":      securityContext.RiskReasons,
		"turnstile_success": securityContext.TurnstileSuccess,
	})

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success":        true,
		"account":        result.Account,
		"subscription":   result.Subscription,
		"requires_login": false,
		"pending_review": true,
		"message":        "Tu cuenta fue recibida y está pendiente de aprobación.",
	})
}

func trimmedLimit(value string, max int) string {
	value = strings.TrimSpace(value)
	if max > 0 && len(value) > max {
		return value[:max]
	}
	return value
}

func (s *Server) setAuthCookies(c *fiber.Ctx, token string, refreshToken string) {
	c.Cookie(&fiber.Cookie{
		Name:     "auth-token",
		Value:    token,
		Expires:  time.Now().Add(1 * time.Hour),
		HTTPOnly: true,
		Secure:   s.cfg.IsProduction(),
		SameSite: "Lax",
		Path:     "/",
	})
	c.Cookie(&fiber.Cookie{
		Name:     "refresh-token",
		Value:    refreshToken,
		Expires:  time.Now().Add(7 * 24 * time.Hour),
		HTTPOnly: true,
		Secure:   s.cfg.IsProduction(),
		SameSite: "Strict",
		Path:     "/api/auth",
	})
}
