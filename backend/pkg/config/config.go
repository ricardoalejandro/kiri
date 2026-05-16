package config

import (
	"log"
	"os"
	"strings"
)

type Config struct {
	DatabaseURL   string
	RedisURL      string
	JWTSecret     string
	Port          string
	Env           string
	AdminUser     string
	AdminPassword string
	AdminEmail    string
	CORSOrigins   []string
	// MinIO Storage
	MinioEndpoint  string
	MinioAccessKey string
	MinioSecretKey string
	MinioBucket    string
	MinioUseSSL    bool
	MinioPublicURL string
	// PublicURL is the public URL of the Kiri backend (e.g., https://kiri.naperu.cloud)
	PublicURL string
	// AI Assistant
	GeminiAPIKey string
	GroqAPIKey   string
	// Google Contacts OAuth
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURI  string
}

func Load() *Config {
	corsOrigins := getEnv("CORS_ORIGINS", "http://localhost:3000")
	origins := strings.Split(corsOrigins, ",")
	for i := range origins {
		origins[i] = strings.TrimSpace(origins[i])
	}

	return &Config{
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://kiri:kiri_secret_2026@localhost:5432/kiri?sslmode=disable"),
		RedisURL:           getEnv("REDIS_URL", "redis://localhost:6379"),
		JWTSecret:          getEnv("JWT_SECRET", "kiri_jwt_secret_change_in_production_2026"),
		Port:               getEnv("PORT", "8080"),
		Env:                getEnv("ENV", "development"),
		AdminUser:          getEnv("ADMIN_USER", "admin"),
		AdminPassword:      getEnv("ADMIN_PASSWORD", "kiri123"),
		AdminEmail:         getEnv("ADMIN_EMAIL", "admin@kiri.local"),
		CORSOrigins:        origins,
		MinioEndpoint:      getEnv("MINIO_ENDPOINT", "localhost:9000"),
		MinioAccessKey:     getEnv("MINIO_ACCESS_KEY", "kiriadmin"),
		MinioSecretKey:     getEnv("MINIO_SECRET_KEY", "kiriadmin"),
		MinioBucket:        getEnv("MINIO_BUCKET", "kiri-media"),
		MinioUseSSL:        getEnv("MINIO_USE_SSL", "false") == "true",
		MinioPublicURL:     getEnv("MINIO_PUBLIC_URL", "http://localhost:9000"),
		PublicURL:          getEnv("PUBLIC_URL", ""),
		GeminiAPIKey:       getEnv("GEMINI_API_KEY", ""),
		GroqAPIKey:         getEnv("GROQ_API_KEY", ""),
		GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
		GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
		GoogleRedirectURI:  getEnv("GOOGLE_REDIRECT_URI", ""),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func (c *Config) IsDevelopment() bool {
	return c.Env == "development"
}

func (c *Config) IsProduction() bool {
	return c.Env == "production"
}

// Validate checks that critical secrets are not using default values in production.
func (c *Config) Validate() {
	if !c.IsProduction() {
		return
	}
	if c.DatabaseURL == "" || strings.Contains(c.DatabaseURL, "kiri_secret_2026") {
		log.Fatal("[CONFIG] FATAL: DATABASE_URL is missing or using an unsafe default in production.")
	}
	if c.JWTSecret == "kiri_jwt_secret_change_in_production_2026" {
		log.Fatal("[CONFIG] FATAL: JWT_SECRET is using the default value in production. Set a secure JWT_SECRET environment variable.")
	}
	if len(c.JWTSecret) < 32 {
		log.Fatal("[CONFIG] FATAL: JWT_SECRET must be at least 32 characters in production.")
	}
	if c.AdminPassword == "kiri123" {
		log.Fatal("[CONFIG] FATAL: ADMIN_PASSWORD is using the default value in production. Set a secure ADMIN_PASSWORD environment variable.")
	}
	if len(c.AdminPassword) < 12 {
		log.Fatal("[CONFIG] FATAL: ADMIN_PASSWORD must be at least 12 characters in production.")
	}
	if c.MinioSecretKey == "" || c.MinioSecretKey == "kiriadmin" {
		log.Fatal("[CONFIG] FATAL: MINIO_SECRET_KEY/MINIO_ROOT_PASSWORD is missing or using an unsafe default in production.")
	}
	if c.PublicURL == "" || !strings.HasPrefix(c.PublicURL, "https://") {
		log.Fatal("[CONFIG] FATAL: PUBLIC_URL must be an https:// URL in production.")
	}
	for _, origin := range c.CORSOrigins {
		origin = strings.TrimSpace(origin)
		if strings.Contains(origin, "localhost") || strings.Contains(origin, "127.0.0.1") || strings.HasPrefix(origin, "http://") {
			log.Fatalf("[CONFIG] FATAL: CORS_ORIGINS contains non-production origin %q.", origin)
		}
	}
	if c.GoogleClientID != "" && c.GoogleRedirectURI == "" {
		log.Fatal("[CONFIG] FATAL: GOOGLE_REDIRECT_URI is required when GOOGLE_CLIENT_ID is configured.")
	}
}
