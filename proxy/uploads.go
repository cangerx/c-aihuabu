package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

const (
	defaultUploadDir     = "/data/uploads/references"
	defaultUploadTTLDays = 15
	defaultMaxDirBytes   = 5 << 30
	maxImageUploadBytes  = 30 << 20
	maxVideoUploadBytes  = 50 << 20
	maxAudioUploadBytes  = 15 << 20
	maxMultipartMemory   = 64 << 20
)

type uploadResponse struct {
	Code int               `json:"code"`
	Msg  string            `json:"msg"`
	Data map[string]string `json:"data,omitempty"`
}

func registerUploadRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/uploads/references", uploadReferencesHandler)
	mux.HandleFunc("/api/uploads/references/", serveReferenceHandler)
	go startUploadCleanupLoop()
}

func uploadReferencesHandler(w http.ResponseWriter, r *http.Request) {
	writeCors(w, r)
	if !isSameOrigin(r) {
		http.Error(w, "origin is not allowed", http.StatusForbidden)
		return
	}
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxVideoUploadBytes+maxMultipartMemory)
	if err := r.ParseMultipartForm(maxMultipartMemory); err != nil {
		writeUploadJSON(w, http.StatusBadRequest, uploadResponse{Code: 400, Msg: "上传表单解析失败"})
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeUploadJSON(w, http.StatusBadRequest, uploadResponse{Code: 400, Msg: "缺少上传文件"})
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	if contentType == "" || contentType == "application/octet-stream" {
		contentType = detectMimeFromName(header.Filename)
	}
	limit, label := uploadLimit(contentType)
	if limit <= 0 {
		writeUploadJSON(w, http.StatusBadRequest, uploadResponse{Code: 400, Msg: "仅支持上传图片、视频或音频参考素材"})
		return
	}
	if header.Size > 0 && header.Size > limit {
		writeUploadJSON(w, http.StatusRequestEntityTooLarge, uploadResponse{Code: 413, Msg: fmt.Sprintf("%s不能超过 %dMB", label, limit>>20)})
		return
	}

	ext := mediaExtension(contentType, header.Filename)
	if ext == "" {
		writeUploadJSON(w, http.StatusBadRequest, uploadResponse{Code: 400, Msg: "不支持的文件扩展名"})
		return
	}

	dir := uploadDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		writeUploadJSON(w, http.StatusInternalServerError, uploadResponse{Code: 500, Msg: "创建上传目录失败"})
		return
	}
	name := fmt.Sprintf("%d-%s.%s", time.Now().UnixMilli(), randomID(10), ext)
	target := filepath.Join(dir, name)
	out, err := os.OpenFile(target, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o644)
	if err != nil {
		writeUploadJSON(w, http.StatusInternalServerError, uploadResponse{Code: 500, Msg: "保存上传文件失败"})
		return
	}
	written, copyErr := io.Copy(out, io.LimitReader(file, limit+1))
	closeErr := out.Close()
	if copyErr != nil || closeErr != nil {
		_ = os.Remove(target)
		writeUploadJSON(w, http.StatusInternalServerError, uploadResponse{Code: 500, Msg: "写入上传文件失败"})
		return
	}
	if written > limit {
		_ = os.Remove(target)
		writeUploadJSON(w, http.StatusRequestEntityTooLarge, uploadResponse{Code: 413, Msg: fmt.Sprintf("%s不能超过 %dMB", label, limit>>20)})
		return
	}

	publicURL := publicUploadURL(r, name)
	if publicURL == "" {
		_ = os.Remove(target)
		writeUploadJSON(w, http.StatusInternalServerError, uploadResponse{Code: 500, Msg: "未配置 C_AI_PUBLIC_BASE_URL，无法生成公网参考素材地址"})
		return
	}
	go cleanupUploadDir()
	writeUploadJSON(w, http.StatusOK, uploadResponse{Code: 0, Msg: "ok", Data: map[string]string{"url": publicURL, "name": name}})
}

func serveReferenceHandler(w http.ResponseWriter, r *http.Request) {
	writeCors(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	name := strings.TrimPrefix(r.URL.Path, "/api/uploads/references/")
	name = filepath.Base(name)
	if !isSafeUploadName(name) {
		http.NotFound(w, r)
		return
	}
	path := filepath.Join(uploadDir(), name)
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		http.NotFound(w, r)
		return
	}
	file, err := os.Open(path)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer file.Close()

	w.Header().Set("Content-Type", contentTypeByName(name))
	w.Header().Set("Content-Length", strconv.FormatInt(info.Size(), 10))
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Cache-Control", "public, max-age=604800, immutable")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, name))
	w.Header().Set("X-Content-Type-Options", "nosniff")
	if r.Method == http.MethodHead {
		w.WriteHeader(http.StatusOK)
		return
	}
	http.ServeContent(w, r, name, info.ModTime(), file)
}

func startUploadCleanupLoop() {
	cleanupUploadDir()
	ticker := time.NewTicker(time.Hour)
	for range ticker.C {
		cleanupUploadDir()
	}
}

func cleanupUploadDir() {
	dir := uploadDir()
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}
	ttl := uploadTTL()
	cutoff := time.Now().Add(-ttl)
	type fileInfo struct {
		path    string
		size    int64
		modTime time.Time
	}
	files := make([]fileInfo, 0, len(entries))
	var total int64
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		path := filepath.Join(dir, entry.Name())
		if info.ModTime().Before(cutoff) {
			if err := os.Remove(path); err == nil {
				log.Printf("upload cleanup expired: %s", entry.Name())
			}
			continue
		}
		files = append(files, fileInfo{path: path, size: info.Size(), modTime: info.ModTime()})
		total += info.Size()
	}
	maxBytes := uploadMaxDirBytes()
	for total > maxBytes {
		oldest := -1
		for i, file := range files {
			if oldest < 0 || file.modTime.Before(files[oldest].modTime) {
				oldest = i
			}
		}
		if oldest < 0 {
			break
		}
		if err := os.Remove(files[oldest].path); err == nil {
			total -= files[oldest].size
			log.Printf("upload cleanup capacity: %s", filepath.Base(files[oldest].path))
		}
		files = append(files[:oldest], files[oldest+1:]...)
	}
}

func uploadDir() string {
	if value := strings.TrimSpace(os.Getenv("C_AI_UPLOAD_DIR")); value != "" {
		return value
	}
	return defaultUploadDir
}

func uploadTTL() time.Duration {
	days := defaultUploadTTLDays
	if value := strings.TrimSpace(os.Getenv("C_AI_UPLOAD_TTL_DAYS")); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil && parsed > 0 {
			days = parsed
		}
	}
	return time.Duration(days) * 24 * time.Hour
}

func uploadMaxDirBytes() int64 {
	if value := strings.TrimSpace(os.Getenv("C_AI_UPLOAD_MAX_DIR_BYTES")); value != "" {
		if parsed, err := strconv.ParseInt(value, 10, 64); err == nil && parsed > 0 {
			return parsed
		}
	}
	return defaultMaxDirBytes
}

func publicUploadURL(r *http.Request, name string) string {
	base := strings.TrimRight(strings.TrimSpace(os.Getenv("C_AI_PUBLIC_BASE_URL")), "/")
	if base == "" {
		// 回退：用请求 Host，但非 HTTPS 公网时上游可能不可读。
		scheme := "https"
		if r.TLS == nil && r.Header.Get("X-Forwarded-Proto") != "https" {
			if xf := r.Header.Get("X-Forwarded-Proto"); xf != "" {
				scheme = xf
			} else {
				scheme = "http"
			}
		}
		host := strings.TrimSpace(r.Header.Get("X-Forwarded-Host"))
		if host == "" {
			host = strings.TrimSpace(r.Host)
		}
		if host == "" || isInternalHost(host) {
			return ""
		}
		base = scheme + "://" + host
	}
	return base + "/api/uploads/references/" + name
}

func uploadLimit(mimeType string) (int64, string) {
	lower := strings.ToLower(mimeType)
	switch {
	case strings.HasPrefix(lower, "image/"):
		return maxImageUploadBytes, "图片"
	case strings.HasPrefix(lower, "video/"):
		return maxVideoUploadBytes, "视频"
	case strings.HasPrefix(lower, "audio/"):
		return maxAudioUploadBytes, "音频"
	default:
		return 0, ""
	}
}

func mediaExtension(mimeType, fileName string) string {
	lower := strings.ToLower(mimeType)
	switch {
	case strings.Contains(lower, "jpeg"):
		return "jpg"
	case strings.Contains(lower, "webp"):
		return "webp"
	case strings.Contains(lower, "gif"):
		return "gif"
	case strings.Contains(lower, "png"):
		return "png"
	case strings.Contains(lower, "quicktime"):
		return "mov"
	case strings.Contains(lower, "mp4"):
		return "mp4"
	case strings.Contains(lower, "mpeg") || strings.Contains(lower, "mp3"):
		return "mp3"
	case strings.Contains(lower, "wav"):
		return "wav"
	}
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(fileName), "."))
	if isAllowedExt(ext) {
		return ext
	}
	return ""
}

func detectMimeFromName(fileName string) string {
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(fileName), "."))
	return contentTypeByName("x." + ext)
}

func contentTypeByName(name string) string {
	lower := strings.ToLower(name)
	switch {
	case strings.HasSuffix(lower, ".jpg"), strings.HasSuffix(lower, ".jpeg"):
		return "image/jpeg"
	case strings.HasSuffix(lower, ".webp"):
		return "image/webp"
	case strings.HasSuffix(lower, ".gif"):
		return "image/gif"
	case strings.HasSuffix(lower, ".mp4"):
		return "video/mp4"
	case strings.HasSuffix(lower, ".mov"):
		return "video/quicktime"
	case strings.HasSuffix(lower, ".mp3"):
		return "audio/mpeg"
	case strings.HasSuffix(lower, ".wav"):
		return "audio/wav"
	default:
		return "image/png"
	}
}

func isSafeUploadName(name string) bool {
	if name == "" || strings.Contains(name, "..") || strings.ContainsAny(name, `/\`) {
		return false
	}
	dot := strings.LastIndex(name, ".")
	if dot <= 0 || dot >= len(name)-1 {
		return false
	}
	base, ext := name[:dot], strings.ToLower(name[dot+1:])
	if !isAllowedExt(ext) {
		return false
	}
	for _, ch := range base {
		if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '-' || ch == '_' {
			continue
		}
		return false
	}
	return true
}

func isAllowedExt(ext string) bool {
	switch ext {
	case "png", "jpg", "jpeg", "webp", "gif", "mp4", "mov", "mp3", "wav":
		return true
	default:
		return false
	}
}

func randomID(n int) string {
	buf := make([]byte, (n+1)/2)
	if _, err := rand.Read(buf); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(buf)[:n]
}

func writeUploadJSON(w http.ResponseWriter, status int, payload uploadResponse) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
