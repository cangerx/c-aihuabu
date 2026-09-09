package model

import "time"

type User struct {
	ID           string    `gorm:"primaryKey;size:36" json:"id"`
	Email        string    `gorm:"uniqueIndex;size:191;not null" json:"email"`
	Nickname     string    `gorm:"size:80;not null" json:"nickname"`
	PasswordHash string    `gorm:"size:255;not null" json:"-"`
	Role         string    `gorm:"size:20;not null;default:user" json:"role"`
	Status       string    `gorm:"size:20;not null;default:active" json:"status"`
	Points       int64     `gorm:"not null;default:0" json:"points"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type PointLedger struct {
	ID             string    `gorm:"primaryKey;size:36" json:"id"`
	UserID         string    `gorm:"index;size:36;not null" json:"userId"`
	Type           string    `gorm:"index;size:32;not null" json:"type"`
	Amount         int64     `gorm:"not null" json:"amount"`
	BalanceAfter   int64     `gorm:"not null" json:"balanceAfter"`
	ReferenceType  string    `gorm:"size:32" json:"referenceType"`
	ReferenceID    string    `gorm:"size:64" json:"referenceId"`
	IdempotencyKey string    `gorm:"uniqueIndex;size:100" json:"idempotencyKey"`
	Remark         string    `gorm:"size:255" json:"remark"`
	OperatorID     string    `gorm:"size:36" json:"operatorId"`
	CreatedAt      time.Time `gorm:"index" json:"createdAt"`
}

type PointPackage struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	Name      string    `gorm:"size:80;not null" json:"name"`
	Points    int64     `gorm:"not null" json:"points"`
	PriceCent int64     `gorm:"not null" json:"priceCent"`
	Enabled   bool      `gorm:"not null;default:true" json:"enabled"`
	Sort      int       `gorm:"not null;default:0" json:"sort"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type RechargeOrder struct {
	ID            string     `gorm:"primaryKey;size:36" json:"id"`
	OrderNo       string     `gorm:"uniqueIndex;size:64;not null" json:"orderNo"`
	UserID        string     `gorm:"index;size:36;not null" json:"userId"`
	PackageID     string     `gorm:"size:36;not null" json:"packageId"`
	PackageName   string     `gorm:"size:80;not null" json:"packageName"`
	Points        int64      `gorm:"not null" json:"points"`
	AmountCent    int64      `gorm:"not null" json:"amountCent"`
	Status        string     `gorm:"index;size:20;not null;default:pending" json:"status"`
	PaymentMethod string     `gorm:"size:32" json:"paymentMethod"`
	PaymentTrade  string     `gorm:"uniqueIndex;size:100" json:"paymentTrade"`
	PaidAt        *time.Time `json:"paidAt"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

type GenerationPrice struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	Model     string    `gorm:"uniqueIndex;size:191;not null" json:"model"`
	MediaType string    `gorm:"size:20;not null" json:"mediaType"`
	Points    int64     `gorm:"not null" json:"points"`
	Enabled   bool      `gorm:"not null;default:true" json:"enabled"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type SystemSetting struct {
	Key       string    `gorm:"primaryKey;size:100" json:"key"`
	Value     string    `gorm:"type:text;not null" json:"value"`
	Secret    bool      `gorm:"not null;default:false" json:"secret"`
	UpdatedBy string    `gorm:"size:36" json:"updatedBy"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type AIChannel struct {
	ID        string    `gorm:"primaryKey;size:36" json:"id"`
	Name      string    `gorm:"size:80;not null" json:"name"`
	BaseURL   string    `gorm:"uniqueIndex;size:500;not null" json:"baseUrl"`
	APIKey    string    `gorm:"type:text;not null" json:"-"`
	Models    string    `gorm:"type:text;not null" json:"-"`
	Enabled   bool      `gorm:"not null;default:true" json:"enabled"`
	UpdatedBy string    `gorm:"size:36" json:"updatedBy"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type AIUsageLog struct {
	ID         string    `gorm:"primaryKey;size:36" json:"id"`
	ChannelID  string    `gorm:"index;size:36" json:"channelId"`
	UserID     string    `gorm:"index;size:36" json:"userId"`
	Model      string    `gorm:"index;size:191" json:"model"`
	Path       string    `gorm:"size:120" json:"path"`
	Status     int       `json:"status"`
	Error      string    `gorm:"size:500" json:"error"`
	DurationMs int64     `json:"durationMs"`
	Points     int64     `json:"points"`
	CreatedAt  time.Time `gorm:"index" json:"createdAt"`
}
