package api

import (
	"context"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/naperu/kiri/internal/domain"
	"github.com/naperu/kiri/internal/service"
)

func (s *Server) subscriptionAccessMiddleware(c *fiber.Ctx) error {
	claims, ok := c.Locals("claims").(*service.JWTClaims)
	if ok && claims.IsSuperAdmin {
		return c.Next()
	}
	accountID, ok := c.Locals("account_id").(uuid.UUID)
	if !ok {
		return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
	}
	decision, err := s.services.Subscription.CheckAccess(c.Context(), accountID)
	if err != nil {
		return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "No se pudo validar la suscripción"})
	}
	if decision != nil && decision.Overview != nil {
		c.Locals("subscription", decision.Overview)
	}
	if decision != nil && !decision.Allowed {
		return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
			"success":      false,
			"error":        decision.Message,
			"code":         "subscription_required",
			"reason":       decision.Reason,
			"subscription": decision.Overview,
		})
	}
	return c.Next()
}

func countNonEmptyCSVRows(lines []string) int {
	if len(lines) <= 1 {
		return 0
	}
	count := 0
	for _, line := range lines[1:] {
		if strings.TrimSpace(line) != "" {
			count++
		}
	}
	return count
}

func (s *Server) requirePlanFeature(featureKey string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		claims, ok := c.Locals("claims").(*service.JWTClaims)
		if ok && claims.IsSuperAdmin {
			return c.Next()
		}
		accountID, ok := c.Locals("account_id").(uuid.UUID)
		if !ok {
			return c.Status(fiber.StatusUnauthorized).JSON(fiber.Map{"success": false, "error": "Unauthorized"})
		}
		allowed, err := s.services.Subscription.HasFeature(c.Context(), accountID, featureKey)
		if err != nil {
			return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{"success": false, "error": "No se pudo validar el plan"})
		}
		if !allowed {
			return c.Status(fiber.StatusPaymentRequired).JSON(fiber.Map{
				"success": false,
				"error":   "Tu plan actual no incluye esta función",
				"code":    "plan_feature_required",
				"feature": featureKey,
			})
		}
		return c.Next()
	}
}

func (s *Server) enforcePlanLimit(ctx context.Context, accountID uuid.UUID, entitlementKey string, increment int) error {
	if entitlementKey == "max_users" {
		account, err := s.services.Account.GetByID(ctx, accountID)
		if err == nil && account != nil && account.MaxUsersOverride != nil {
			current := account.UserCount
			limit := *account.MaxUsersOverride
			if limit > 0 && current+increment > limit {
				return fmt.Errorf("límite del plan alcanzado para %s (%d/%d)", entitlementKey, current, limit)
			}
			return nil
		}
	}
	return s.services.Subscription.EnforceLimit(ctx, accountID, entitlementKey, increment)
}

func (s *Server) enforceSignupReviewCostlyAction(ctx context.Context, accountID uuid.UUID) error {
	account, err := s.services.Account.GetByID(ctx, accountID)
	if err != nil || account == nil {
		return err
	}
	if account.CreationSource != domain.AccountCreationSourcePublicWeb {
		return nil
	}
	switch account.ReviewStatus {
	case domain.AccountReviewStatusRejected, domain.AccountReviewStatusSuspended:
		return fmt.Errorf("la cuenta no está habilitada para esta acción")
	case domain.AccountReviewStatusPending:
		if account.SignupRiskScore >= 60 {
			return fmt.Errorf("la cuenta está en revisión antes de habilitar acciones de mayor costo")
		}
	}
	return nil
}

func subscriptionBlocked(status string, isActive bool) bool {
	if isActive {
		return false
	}
	switch status {
	case domain.SubscriptionStatusPastDue,
		domain.SubscriptionStatusSuspended,
		domain.SubscriptionStatusCanceled,
		domain.SubscriptionStatusIncomplete,
		domain.SubscriptionStatusTrialing,
		domain.SubscriptionStatusActive,
		domain.SubscriptionStatusGrace:
		return true
	default:
		return status != ""
	}
}
