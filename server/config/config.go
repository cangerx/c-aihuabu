package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Addr          string
	DatabasePath  string
	JWTSecret     string
	TokenTTL      time.Duration
	AdminEmail    string
	AdminPassword string
	Payment       TianQueConfig
}

type TianQueConfig struct {
	Enabled        bool
	Sandbox        bool
	Host           string
	ProductionHost string
	OrgID          string
	MNO            string
	SubMechID      string
	PrivateKey     string
	PublicKey      string
	SignType       string
	Version        string
	NotifyURL      string
}

func Load() Config {
	result := Config{
		Addr:          env("C_AI_SERVER_ADDR", ":8788"),
		DatabasePath:  env("C_AI_DATABASE_PATH", "/data/business/c-aihuabu.db"),
		JWTSecret:     strings.TrimSpace(os.Getenv("C_AI_JWT_SECRET")),
		TokenTTL:      time.Duration(envInt("C_AI_TOKEN_TTL_HOURS", 168)) * time.Hour,
		AdminEmail:    strings.ToLower(strings.TrimSpace(os.Getenv("C_AI_ADMIN_EMAIL"))),
		AdminPassword: os.Getenv("C_AI_ADMIN_PASSWORD"),
		Payment: TianQueConfig{
			Enabled: envBool("C_AI_TIANQUE_ENABLED", false), Sandbox: envBool("C_AI_TIANQUE_SANDBOX", true),
			Host: env("C_AI_TIANQUE_HOST", "https://openapi-test.tianquetech.com"), ProductionHost: env("C_AI_TIANQUE_HOST_PROD", "https://openapi.tianquetech.com"),
			OrgID: strings.TrimSpace(os.Getenv("C_AI_TIANQUE_ORG_ID")), MNO: strings.TrimSpace(os.Getenv("C_AI_TIANQUE_MNO")), SubMechID: strings.TrimSpace(os.Getenv("C_AI_TIANQUE_SUB_MECH_ID")),
			PrivateKey: os.Getenv("C_AI_TIANQUE_PRIVATE_KEY"), PublicKey: os.Getenv("C_AI_TIANQUE_PUBLIC_KEY"), SignType: env("C_AI_TIANQUE_SIGN_TYPE", "RSA"), Version: env("C_AI_TIANQUE_VERSION", "1.2"), NotifyURL: strings.TrimSpace(os.Getenv("C_AI_TIANQUE_NOTIFY_URL")),
		},
	}
	if result.Payment.NotifyURL == "" {
		result.Payment.NotifyURL = "https://ai.vvj.me/api/payment/notify/tianque"
	}
	return result
}

func env(key, fallback string) string {
	if value := strings.TrimSpace(os.Getenv(key)); value != "" {
		return value
	}
	return fallback
}

func envInt(key string, fallback int) int {
	value, err := strconv.Atoi(strings.TrimSpace(os.Getenv(key)))
	if err != nil || value <= 0 {
		return fallback
	}
	return value
}

func envBool(key string, fallback bool) bool {
	value := strings.ToLower(strings.TrimSpace(os.Getenv(key)))
	if value == "true" || value == "1" || value == "yes" {
		return true
	}
	if value == "false" || value == "0" || value == "no" {
		return false
	}
	return fallback
}
