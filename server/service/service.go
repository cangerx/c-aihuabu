package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"
	"time"

	"c-aihuabu-server/model"
	"c-aihuabu-server/repository"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	Repo      repository.Repository
	JWTSecret []byte
	TokenTTL  time.Duration
}

func (s Service) Register(email, password, nickname string) (model.User, string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if !strings.Contains(email, "@") {
		return model.User{}, "", errors.New("邮箱格式不正确")
	}
	if len(password) < 8 {
		return model.User{}, "", errors.New("密码至少需要 8 位")
	}
	if strings.TrimSpace(nickname) == "" {
		nickname = strings.Split(email, "@")[0]
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return model.User{}, "", err
	}
	user := model.User{ID: NewUserID(), Email: email, Nickname: strings.TrimSpace(nickname), PasswordHash: string(hash), Role: "user", Status: "active"}
	if err := s.Repo.CreateUser(&user); err != nil {
		return model.User{}, "", errors.New("该邮箱已注册")
	}
	token, err := s.Token(user)
	return user, token, err
}

func (s Service) Login(email, password string) (model.User, string, error) {
	user, err := s.Repo.UserByEmail(strings.ToLower(strings.TrimSpace(email)))
	if err != nil || bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)) != nil {
		return model.User{}, "", errors.New("邮箱或密码错误")
	}
	if user.Status != "active" {
		return model.User{}, "", errors.New("账号已被禁用")
	}
	token, err := s.Token(user)
	return user, token, err
}

func (s Service) Token(user model.User) (string, error) {
	now := time.Now()
	claims := jwt.MapClaims{"sub": user.ID, "role": user.Role, "iat": now.Unix(), "exp": now.Add(s.TokenTTL).Unix()}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(s.JWTSecret)
}

func (s Service) ParseToken(raw string) (string, string, error) {
	token, err := jwt.Parse(raw, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("无效的签名算法")
		}
		return s.JWTSecret, nil
	})
	if err != nil || !token.Valid {
		return "", "", errors.New("登录已失效")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", "", errors.New("登录已失效")
	}
	userID, _ := claims["sub"].(string)
	role, _ := claims["role"].(string)
	if userID == "" {
		return "", "", errors.New("登录已失效")
	}
	return userID, role, nil
}

func NewID() string {
	bytes := make([]byte, 16)
	_, _ = rand.Read(bytes)
	return hex.EncodeToString(bytes)
}

// NewUserID returns a compact numeric identifier for display and support workflows.
func NewUserID() string {
	bytes := make([]byte, 4)
	if _, err := rand.Read(bytes); err != nil {
		return "10000"
	}
	n := (uint32(bytes[0])<<24 | uint32(bytes[1])<<16 | uint32(bytes[2])<<8 | uint32(bytes[3])) % 90000
	return strconv.FormatUint(uint64(n+10000), 10)
}
