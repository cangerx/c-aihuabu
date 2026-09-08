package payment

import (
	"bytes"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"c-aihuabu-server/config"
	"c-aihuabu-server/model"
)

type TianQue struct {
	Config config.TianQueConfig
	Client *http.Client
}

func (p TianQue) CreateOrder(order model.RechargeOrder, method, clientIP string) (string, string, map[string]any, error) {
	data := compact(map[string]any{"mno": p.Config.MNO, "subMechId": p.Config.SubMechID, "ordNo": order.OrderNo, "amt": fmt.Sprintf("%.2f", float64(order.AmountCent)/100), "payType": strings.ToUpper(method), "subject": order.PackageName, "tradeSource": "01", "trmIp": clientIP, "notifyUrl": p.Config.NotifyURL})
	resp, err := p.call("/order/activeScan", data)
	if err != nil {
		return "", "", nil, err
	}
	value := responseData(resp)
	if code := stringValue(resp["code"]); code != "" && code != "0000" {
		return "", "", resp, fmt.Errorf("随行付网关错误：%s", code)
	}
	qr := stringValue(value["payUrl"])
	if qr == "" {
		qr = stringValue(value["qrCode"])
	}
	if qr == "" {
		return "", "", resp, errors.New("随行付下单响应缺少二维码")
	}
	return qr, firstString(value, "uuid", "sxfUuid"), resp, nil
}

func (p TianQue) VerifyNotify(payload map[string]any) (map[string]any, error) {
	if stringValue(payload["code"]) != "0000" {
		return nil, errors.New("随行付回调网关状态异常")
	}
	if strings.TrimSpace(p.Config.PublicKey) == "" || stringValue(payload["sign"]) == "" {
		return nil, errors.New("随行付回调缺少验签配置")
	}
	data := responseData(payload)
	content := signContent(payload)
	if err := verify(content, stringValue(payload["sign"]), p.Config.PublicKey, p.Config.SignType); err != nil {
		return nil, err
	}
	return data, nil
}

func (p TianQue) call(path string, reqData map[string]any) (map[string]any, error) {
	if !p.Config.Enabled {
		return nil, errors.New("随行付支付渠道未启用")
	}
	bean := map[string]any{"signType": p.Config.SignType, "version": p.Config.Version, "orgId": p.Config.OrgID, "reqId": randomID(), "timestamp": time.Now().Format("20060102150405"), "reqData": reqData}
	content := signContent(bean)
	signature, err := sign(content, p.Config.PrivateKey, p.Config.SignType)
	if err != nil {
		return nil, err
	}
	bean["sign"] = signature
	host := p.Config.Host
	if !p.Config.Sandbox && p.Config.ProductionHost != "" {
		host = p.Config.ProductionHost
	}
	body, _ := json.Marshal(bean)
	client := p.Client
	if client == nil {
		client = http.DefaultClient
	}
	response, err := client.Post(strings.TrimRight(host, "/")+path, "application/json;charset=UTF-8", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	var result map[string]any
	if err := json.NewDecoder(response.Body).Decode(&result); err != nil {
		return nil, err
	}
	return result, nil
}

func signContent(values map[string]any) string {
	keys := make([]string, 0, len(values))
	for key := range values {
		if key != "sign" {
			keys = append(keys, key)
		}
	}
	sort.Strings(keys)
	parts := make([]string, 0, len(keys))
	for _, key := range keys {
		value := values[key]
		if value == nil || value == "" {
			continue
		}
		if nested, ok := value.(map[string]any); ok {
			encoded, _ := json.Marshal(nested)
			parts = append(parts, key+"="+string(encoded))
		} else {
			parts = append(parts, key+"="+fmt.Sprint(value))
		}
	}
	return strings.Join(parts, "&")
}
func compact(values map[string]any) map[string]any {
	for key, value := range values {
		if value == nil || value == "" {
			delete(values, key)
		}
	}
	return values
}
func responseData(resp map[string]any) map[string]any {
	if data, ok := resp["respData"].(map[string]any); ok {
		return data
	}
	if data, ok := resp["data"].(map[string]any); ok {
		return data
	}
	return resp
}
func stringValue(value any) string { text, _ := value.(string); return strings.TrimSpace(text) }
func firstString(values map[string]any, keys ...string) string {
	for _, key := range keys {
		if value := stringValue(values[key]); value != "" {
			return value
		}
	}
	return ""
}
func randomID() string {
	data := make([]byte, 16)
	_, _ = rand.Read(data)
	return fmt.Sprintf("%x", data)
}

func sign(content, rawKey, signType string) (string, error) {
	key, err := privateKey(rawKey)
	if err != nil {
		return "", err
	}
	var digest []byte
	var hash crypto.Hash
	if signType == "RSA2" {
		sum := sha256.Sum256([]byte(content))
		digest = sum[:]
		hash = crypto.SHA256
	} else {
		sum := sha1.Sum([]byte(content))
		digest = sum[:]
		hash = crypto.SHA1
	}
	signature, err := rsa.SignPKCS1v15(rand.Reader, key, hash, digest)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}
func verify(content, rawSignature, rawKey, signType string) error {
	key, err := publicKey(rawKey)
	if err != nil {
		return err
	}
	signature, err := base64.StdEncoding.DecodeString(rawSignature)
	if err != nil {
		return err
	}
	var digest []byte
	var hash crypto.Hash
	if signType == "RSA2" {
		sum := sha256.Sum256([]byte(content))
		digest = sum[:]
		hash = crypto.SHA256
	} else {
		sum := sha1.Sum([]byte(content))
		digest = sum[:]
		hash = crypto.SHA1
	}
	return rsa.VerifyPKCS1v15(key, hash, digest, signature)
}

func privateKey(raw string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(formatKey(raw, "PRIVATE KEY")))
	if block == nil {
		return nil, errors.New("随行付商户私钥格式无效")
	}
	if key, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if rsaKey, ok := key.(*rsa.PrivateKey); ok {
			return rsaKey, nil
		}
	}
	if key, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return key, nil
	}
	return nil, errors.New("随行付商户私钥不是 RSA PKCS8/PKCS1")
}
func publicKey(raw string) (*rsa.PublicKey, error) {
	block, _ := pem.Decode([]byte(formatKey(raw, "PUBLIC KEY")))
	if block == nil {
		return nil, errors.New("随行付平台公钥格式无效")
	}
	if key, err := x509.ParsePKIXPublicKey(block.Bytes); err == nil {
		if rsaKey, ok := key.(*rsa.PublicKey); ok {
			return rsaKey, nil
		}
	}
	if key, err := x509.ParsePKCS1PublicKey(block.Bytes); err == nil {
		return key, nil
	}
	return nil, errors.New("随行付平台公钥不是 RSA 公钥")
}
func formatKey(raw, label string) string {
	raw = strings.TrimSpace(raw)
	if strings.Contains(raw, "BEGIN") {
		return raw
	}
	return "-----BEGIN " + label + "-----\n" + raw + "\n-----END " + label + "-----"
}
