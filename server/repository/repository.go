package repository

import (
	"errors"

	"c-aihuabu-server/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository struct{ DB *gorm.DB }

type DashboardStats struct {
	Users       int64 `json:"users"`
	TotalPoints int64 `json:"totalPoints"`
	PaidOrders  int64 `json:"paidOrders"`
	RevenueCent int64 `json:"revenueCent"`
}

func (r Repository) CreateUser(user *model.User) error { return r.DB.Create(user).Error }

func (r Repository) UserByEmail(email string) (model.User, error) {
	var user model.User
	err := r.DB.Where("email = ?", email).First(&user).Error
	return user, err
}

func (r Repository) UserByID(id string) (model.User, error) {
	var user model.User
	err := r.DB.First(&user, "id = ?", id).Error
	return user, err
}

func (r Repository) ListLedger(userID string, limit int) ([]model.PointLedger, error) {
	var rows []model.PointLedger
	err := r.DB.Where("user_id = ?", userID).Order("created_at desc").Limit(limit).Find(&rows).Error
	return rows, err
}

func (r Repository) ListAllLedger(limit int) ([]model.PointLedger, error) {
	var rows []model.PointLedger
	err := r.DB.Order("created_at desc").Limit(limit).Find(&rows).Error
	return rows, err
}

func (r Repository) ListUsers(keyword string, page, pageSize int) ([]model.User, int64, error) {
	query := r.DB.Model(&model.User{})
	if keyword != "" {
		query = query.Where("email LIKE ? OR nickname LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var rows []model.User
	err := query.Order("created_at desc").Offset((page - 1) * pageSize).Limit(pageSize).Find(&rows).Error
	return rows, total, err
}

func (r Repository) Dashboard() (DashboardStats, error) {
	var stats DashboardStats
	if err := r.DB.Model(&model.User{}).Count(&stats.Users).Error; err != nil {
		return stats, err
	}
	if err := r.DB.Model(&model.User{}).Select("COALESCE(SUM(points), 0)").Scan(&stats.TotalPoints).Error; err != nil {
		return stats, err
	}
	if err := r.DB.Model(&model.RechargeOrder{}).Where("status = ?", "paid").Count(&stats.PaidOrders).Error; err != nil {
		return stats, err
	}
	err := r.DB.Model(&model.RechargeOrder{}).Where("status = ?", "paid").Select("COALESCE(SUM(amount_cent), 0)").Scan(&stats.RevenueCent).Error
	return stats, err
}

func (r Repository) ListPackages(admin bool) ([]model.PointPackage, error) {
	var rows []model.PointPackage
	query := r.DB.Order("sort desc, price_cent asc")
	if !admin {
		query = query.Where("enabled = ?", true)
	}
	err := query.Find(&rows).Error
	return rows, err
}

func (r Repository) SavePackage(row *model.PointPackage) error { return r.DB.Save(row).Error }

func (r Repository) PackageByID(id string) (model.PointPackage, error) {
	var row model.PointPackage
	err := r.DB.First(&row, "id = ? AND enabled = ?", id, true).Error
	return row, err
}
func (r Repository) CreateOrder(row *model.RechargeOrder) error { return r.DB.Create(row).Error }
func (r Repository) OrderByNo(no string) (model.RechargeOrder, error) {
	var row model.RechargeOrder
	err := r.DB.Where("order_no = ?", no).First(&row).Error
	return row, err
}

func (r Repository) ListPrices() ([]model.GenerationPrice, error) {
	var rows []model.GenerationPrice
	err := r.DB.Order("media_type, model").Find(&rows).Error
	return rows, err
}

func (r Repository) SavePrice(row *model.GenerationPrice) error { return r.DB.Save(row).Error }

func (r Repository) Settings(prefix string) (map[string]model.SystemSetting, error) {
	var rows []model.SystemSetting
	if err := r.DB.Where("key LIKE ?", prefix+"%").Find(&rows).Error; err != nil {
		return nil, err
	}
	result := make(map[string]model.SystemSetting, len(rows))
	for _, row := range rows {
		result[row.Key] = row
	}
	return result, nil
}

func (r Repository) SaveSettings(rows []model.SystemSetting) error {
	return r.DB.Transaction(func(tx *gorm.DB) error {
		for _, row := range rows {
			if err := tx.Save(&row).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r Repository) ListAIChannels(enabledOnly bool) ([]model.AIChannel, error) {
	var rows []model.AIChannel
	query := r.DB.Order("created_at asc")
	if enabledOnly {
		query = query.Where("enabled = ?", true)
	}
	return rows, query.Find(&rows).Error
}
func (r Repository) AIChannelByID(id string) (model.AIChannel, error) {
	var row model.AIChannel
	return row, r.DB.First(&row, "id = ?", id).Error
}
func (r Repository) SaveAIChannel(row *model.AIChannel) error { return r.DB.Save(row).Error }
func (r Repository) DeleteAIChannel(id string) error {
	return r.DB.Delete(&model.AIChannel{}, "id = ?", id).Error
}

func (r Repository) AdjustPoints(userID string, amount int64, entry model.PointLedger) (model.User, error) {
	var user model.User
	err := r.DB.Transaction(func(tx *gorm.DB) error {
		if entry.IdempotencyKey != "" {
			var count int64
			if err := tx.Model(&model.PointLedger{}).Where("idempotency_key = ?", entry.IdempotencyKey).Count(&count).Error; err != nil || count > 0 {
				if count > 0 {
					return errors.New("重复的积分操作")
				}
				return err
			}
		}
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&user, "id = ?", userID).Error; err != nil {
			return err
		}
		if user.Points+amount < 0 {
			return errors.New("积分余额不足")
		}
		user.Points += amount
		if err := tx.Model(&user).Update("points", user.Points).Error; err != nil {
			return err
		}
		entry.UserID, entry.Amount, entry.BalanceAfter = userID, amount, user.Points
		return tx.Create(&entry).Error
	})
	return user, err
}

func IsNotFound(err error) bool { return errors.Is(err, gorm.ErrRecordNotFound) }
