#!/usr/bin/env bash
# 本地构建镜像 → 传输到远程服务器 → 启动容器。服务器不需要构建环境。
#
# 用法：
#   ./deploy-remote.sh user@host              使用默认值
#   ./deploy-remote.sh root@1.2.3.4 -p 2222  指定 SSH 端口
#
# 环境变量（可选）：
#   C_AI_HOST_PORT          服务器监听端口（默认 9527）
#   C_AI_PUBLIC_BASE_URL    公网域名
#   REMOTE_DIR              服务器项目目录（默认 /www/wwwroot/c-aihuabu）
#   PLATFORM                目标平台（默认 linux/amd64）
set -euo pipefail

if [ $# -lt 1 ]; then
    echo "用法: ./deploy-remote.sh user@host [-p ssh_port]"
    exit 1
fi

SSH_TARGET="$1"; shift
SSH_OPTS=("$@")
PLATFORM="${PLATFORM:-linux/amd64}"
IMAGE_NAME="c-aihuabu:local"
TAR_FILE="/tmp/c-aihuabu-image.tar.gz"
REMOTE_DIR="${REMOTE_DIR:-/www/wwwroot/c-aihuabu}"
PORT="${C_AI_HOST_PORT:-9527}"
PUBLIC_BASE_URL="${C_AI_PUBLIC_BASE_URL:-}"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

log "本地构建镜像（平台 $PLATFORM）"
docker build --platform "$PLATFORM" -t "$IMAGE_NAME" .

log "导出镜像（压缩中…）"
docker save "$IMAGE_NAME" | gzip > "$TAR_FILE"
size=$(du -h "$TAR_FILE" | cut -f1)
echo "镜像包大小: $size"

log "传输到 $SSH_TARGET:$REMOTE_DIR/"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" "mkdir -p $REMOTE_DIR"
scp "${SSH_OPTS[@]}" "$TAR_FILE" "$SSH_TARGET:$REMOTE_DIR/image.tar.gz"

log "服务器加载镜像并启动"
ssh "${SSH_OPTS[@]}" "$SSH_TARGET" bash -s "$PORT" "$PUBLIC_BASE_URL" "$REMOTE_DIR" <<'REMOTE'
set -euo pipefail
PORT="$1"; PUBLIC_BASE_URL="$2"; DIR="$3"
cd "$DIR"

echo "加载镜像..."
docker load < image.tar.gz
rm -f image.tar.gz

# 写 docker-compose.yml（纯拉起，不构建）
cat > docker-compose.yml <<EOF
services:
  app:
    image: c-aihuabu:local
    container_name: infinite-canvas
    ports:
      - "${PORT}:3000"
    environment:
      C_AI_PUBLIC_BASE_URL: ${PUBLIC_BASE_URL}
      C_AI_UPLOAD_DIR: /data/uploads/references
      C_AI_UPLOAD_TTL_DAYS: 15
    volumes:
      - ./data/uploads:/data/uploads
    restart: unless-stopped
EOF

mkdir -p data/uploads/references
docker compose up -d --force-recreate

echo ""
echo "等待服务就绪..."
for i in $(seq 1 30); do
    if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
        echo "部署成功! http://127.0.0.1:$PORT"
        exit 0
    fi
    sleep 1
done
echo "健康检查超时，查看日志: docker logs infinite-canvas"
exit 1
REMOTE

rm -f "$TAR_FILE"
log "完成"
