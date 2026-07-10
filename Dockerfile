# 构建 Vite 静态前端产物。
FROM oven/bun:1.3.13 AS web-build

WORKDIR /app/web
COPY web/package.json web/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --cache-dir=/root/.bun/install/cache
COPY VERSION /app/VERSION
COPY CHANGELOG.md /app/CHANGELOG.md
COPY web ./
RUN bun run build

# 构建同域 AI 请求代理。
FROM golang:1.22-alpine AS proxy-build

WORKDIR /app/proxy
COPY proxy/go.mod ./
COPY proxy/*.go ./
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /c-aihuabu-proxy .

# 运行镜像：nginx 提供静态文件，Go 代理提供可选同域 AI 转发。
FROM nginx:1.29-alpine

COPY --from=web-build /app/web/dist /usr/share/nginx/html
COPY --from=proxy-build /c-aihuabu-proxy /usr/local/bin/c-aihuabu-proxy
RUN cat > /etc/nginx/conf.d/default.conf <<'NGINX'
server {
    listen 3000;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    client_max_body_size 200m;
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_proxied any;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    location = /api/proxy {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_request_buffering off;
        proxy_buffering off;
        proxy_read_timeout 2100s;
        proxy_send_timeout 2100s;
        # 保留浏览器访问 Host；外层若改写 Host，需透传 X-Forwarded-Host 为公网域名。
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Host $http_x_forwarded_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/uploads/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_request_buffering off;
        proxy_read_timeout 600s;
        proxy_send_timeout 600s;
        proxy_set_header Host $http_host;
        proxy_set_header X-Forwarded-Host $http_x_forwarded_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /healthz {
        proxy_pass http://127.0.0.1:8787;
    }

    location = /index.html {
        add_header Cache-Control "no-store";
    }

    location / {
        add_header Cache-Control "no-store";
        try_files $uri $uri/ /index.html;
    }

    location ~* \.js$ {
        try_files $uri @chunk_reload;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }

    location @chunk_reload {
        default_type application/javascript;
        add_header Cache-Control "no-store";
        return 200 'const key="infinite-canvas:missing-chunk-reload:"+location.pathname+":"+import.meta.url;try{if(!sessionStorage.getItem(key)){sessionStorage.setItem(key,"1");location.reload();}}catch{location.reload();}export function AppConfigModal(){return null;}export default function MissingChunk(){return null;}';
    }

    location ~* \.(?:css|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$ {
        try_files $uri =404;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

EXPOSE 3000
CMD ["/bin/sh", "-c", "/usr/local/bin/c-aihuabu-proxy & exec nginx -g 'daemon off;'"]
