package main

import (
	"context"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

const maxBodyBytes = 200 << 20

var hopHeaders = map[string]bool{
	"Connection":          true,
	"Keep-Alive":          true,
	"Proxy-Authenticate":  true,
	"Proxy-Authorization": true,
	"Te":                  true,
	"Trailer":             true,
	"Transfer-Encoding":   true,
	"Upgrade":             true,
	"Host":                true,
	"Origin":              true,
	"Referer":             true,
	"Cookie":              true,
	"Set-Cookie":          true,
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write([]byte("ok")) })
	mux.HandleFunc("/api/proxy", proxyHandler)

	addr := ":8787"
	if port := strings.TrimSpace(os.Getenv("PROXY_PORT")); port != "" {
		addr = ":" + port
	}
	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 15 * time.Second,
		IdleTimeout:       120 * time.Second,
	}
	log.Printf("proxy listening on %s", addr)
	if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}

func proxyHandler(w http.ResponseWriter, r *http.Request) {
	writeCors(w, r)
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if !isAllowedMethod(r.Method) {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	targetRaw := strings.TrimSpace(r.URL.Query().Get("url"))
	target, err := validateTarget(targetRaw)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	body := r.Body
	if body != nil {
		body = http.MaxBytesReader(w, body, maxBodyBytes)
	}
	ctx, cancel := context.WithTimeout(r.Context(), 35*time.Minute)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, r.Method, target.String(), body)
	if err != nil {
		http.Error(w, "create upstream request failed", http.StatusInternalServerError)
		return
	}
	copyRequestHeaders(req.Header, r.Header)
	req.Host = target.Host

	resp, err := upstreamHTTPClient.Do(req)
	if err != nil {
		http.Error(w, "upstream request failed: "+err.Error(), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	copyResponseHeaders(w.Header(), resp.Header)
	writeCors(w, r)
	w.WriteHeader(resp.StatusCode)
	if err := copyResponseBody(w, resp.Body); err != nil {
		log.Printf("copy response failed: %v", err)
	}
}

func copyResponseBody(w http.ResponseWriter, body io.Reader) error {
	flusher, _ := w.(http.Flusher)
	buf := make([]byte, 32*1024)
	for {
		n, readErr := body.Read(buf)
		if n > 0 {
			if _, err := w.Write(buf[:n]); err != nil {
				return err
			}
			if flusher != nil {
				flusher.Flush()
			}
		}
		if readErr != nil {
			if errors.Is(readErr, io.EOF) {
				return nil
			}
			return readErr
		}
	}
}

func isAllowedMethod(method string) bool {
	switch method {
	case http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		return true
	default:
		return false
	}
}

func validateTarget(raw string) (*url.URL, error) {
	if raw == "" {
		return nil, errors.New("missing url")
	}
	u, err := url.Parse(raw)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return nil, errors.New("invalid url")
	}
	if u.Scheme != "https" && u.Scheme != "http" {
		return nil, errors.New("only http/https url is allowed")
	}
	host := strings.ToLower(u.Hostname())
	if host == "localhost" || host == "127.0.0.1" || host == "0.0.0.0" || host == "::1" {
		return nil, errors.New("local target is not allowed")
	}
	ips, err := net.LookupIP(host)
	if err != nil {
		return nil, errors.New("resolve target failed")
	}
	for _, ip := range ips {
		if isPrivateIP(ip) {
			return nil, errors.New("private target is not allowed")
		}
	}
	return u, nil
}

var upstreamHTTPClient = &http.Client{
	Timeout: 35 * time.Minute,
	CheckRedirect: func(req *http.Request, _ []*http.Request) error {
		_, err := validateTarget(req.URL.String())
		return err
	},
	Transport: &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          100,
		MaxIdleConnsPerHost:   20,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   20 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	},
}

func copyRequestHeaders(dst, src http.Header) {
	for key, values := range src {
		canonical := http.CanonicalHeaderKey(key)
		if hopHeaders[canonical] || strings.HasPrefix(strings.ToLower(canonical), "sec-") {
			continue
		}
		for _, value := range values {
			dst.Add(canonical, value)
		}
	}
}

func copyResponseHeaders(dst, src http.Header) {
	for key, values := range src {
		canonical := http.CanonicalHeaderKey(key)
		if hopHeaders[canonical] || strings.EqualFold(canonical, "Access-Control-Allow-Origin") || strings.EqualFold(canonical, "Access-Control-Allow-Headers") || strings.EqualFold(canonical, "Access-Control-Allow-Methods") {
			continue
		}
		for _, value := range values {
			dst.Add(canonical, value)
		}
	}
}

func writeCors(w http.ResponseWriter, r *http.Request) {
	h := w.Header()
	h.Set("Access-Control-Allow-Origin", "*")
	h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
	if requestHeaders := r.Header.Get("Access-Control-Request-Headers"); requestHeaders != "" {
		h.Set("Access-Control-Allow-Headers", requestHeaders)
	} else {
		h.Set("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, OpenAI-Organization, OpenAI-Project, X-Requested-With, X-Goog-Api-Key")
	}
	h.Set("Access-Control-Expose-Headers", "Content-Type, Content-Length, X-Request-Id")
	h.Add("Vary", "Origin")
	h.Add("Vary", "Access-Control-Request-Headers")
}

func isPrivateIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsPrivate() || ip.IsUnspecified() {
		return true
	}
	if ip4 := ip.To4(); ip4 != nil {
		return ip4[0] == 169 && ip4[1] == 254
	}
	return false
}
