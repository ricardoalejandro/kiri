package api

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const (
	turnstileSiteVerifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
	minSignupFormAge       = 2500 * time.Millisecond
	maxSignupFormAge       = 2 * time.Hour
)

type abuseLimit struct {
	Key    string
	Max    int64
	Window time.Duration
}

type inMemoryAbuseLimiter struct {
	mu      sync.Mutex
	buckets map[string]inMemoryAbuseBucket
}

type inMemoryAbuseBucket struct {
	Count     int64
	ExpiresAt time.Time
}

type turnstileVerifyResponse struct {
	Success    bool     `json:"success"`
	ErrorCodes []string `json:"error-codes"`
	Hostname   string   `json:"hostname"`
	Action     string   `json:"action"`
}

type signupSecurityContext struct {
	IPHash            string
	FingerprintHash   string
	UserAgentHash     string
	TurnstileSuccess  bool
	TurnstileHostname string
	TurnstileAction   string
	RiskScore         int
	RiskReasons       []string
}

func newInMemoryAbuseLimiter() *inMemoryAbuseLimiter {
	return &inMemoryAbuseLimiter{buckets: make(map[string]inMemoryAbuseBucket)}
}

func (s *Server) handlePublicSignupConfig(c *fiber.Ctx) error {
	siteKey := strings.TrimSpace(s.cfg.TurnstileSiteKey)
	return c.JSON(fiber.Map{
		"success":              true,
		"signup_enabled":       siteKey != "" && strings.TrimSpace(s.cfg.TurnstileSecretKey) != "",
		"login_enabled":        siteKey != "" && strings.TrimSpace(s.cfg.TurnstileSecretKey) != "",
		"turnstile_site_key":   siteKey,
		"turnstile_required":   true,
		"has_turnstile_secret": strings.TrimSpace(s.cfg.TurnstileSecretKey) != "",
	})
}

func (l *inMemoryAbuseLimiter) incr(key string, window time.Duration) int64 {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()

	bucket := l.buckets[key]
	if bucket.ExpiresAt.IsZero() || now.After(bucket.ExpiresAt) {
		bucket = inMemoryAbuseBucket{ExpiresAt: now.Add(window)}
	}
	bucket.Count++
	l.buckets[key] = bucket

	if len(l.buckets) > 2000 {
		for k, b := range l.buckets {
			if now.After(b.ExpiresAt) {
				delete(l.buckets, k)
			}
		}
	}
	return bucket.Count
}

func (s *Server) validateSignupAbuseControls(c *fiber.Ctx, email, turnstileToken, website string, formStartedAt int64) (*signupSecurityContext, error) {
	if strings.TrimSpace(website) != "" {
		s.recordSecurityEvent(c.Context(), "signup_honeypot", email, c, map[string]interface{}{"reason": "honeypot_filled"})
		return nil, fiber.NewError(fiber.StatusBadRequest, "No se pudo completar el registro")
	}

	if err := s.validateSignupTiming(c, email, formStartedAt); err != nil {
		return nil, err
	}
	if s.isBlockedSignupDomain(email) {
		s.recordSecurityEvent(c.Context(), "signup_blocked_email_domain", email, c, map[string]interface{}{"domain": emailDomain(email)})
		return nil, fiber.NewError(fiber.StatusBadRequest, "Usa un correo corporativo o permanente para crear la cuenta")
	}
	if err := s.checkSignupAbuseLimit(c, email); err != nil {
		return nil, err
	}
	turnstileResult, err := s.validateTurnstile(c, email, turnstileToken)
	if err != nil {
		return nil, err
	}
	return s.buildSignupSecurityContext(c, email, turnstileResult), nil
}

func (s *Server) validateSignupTiming(c *fiber.Ctx, email string, formStartedAt int64) error {
	if formStartedAt <= 0 {
		s.recordSecurityEvent(c.Context(), "signup_timing_missing", email, c, map[string]interface{}{"reason": "missing_form_started_at"})
		return fiber.NewError(fiber.StatusBadRequest, "Actualiza la página e intenta nuevamente")
	}
	started := time.UnixMilli(formStartedAt)
	age := time.Since(started)
	if age < minSignupFormAge || age > maxSignupFormAge {
		s.recordSecurityEvent(c.Context(), "signup_timing_rejected", email, c, map[string]interface{}{
			"age_ms": age.Milliseconds(),
		})
		return fiber.NewError(fiber.StatusBadRequest, "Actualiza la página e intenta nuevamente")
	}
	return nil
}

func (s *Server) checkSignupAbuseLimit(c *fiber.Ctx, email string) error {
	ipKey := hashForLog(clientIP(c))
	emailKey := hashForLog(email)
	fingerprintKey := hashForLog(clientFingerprint(c))
	limits := []abuseLimit{
		{Key: "abuse:signup:ip:minute:" + ipKey, Max: 2, Window: time.Minute},
		{Key: "abuse:signup:ip:hour:" + ipKey, Max: 5, Window: time.Hour},
		{Key: "abuse:signup:ip:day:" + ipKey, Max: 12, Window: 24 * time.Hour},
		{Key: "abuse:signup:email:day:" + emailKey, Max: 2, Window: 24 * time.Hour},
		{Key: "abuse:signup:fp:hour:" + fingerprintKey, Max: 4, Window: time.Hour},
	}
	return s.checkAbuseLimits(c, "signup_rate_limited", email, limits)
}

func (s *Server) checkLoginAbuseLimit(c *fiber.Ctx, username string) error {
	if username == "" {
		username = "unknown"
	}
	ipKey := hashForLog(clientIP(c))
	emailKey := hashForLog(username)
	fingerprintKey := hashForLog(clientFingerprint(c))
	limits := []abuseLimit{
		{Key: "abuse:login:ip:minute:" + ipKey, Max: 15, Window: time.Minute},
		{Key: "abuse:login:ip:hour:" + ipKey, Max: 120, Window: time.Hour},
		{Key: "abuse:login:email:minute:" + emailKey, Max: 8, Window: time.Minute},
		{Key: "abuse:login:email:hour:" + emailKey, Max: 40, Window: time.Hour},
		{Key: "abuse:login:fp:minute:" + fingerprintKey, Max: 20, Window: time.Minute},
	}
	return s.checkAbuseLimits(c, "login_rate_limited", username, limits)
}

func (s *Server) checkAbuseLimits(c *fiber.Ctx, eventType, subject string, limits []abuseLimit) error {
	for _, limit := range limits {
		count, err := s.incrementAbuseCounter(c.Context(), limit.Key, limit.Window)
		if err != nil {
			log.Printf("[SECURITY] abuse limiter fallback error: %v", err)
			count = s.abuseLimiter.incr(limit.Key, limit.Window)
		}
		if count > limit.Max {
			s.recordSecurityEvent(c.Context(), eventType, subject, c, map[string]interface{}{
				"key":    limit.Key,
				"count":  count,
				"limit":  limit.Max,
				"window": limit.Window.String(),
			})
			return fiber.NewError(fiber.StatusTooManyRequests, "Demasiados intentos. Intenta nuevamente más tarde.")
		}
	}
	return nil
}

func (s *Server) incrementAbuseCounter(ctx context.Context, key string, ttl time.Duration) (int64, error) {
	if s.cache == nil {
		return s.abuseLimiter.incr(key, ttl), nil
	}
	return s.cache.IncrWithTTL(ctx, key, ttl)
}

func (s *Server) validateTurnstile(c *fiber.Ctx, email, token string) (*turnstileVerifyResponse, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		s.recordSecurityEvent(c.Context(), "turnstile_missing", email, c, nil)
		return nil, fiber.NewError(fiber.StatusBadRequest, "Completa la verificación de seguridad")
	}
	if len(token) > 2048 {
		s.recordSecurityEvent(c.Context(), "turnstile_token_too_long", email, c, map[string]interface{}{"length": len(token)})
		return nil, fiber.NewError(fiber.StatusBadRequest, "Verificación inválida")
	}
	if strings.TrimSpace(s.cfg.TurnstileSecretKey) == "" {
		s.recordSecurityEvent(c.Context(), "turnstile_not_configured", email, c, nil)
		return nil, fiber.NewError(fiber.StatusServiceUnavailable, "Registro temporalmente no disponible")
	}

	body, _ := json.Marshal(map[string]string{
		"secret":          s.cfg.TurnstileSecretKey,
		"response":        token,
		"remoteip":        clientIP(c),
		"idempotency_key": uuid.NewString(),
	})
	req, err := http.NewRequestWithContext(c.Context(), http.MethodPost, turnstileSiteVerifyURL, bytes.NewReader(body))
	if err != nil {
		return nil, fiber.NewError(fiber.StatusServiceUnavailable, "No se pudo validar la verificación")
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 8 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		s.recordSecurityEvent(c.Context(), "turnstile_request_failed", email, c, map[string]interface{}{"error": err.Error()})
		return nil, fiber.NewError(fiber.StatusServiceUnavailable, "No se pudo validar la verificación")
	}
	defer resp.Body.Close()

	var result turnstileVerifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		s.recordSecurityEvent(c.Context(), "turnstile_decode_failed", email, c, map[string]interface{}{"status": resp.StatusCode})
		return nil, fiber.NewError(fiber.StatusServiceUnavailable, "No se pudo validar la verificación")
	}
	if !result.Success {
		s.recordSecurityEvent(c.Context(), "turnstile_rejected", email, c, map[string]interface{}{
			"status":      resp.StatusCode,
			"error_codes": result.ErrorCodes,
			"hostname":    result.Hostname,
			"action":      result.Action,
		})
		return nil, fiber.NewError(fiber.StatusBadRequest, "Verificación de seguridad inválida. Intenta nuevamente.")
	}
	return &result, nil
}

func (s *Server) buildSignupSecurityContext(c *fiber.Ctx, email string, turnstileResult *turnstileVerifyResponse) *signupSecurityContext {
	ctx := &signupSecurityContext{
		IPHash:          hashForLog(clientIP(c)),
		FingerprintHash: hashForLog(clientFingerprint(c)),
		UserAgentHash:   hashForLog(c.Get("User-Agent")),
		RiskReasons:     []string{},
	}
	if turnstileResult != nil {
		ctx.TurnstileSuccess = turnstileResult.Success
		ctx.TurnstileHostname = turnstileResult.Hostname
		ctx.TurnstileAction = turnstileResult.Action
	}

	var ipCount, fingerprintCount int
	if err := s.repos.DB().QueryRow(c.Context(), `
		SELECT COUNT(*) FROM account_signup_requests
		WHERE ip_hash = $1 AND created_at > NOW() - INTERVAL '24 hours'
	`, ctx.IPHash).Scan(&ipCount); err != nil {
		log.Printf("[SECURITY] signup ip risk count failed: %v", err)
	}
	if err := s.repos.DB().QueryRow(c.Context(), `
		SELECT COUNT(*) FROM account_signup_requests
		WHERE fingerprint_hash = $1 AND created_at > NOW() - INTERVAL '24 hours'
	`, ctx.FingerprintHash).Scan(&fingerprintCount); err != nil {
		log.Printf("[SECURITY] signup fingerprint risk count failed: %v", err)
	}
	if ipCount >= 2 {
		ctx.RiskScore += 30
		ctx.RiskReasons = append(ctx.RiskReasons, fmt.Sprintf("ip_velocity_%d_24h", ipCount+1))
	}
	if fingerprintCount >= 2 {
		ctx.RiskScore += 35
		ctx.RiskReasons = append(ctx.RiskReasons, fmt.Sprintf("fingerprint_velocity_%d_24h", fingerprintCount+1))
	}
	localPart := strings.Split(strings.ToLower(strings.TrimSpace(email)), "@")[0]
	if len(localPart) >= 16 {
		digits := 0
		for _, ch := range localPart {
			if ch >= '0' && ch <= '9' {
				digits++
			}
		}
		if digits >= 6 {
			ctx.RiskScore += 15
			ctx.RiskReasons = append(ctx.RiskReasons, "high_entropy_email_local_part")
		}
	}
	if ctx.RiskScore > 100 {
		ctx.RiskScore = 100
	}
	return ctx
}

func (s *Server) isBlockedSignupDomain(email string) bool {
	domain := emailDomain(email)
	if domain == "" {
		return false
	}
	for _, blocked := range s.cfg.BlockedSignupEmailDomains {
		if domain == blocked || strings.HasSuffix(domain, "."+blocked) {
			return true
		}
	}
	return false
}

func (s *Server) recordSecurityEvent(ctx context.Context, eventType, subject string, c *fiber.Ctx, metadata map[string]interface{}) {
	s.recordSecurityEventWithRefs(ctx, eventType, subject, c, nil, nil, nil, metadata)
}

func (s *Server) recordSecurityEventWithRefs(ctx context.Context, eventType, subject string, c *fiber.Ctx, accountID, userID, signupRequestID *uuid.UUID, metadata map[string]interface{}) {
	if metadata == nil {
		metadata = map[string]interface{}{}
	}
	metadata["path"] = c.Path()
	raw, _ := json.Marshal(metadata)
	if _, err := s.repos.DB().Exec(ctx, `
		INSERT INTO security_events (type, account_id, user_id, signup_request_id, subject_hash, ip_hash, user_agent_hash, metadata)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
	`, eventType, accountID, userID, signupRequestID, hashForLog(subject), hashForLog(clientIP(c)), hashForLog(c.Get("User-Agent")), string(raw)); err != nil {
		log.Printf("[SECURITY] failed to record event %s: %v", eventType, err)
	}
}

func clientIP(c *fiber.Ctx) string {
	for _, header := range []string{"CF-Connecting-IP", "X-Real-IP"} {
		if ip := strings.TrimSpace(c.Get(header)); ip != "" {
			return ip
		}
	}
	if forwarded := strings.TrimSpace(c.Get("X-Forwarded-For")); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		if len(parts) > 0 && strings.TrimSpace(parts[0]) != "" {
			return strings.TrimSpace(parts[0])
		}
	}
	if ip := strings.TrimSpace(c.IP()); ip != "" {
		if host, _, err := net.SplitHostPort(ip); err == nil {
			return host
		}
		return ip
	}
	return "unknown"
}

func clientFingerprint(c *fiber.Ctx) string {
	return strings.Join([]string{
		clientIP(c),
		c.Get("User-Agent"),
		c.Get("Accept-Language"),
		c.Get("Sec-CH-UA-Platform"),
	}, "|")
}

func emailDomain(email string) string {
	parts := strings.Split(strings.ToLower(strings.TrimSpace(email)), "@")
	if len(parts) != 2 {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func hashForLog(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	if value == "" {
		value = "unknown"
	}
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func (l abuseLimit) String() string {
	return fmt.Sprintf("%s max=%d window=%s", l.Key, l.Max, l.Window)
}
