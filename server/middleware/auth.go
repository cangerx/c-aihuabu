package middleware

import (
	"net/http"
	"strings"

	"c-aihuabu-server/service"
	"github.com/gin-gonic/gin"
)

const UserIDKey = "userId"

func Auth(s service.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		raw := strings.TrimSpace(strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer "))
		userID, role, err := s.ParseToken(raw)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"code": 401, "data": nil, "msg": err.Error()})
			return
		}
		c.Set(UserIDKey, userID)
		c.Set("role", role)
		c.Next()
	}
}

func Admin() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.GetString("role") != "admin" {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"code": 403, "data": nil, "msg": "需要管理员权限"})
			return
		}
		c.Next()
	}
}
