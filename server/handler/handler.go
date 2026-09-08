package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"c-aihuabu-server/config"
	"c-aihuabu-server/middleware"
	"c-aihuabu-server/model"
	"c-aihuabu-server/payment"
	"c-aihuabu-server/service"
	"github.com/gin-gonic/gin"
)

type Handler struct {
	Service service.Service
	Payment *payment.TianQue
}

type paymentSettingsRequest struct {
	Enabled                                                                                          *bool `json:"enabled"`
	WechatEnabled                                                                                    *bool `json:"wechatEnabled"`
	AlipayEnabled                                                                                    *bool `json:"alipayEnabled"`
	Sandbox                                                                                          *bool `json:"sandbox"`
	Host, ProductionHost, OrgID, MNO, SubMechID, SignType, Version, NotifyURL, PrivateKey, PublicKey string
}
type generalSettingsRequest struct {
	RegistrationEnabled    *bool  `json:"registrationEnabled"`
	RegistrationGiftPoints *int64 `json:"registrationGiftPoints"`
	TokenTTLHours          *int   `json:"tokenTtlHours"`
	DefaultImagePoints     *int64 `json:"defaultImagePoints"`
	DefaultVideoPoints     *int64 `json:"defaultVideoPoints"`
	DefaultTextPoints      *int64 `json:"defaultTextPoints"`
	DefaultAudioPoints     *int64 `json:"defaultAudioPoints"`
	MaintenanceMode        *bool  `json:"maintenanceMode"`
}

type authRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	Nickname string `json:"nickname"`
}
type adjustRequest struct {
	Amount         int64  `json:"amount"`
	Remark         string `json:"remark"`
	IdempotencyKey string `json:"idempotencyKey"`
}
type packageRequest struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Points    int64  `json:"points"`
	PriceCent int64  `json:"priceCent"`
	Enabled   bool   `json:"enabled"`
	Sort      int    `json:"sort"`
}
type priceRequest struct {
	ID        string `json:"id"`
	Model     string `json:"model"`
	MediaType string `json:"mediaType"`
	Points    int64  `json:"points"`
	Enabled   bool   `json:"enabled"`
}
type orderRequest struct {
	PackageID string `json:"packageId"`
	PayMethod string `json:"payMethod"`
}
type aiChannelRequest struct {
	ID, Name, BaseURL, APIKey string
	Enabled                   bool     `json:"enabled"`
	Models                    []string `json:"models"`
}

func OK(c *gin.Context, data any) { c.JSON(http.StatusOK, gin.H{"code": 0, "data": data, "msg": "ok"}) }
func Fail(c *gin.Context, status int, err error) {
	c.JSON(status, gin.H{"code": status, "data": nil, "msg": err.Error()})
}

func (h Handler) Register(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, 400, err)
		return
	}
	user, token, err := h.Service.Register(req.Email, req.Password, req.Nickname)
	if err != nil {
		Fail(c, 400, err)
		return
	}
	OK(c, gin.H{"token": token, "user": user})
}

func (h Handler) Login(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, 400, err)
		return
	}
	user, token, err := h.Service.Login(req.Email, req.Password)
	if err != nil {
		Fail(c, 401, err)
		return
	}
	OK(c, gin.H{"token": token, "user": user})
}

func (h Handler) Me(c *gin.Context) {
	user, err := h.Service.Repo.UserByID(c.GetString(middleware.UserIDKey))
	if err != nil {
		Fail(c, 404, err)
		return
	}
	OK(c, user)
}

func (h Handler) Ledger(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	if limit < 1 || limit > 100 {
		limit = 50
	}
	rows, err := h.Service.Repo.ListLedger(c.GetString(middleware.UserIDKey), limit)
	if err != nil {
		Fail(c, 500, err)
		return
	}
	OK(c, rows)
}

func (h Handler) Packages(c *gin.Context) {
	rows, err := h.Service.Repo.ListPackages(c.GetString("role") == "admin")
	if err != nil {
		Fail(c, 500, err)
		return
	}
	OK(c, rows)
}

func (h Handler) CreateOrder(c *gin.Context) {
	h.refreshPaymentConfig()
	if !h.Payment.Config.Enabled {
		Fail(c, http.StatusServiceUnavailable, errors.New("支付渠道未启用"))
		return
	}
	var req orderRequest
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.PackageID) == "" {
		Fail(c, 400, errors.New("请选择积分套餐"))
		return
	}
	method := strings.ToUpper(strings.TrimSpace(req.PayMethod))
	if method != "WECHAT" && method != "ALIPAY" {
		Fail(c, 400, errors.New("暂只支持微信或支付宝"))
		return
	}
	if (method == "WECHAT" && !h.Payment.Config.WechatEnabled) || (method == "ALIPAY" && !h.Payment.Config.AlipayEnabled) {
		Fail(c, 400, errors.New("该支付方式暂未开放"))
		return
	}
	pkg, err := h.Service.Repo.PackageByID(req.PackageID)
	if err != nil {
		Fail(c, 404, errors.New("积分套餐不存在或已下架"))
		return
	}
	order := model.RechargeOrder{ID: service.NewID(), OrderNo: "CA" + time.Now().Format("20060102150405") + strings.ToUpper(service.NewID()[:6]), UserID: c.GetString(middleware.UserIDKey), PackageID: pkg.ID, PackageName: pkg.Name, Points: pkg.Points, AmountCent: pkg.PriceCent, PaymentMethod: method, Status: "pending"}
	if err := h.Service.Repo.CreateOrder(&order); err != nil {
		Fail(c, 500, err)
		return
	}
	qr, providerNo, raw, err := h.Payment.CreateOrder(order, method, c.ClientIP())
	if err != nil {
		Fail(c, 503, err)
		return
	}
	order.PaymentTrade = providerNo
	if err := h.Service.Repo.DB.Model(&order).Updates(map[string]any{"payment_trade": providerNo}).Error; err != nil {
		Fail(c, 500, err)
		return
	}
	OK(c, gin.H{"orderNo": order.OrderNo, "qrCode": qr, "providerOrderNo": providerNo, "providerResponse": raw})
}

func (h Handler) PaymentNotify(c *gin.Context) {
	h.refreshPaymentConfig()
	var payload map[string]any
	if err := c.ShouldBindJSON(&payload); err != nil {
		Fail(c, 400, err)
		return
	}
	data, err := h.Payment.VerifyNotify(payload)
	if err != nil {
		Fail(c, 400, err)
		return
	}
	orderNo := stringValue(data["ordNo"])
	order, err := h.Service.Repo.OrderByNo(orderNo)
	if err != nil {
		Fail(c, 404, errors.New("订单不存在"))
		return
	}
	if order.Status == "paid" {
		c.String(http.StatusOK, "SUCCESS")
		return
	}
	if stringValue(data["tranSts"]) == "SUCCESS" && stringValue(data["bizCode"]) == "0000" {
		_, err = h.Service.Repo.AdjustPoints(order.UserID, order.Points, model.PointLedger{ID: service.NewID(), Type: "recharge", ReferenceType: "recharge_order", ReferenceID: order.ID, IdempotencyKey: "recharge:" + order.ID, Remark: "积分充值"})
		if err == nil {
			err = h.Service.Repo.DB.Model(&order).Updates(map[string]any{"status": "paid"}).Error
		}
	}
	if err != nil {
		Fail(c, 500, err)
		return
	}
	c.String(http.StatusOK, "SUCCESS")
}

func (h Handler) refreshPaymentConfig() {
	if h.Payment == nil {
		return
	}
	if rows, err := h.Service.Repo.Settings("payment."); err == nil {
		applyPaymentSettings(&h.Payment.Config, rows)
	}
}

func stringValue(value any) string { text, _ := value.(string); return strings.TrimSpace(text) }

func (h Handler) AdminDashboard(c *gin.Context) {
	stats, err := h.Service.Repo.Dashboard()
	if err != nil {
		Fail(c, 500, err)
		return
	}
	OK(c, stats)
}

func (h Handler) AdminLedger(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "100"))
	if limit < 1 || limit > 500 {
		limit = 100
	}
	rows, err := h.Service.Repo.ListAllLedger(limit)
	if err != nil {
		Fail(c, 500, err)
		return
	}
	OK(c, rows)
}

func (h Handler) AdminUsers(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	rows, total, err := h.Service.Repo.ListUsers(strings.TrimSpace(c.Query("keyword")), page, pageSize)
	if err != nil {
		Fail(c, 500, err)
		return
	}
	OK(c, gin.H{"list": rows, "total": total, "page": page, "pageSize": pageSize})
}

func (h Handler) SavePackage(c *gin.Context) {
	var req packageRequest
	err := c.ShouldBindJSON(&req)
	if err == nil && (req.Name == "" || req.Points <= 0 || req.PriceCent <= 0) {
		err = errors.New("请填写有效的套餐名称、积分和价格")
	}
	if err != nil {
		Fail(c, 400, err)
		return
	}
	if req.ID == "" {
		req.ID = service.NewID()
	}
	row := model.PointPackage{ID: req.ID, Name: strings.TrimSpace(req.Name), Points: req.Points, PriceCent: req.PriceCent, Enabled: req.Enabled, Sort: req.Sort}
	if err := h.Service.Repo.SavePackage(&row); err != nil {
		Fail(c, 500, err)
		return
	}
	OK(c, row)
}

func (h Handler) Prices(c *gin.Context) {
	rows, err := h.Service.Repo.ListPrices()
	if err != nil {
		Fail(c, 500, err)
		return
	}
	OK(c, rows)
}

func (h Handler) SavePrice(c *gin.Context) {
	var req priceRequest
	err := c.ShouldBindJSON(&req)
	if err == nil && (req.Model == "" || req.MediaType == "" || req.Points <= 0) {
		err = errors.New("请填写有效的模型、类型和积分")
	}
	if err != nil {
		Fail(c, 400, err)
		return
	}
	if req.ID == "" {
		req.ID = service.NewID()
	}
	row := model.GenerationPrice{ID: req.ID, Model: strings.TrimSpace(req.Model), MediaType: req.MediaType, Points: req.Points, Enabled: req.Enabled}
	if err := h.Service.Repo.SavePrice(&row); err != nil {
		Fail(c, 500, err)
		return
	}
	OK(c, row)
}

func (h Handler) AdminPaymentSettings(c *gin.Context) {
	rows, err := h.Service.Repo.Settings("payment.")
	if err != nil {
		Fail(c, 500, err)
		return
	}
	value := func(key, fallback string) string {
		if row, ok := rows[key]; ok {
			return row.Value
		}
		return fallback
	}
	pc := h.Payment.Config
	OK(c, gin.H{"enabled": value("payment.enabled", strconv.FormatBool(pc.Enabled)) == "true", "wechatEnabled": value("payment.wechatEnabled", strconv.FormatBool(pc.WechatEnabled)) == "true", "alipayEnabled": value("payment.alipayEnabled", strconv.FormatBool(pc.AlipayEnabled)) == "true", "sandbox": value("payment.sandbox", strconv.FormatBool(pc.Sandbox)) == "true", "host": value("payment.host", pc.Host), "productionHost": value("payment.productionHost", pc.ProductionHost), "orgId": value("payment.orgId", pc.OrgID), "mno": value("payment.mno", pc.MNO), "subMechId": value("payment.subMechId", pc.SubMechID), "signType": value("payment.signType", pc.SignType), "version": value("payment.version", pc.Version), "notifyUrl": value("payment.notifyUrl", pc.NotifyURL), "privateKeyConfigured": rows["payment.privateKey"].Value != "" || pc.PrivateKey != "", "publicKeyConfigured": rows["payment.publicKey"].Value != "" || pc.PublicKey != ""})
}

func (h Handler) PaymentOptions(c *gin.Context) {
	h.refreshPaymentConfig()
	methods := []string{}
	if h.Payment.Config.Enabled && h.Payment.Config.WechatEnabled {
		methods = append(methods, "WECHAT")
	}
	if h.Payment.Config.Enabled && h.Payment.Config.AlipayEnabled {
		methods = append(methods, "ALIPAY")
	}
	OK(c, gin.H{"enabled": h.Payment.Config.Enabled, "methods": methods})
}

func (h Handler) SavePaymentSettings(c *gin.Context) {
	var req paymentSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, 400, err)
		return
	}
	wechatEnabled, alipayEnabled := h.Payment.Config.WechatEnabled, h.Payment.Config.AlipayEnabled
	if req.WechatEnabled != nil {
		wechatEnabled = *req.WechatEnabled
	}
	if req.AlipayEnabled != nil {
		alipayEnabled = *req.AlipayEnabled
	}
	if req.Enabled != nil && *req.Enabled && !wechatEnabled && !alipayEnabled {
		Fail(c, 400, errors.New("启用支付时至少开放一种支付方式"))
		return
	}
	rows := []model.SystemSetting{}
	add := func(key, value string, secret bool) {
		if strings.TrimSpace(value) != "" {
			rows = append(rows, model.SystemSetting{Key: key, Value: strings.TrimSpace(value), Secret: secret, UpdatedBy: c.GetString(middleware.UserIDKey)})
		}
	}
	if req.Enabled != nil {
		add("payment.enabled", strconv.FormatBool(*req.Enabled), false)
	}
	if req.Sandbox != nil {
		add("payment.sandbox", strconv.FormatBool(*req.Sandbox), false)
	}
	if req.WechatEnabled != nil {
		add("payment.wechatEnabled", strconv.FormatBool(*req.WechatEnabled), false)
	}
	if req.AlipayEnabled != nil {
		add("payment.alipayEnabled", strconv.FormatBool(*req.AlipayEnabled), false)
	}
	add("payment.host", req.Host, false)
	add("payment.productionHost", req.ProductionHost, false)
	add("payment.orgId", req.OrgID, false)
	add("payment.mno", req.MNO, false)
	add("payment.subMechId", req.SubMechID, false)
	add("payment.signType", req.SignType, false)
	add("payment.version", req.Version, false)
	add("payment.notifyUrl", req.NotifyURL, false)
	add("payment.privateKey", req.PrivateKey, true)
	add("payment.publicKey", req.PublicKey, true)
	if err := h.Service.Repo.SaveSettings(rows); err != nil {
		Fail(c, 500, err)
		return
	}
	settings, _ := h.Service.Repo.Settings("payment.")
	applyPaymentSettings(&h.Payment.Config, settings)
	OK(c, gin.H{"saved": true})
}

func applyPaymentSettings(target *config.TianQueConfig, rows map[string]model.SystemSetting) {
	get := func(key, fallback string) string {
		if row, ok := rows[key]; ok && row.Value != "" {
			return row.Value
		}
		return fallback
	}
	target.Enabled = get("payment.enabled", strconv.FormatBool(target.Enabled)) == "true"
	target.WechatEnabled = get("payment.wechatEnabled", strconv.FormatBool(target.WechatEnabled)) == "true"
	target.AlipayEnabled = get("payment.alipayEnabled", strconv.FormatBool(target.AlipayEnabled)) == "true"
	target.Sandbox = get("payment.sandbox", strconv.FormatBool(target.Sandbox)) == "true"
	target.Host = get("payment.host", target.Host)
	target.ProductionHost = get("payment.productionHost", target.ProductionHost)
	target.OrgID = get("payment.orgId", target.OrgID)
	target.MNO = get("payment.mno", target.MNO)
	target.SubMechID = get("payment.subMechId", target.SubMechID)
	target.SignType = get("payment.signType", target.SignType)
	target.Version = get("payment.version", target.Version)
	target.NotifyURL = get("payment.notifyUrl", target.NotifyURL)
	target.PrivateKey = get("payment.privateKey", target.PrivateKey)
	target.PublicKey = get("payment.publicKey", target.PublicKey)
}

func (h Handler) AdminGeneralSettings(c *gin.Context) {
	rows, err := h.Service.Repo.Settings("general.")
	if err != nil {
		Fail(c, 500, err)
		return
	}
	value := func(key, fallback string) string {
		if row, ok := rows[key]; ok {
			return row.Value
		}
		return fallback
	}
	OK(c, gin.H{"registrationEnabled": value("general.registrationEnabled", "true") == "true", "registrationGiftPoints": atoi64(value("general.registrationGiftPoints", "0")), "tokenTtlHours": atoi(value("general.tokenTtlHours", "168")), "defaultImagePoints": atoi64(value("general.defaultImagePoints", "1")), "defaultVideoPoints": atoi64(value("general.defaultVideoPoints", "10")), "defaultTextPoints": atoi64(value("general.defaultTextPoints", "1")), "defaultAudioPoints": atoi64(value("general.defaultAudioPoints", "1")), "maintenanceMode": value("general.maintenanceMode", "false") == "true"})
}
func (h Handler) SaveGeneralSettings(c *gin.Context) {
	var req generalSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, 400, err)
		return
	}
	rows := []model.SystemSetting{}
	add := func(key, value string) {
		rows = append(rows, model.SystemSetting{Key: key, Value: value, UpdatedBy: c.GetString(middleware.UserIDKey)})
	}
	if req.RegistrationEnabled != nil {
		add("general.registrationEnabled", strconv.FormatBool(*req.RegistrationEnabled))
	}
	if req.RegistrationGiftPoints != nil && *req.RegistrationGiftPoints >= 0 {
		add("general.registrationGiftPoints", strconv.FormatInt(*req.RegistrationGiftPoints, 10))
	}
	if req.TokenTTLHours != nil && *req.TokenTTLHours > 0 {
		add("general.tokenTtlHours", strconv.Itoa(*req.TokenTTLHours))
	}
	for key, value := range map[string]*int64{"general.defaultImagePoints": req.DefaultImagePoints, "general.defaultVideoPoints": req.DefaultVideoPoints, "general.defaultTextPoints": req.DefaultTextPoints, "general.defaultAudioPoints": req.DefaultAudioPoints} {
		if value != nil && *value > 0 {
			add(key, strconv.FormatInt(*value, 10))
		}
	}
	if req.MaintenanceMode != nil {
		add("general.maintenanceMode", strconv.FormatBool(*req.MaintenanceMode))
	}
	if err := h.Service.Repo.SaveSettings(rows); err != nil {
		Fail(c, 500, err)
		return
	}
	OK(c, gin.H{"saved": true})
}

func channelView(row model.AIChannel) gin.H {
	var models []string
	_ = json.Unmarshal([]byte(row.Models), &models)
	return gin.H{"id": row.ID, "name": row.Name, "baseUrl": row.BaseURL, "models": models, "enabled": row.Enabled, "apiKeyConfigured": row.APIKey != ""}
}

func (h Handler) PublicModels(c *gin.Context) {
	rows, err := h.Service.Repo.ListAIChannels(true)
	if err != nil {
		Fail(c, 500, err)
		return
	}
	result := make([]gin.H, 0, len(rows))
	for _, row := range rows {
		result = append(result, channelView(row))
	}
	OK(c, result)
}
func (h Handler) AdminAIChannels(c *gin.Context) {
	rows, err := h.Service.Repo.ListAIChannels(false)
	if err != nil {
		Fail(c, 500, err)
		return
	}
	result := make([]gin.H, 0, len(rows))
	for _, row := range rows {
		result = append(result, channelView(row))
	}
	OK(c, result)
}
func (h Handler) SaveAIChannel(c *gin.Context) {
	var req aiChannelRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		Fail(c, 400, err)
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	req.BaseURL = strings.TrimRight(strings.TrimSpace(req.BaseURL), "/")
	if req.Name == "" || req.BaseURL == "" {
		Fail(c, 400, errors.New("请填写渠道名称和 Base URL"))
		return
	}
	if _, err := url.ParseRequestURI(req.BaseURL); err != nil {
		Fail(c, 400, errors.New("Base URL 格式不正确"))
		return
	}
	row := model.AIChannel{}
	if req.ID != "" {
		existing, err := h.Service.Repo.AIChannelByID(req.ID)
		if err != nil {
			Fail(c, 404, errors.New("渠道不存在"))
			return
		}
		row = existing
	} else {
		row.ID = service.NewID()
	}
	row.Name = req.Name
	row.BaseURL = req.BaseURL
	row.Enabled = req.Enabled
	row.UpdatedBy = c.GetString(middleware.UserIDKey)
	if strings.TrimSpace(req.APIKey) != "" {
		row.APIKey = strings.TrimSpace(req.APIKey)
	}
	if req.Models != nil {
		raw, _ := json.Marshal(req.Models)
		row.Models = string(raw)
	}
	if row.APIKey == "" {
		Fail(c, 400, errors.New("请配置 API Key"))
		return
	}
	if row.Models == "" {
		row.Models = "[]"
	}
	if err := h.Service.Repo.SaveAIChannel(&row); err != nil {
		Fail(c, 400, errors.New("Base URL 已被其他渠道使用"))
		return
	}
	OK(c, channelView(row))
}
func (h Handler) DeleteAIChannel(c *gin.Context) {
	if err := h.Service.Repo.DeleteAIChannel(c.Param("id")); err != nil {
		Fail(c, 500, err)
		return
	}
	OK(c, gin.H{"deleted": true})
}
func (h Handler) FetchAIChannelModels(c *gin.Context) {
	row, err := h.Service.Repo.AIChannelByID(c.Param("id"))
	if err != nil {
		Fail(c, 404, errors.New("渠道不存在"))
		return
	}
	request, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, strings.TrimRight(row.BaseURL, "/")+"/models", nil)
	if err != nil {
		Fail(c, 400, err)
		return
	}
	request.Header.Set("Authorization", "Bearer "+row.APIKey)
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		Fail(c, 502, err)
		return
	}
	defer response.Body.Close()
	var payload struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.NewDecoder(response.Body).Decode(&payload); err != nil || response.StatusCode >= 400 {
		Fail(c, 502, errors.New("上游模型接口请求失败"))
		return
	}
	models := make([]string, 0, len(payload.Data))
	for _, item := range payload.Data {
		if strings.TrimSpace(item.ID) != "" {
			models = append(models, strings.TrimSpace(item.ID))
		}
	}
	raw, _ := json.Marshal(models)
	row.Models = string(raw)
	row.UpdatedBy = c.GetString(middleware.UserIDKey)
	if err := h.Service.Repo.SaveAIChannel(&row); err != nil {
		Fail(c, 500, err)
		return
	}
	OK(c, models)
}
func (h Handler) InternalAIChannel(c *gin.Context) {
	if c.ClientIP() != "127.0.0.1" && c.ClientIP() != "::1" {
		c.Status(http.StatusForbidden)
		return
	}
	target := strings.TrimSpace(c.Query("url"))
	rows, err := h.Service.Repo.ListAIChannels(true)
	if err != nil {
		c.Status(500)
		return
	}
	for _, row := range rows {
		base := strings.TrimRight(row.BaseURL, "/")
		if target == base || strings.HasPrefix(target, base+"/") {
			c.JSON(200, gin.H{"baseUrl": base, "apiKey": row.APIKey})
			return
		}
	}
	c.Status(http.StatusNotFound)
}
func atoi(value string) int     { n, _ := strconv.Atoi(value); return n }
func atoi64(value string) int64 { n, _ := strconv.ParseInt(value, 10, 64); return n }

func (h Handler) AdjustPoints(c *gin.Context) {
	var req adjustRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.Amount == 0 {
		if err == nil {
			err = strconv.ErrSyntax
		}
		Fail(c, 400, err)
		return
	}
	userID := strings.TrimSpace(c.Param("id"))
	entry := model.PointLedger{ID: service.NewID(), Type: "admin_adjustment", Remark: strings.TrimSpace(req.Remark), OperatorID: c.GetString(middleware.UserIDKey), IdempotencyKey: strings.TrimSpace(req.IdempotencyKey)}
	user, err := h.Service.Repo.AdjustPoints(userID, req.Amount, entry)
	if err != nil {
		Fail(c, 400, err)
		return
	}
	OK(c, user)
}
