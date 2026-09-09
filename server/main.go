package main

import (
	"log"
	"os"
	"path/filepath"

	"c-aihuabu-server/config"
	"c-aihuabu-server/handler"
	"c-aihuabu-server/middleware"
	"c-aihuabu-server/model"
	"c-aihuabu-server/payment"
	"c-aihuabu-server/repository"
	"c-aihuabu-server/service"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	cfg := config.Load()
	if len(cfg.JWTSecret) < 32 {
		log.Fatal("C_AI_JWT_SECRET must contain at least 32 characters")
	}
	if err := os.MkdirAll(filepath.Dir(cfg.DatabasePath), 0700); err != nil {
		log.Fatal(err)
	}
	db, err := gorm.Open(sqlite.Open(cfg.DatabasePath), &gorm.Config{})
	if err != nil {
		log.Fatal(err)
	}
	if err := db.AutoMigrate(&model.User{}, &model.PointLedger{}, &model.PointPackage{}, &model.RechargeOrder{}, &model.GenerationPrice{}, &model.SystemSetting{}, &model.AIChannel{}, &model.AIUsageLog{}); err != nil {
		log.Fatal(err)
	}
	repo := repository.Repository{DB: db}
	if err := bootstrapAdmin(repo, cfg); err != nil {
		log.Fatal(err)
	}
	svc := service.Service{Repo: repo, JWTSecret: []byte(cfg.JWTSecret), TokenTTL: cfg.TokenTTL}
	h := handler.Handler{Service: svc, Payment: &payment.TianQue{Config: cfg.Payment}}
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())
	router.GET("/healthz", func(c *gin.Context) { handler.OK(c, gin.H{"service": "business"}) })
	api := router.Group("/api")
	api.POST("/auth/register", h.Register)
	api.POST("/auth/login", h.Login)
	api.GET("/models", h.PublicModels)
	api.GET("/payment/options", h.PaymentOptions)
	router.GET("/internal/ai-channel", h.InternalAIChannel)
	router.POST("/internal/ai-usage", h.InternalAIUsage)
	authed := api.Group("")
	authed.Use(middleware.Auth(svc))
	authed.GET("/users/me", h.Me)
	authed.GET("/wallet/ledger", h.Ledger)
	authed.GET("/packages", h.Packages)
	authed.POST("/orders", h.CreateOrder)
	api.POST("/payment/notify/tianque", h.PaymentNotify)
	admin := authed.Group("/admin")
	admin.Use(middleware.Admin())
	admin.GET("/dashboard", h.AdminDashboard)
	admin.GET("/users", h.AdminUsers)
	admin.GET("/ledger", h.AdminLedger)
	admin.POST("/users/:id/points", h.AdjustPoints)
	admin.GET("/packages", h.Packages)
	admin.POST("/packages", h.SavePackage)
	admin.GET("/prices", h.Prices)
	admin.POST("/prices", h.SavePrice)
	admin.GET("/settings/payment", h.AdminPaymentSettings)
	admin.PUT("/settings/payment", h.SavePaymentSettings)
	admin.GET("/settings/general", h.AdminGeneralSettings)
	admin.PUT("/settings/general", h.SaveGeneralSettings)
	admin.GET("/channels", h.AdminAIChannels)
	admin.GET("/usage-logs", h.AdminUsageLogs)
	admin.POST("/channels", h.SaveAIChannel)
	admin.DELETE("/channels/:id", h.DeleteAIChannel)
	admin.POST("/channels/:id/fetch-models", h.FetchAIChannelModels)
	log.Printf("business server listening on %s", cfg.Addr)
	log.Fatal(router.Run(cfg.Addr))
}

func bootstrapAdmin(repo repository.Repository, cfg config.Config) error {
	if cfg.AdminEmail == "" || cfg.AdminPassword == "" {
		return nil
	}
	if _, err := repo.UserByEmail(cfg.AdminEmail); err == nil {
		return nil
	} else if !repository.IsNotFound(err) {
		return err
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(cfg.AdminPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	return repo.CreateUser(&model.User{ID: service.NewID(), Email: cfg.AdminEmail, Nickname: "管理员", PasswordHash: string(hash), Role: "admin", Status: "active"})
}
