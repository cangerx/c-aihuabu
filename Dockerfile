# 构建 Vite 静态前端产物。
FROM oven/bun:1.3.13 AS web-build

WORKDIR /app/web
COPY web/package.json web/bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache bun install --frozen-lockfile --cache-dir=/root/.bun/install/cache
COPY VERSION /app/VERSION
COPY CHANGELOG.md /app/CHANGELOG.md
COPY web ./
RUN bun run build

# 运行镜像：只提供静态文件；AI 请求由浏览器前台直连用户自己的接口。
FROM nginx:1.29-alpine

COPY --from=web-build /app/web/dist /usr/share/nginx/html
RUN cat > /etc/nginx/conf.d/default.conf <<'NGINX'
server {
    listen 3000;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(?:js|css|png|jpg|jpeg|gif|svg|webp|ico|woff2?)$ {
        try_files $uri =404;
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX

EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
