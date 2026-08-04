#!/usr/bin/env bash
# 一键部署到任意新服务器。本地构建镜像 → 传输 → 启动。
# 服务器只需要有 Docker，不需要任何构建环境。
#
# 用法:
#   ./deploy-remote.sh root@IP                       默认端口22，监听9527
#   ./deploy-remote.sh root@IP -p 2222               指定 SSH 端口
#   PORT=8080 DOMAIN=https://x.com ./deploy-remote.sh root@IP
#
# 环境变量:
#   PORT            容器对外端口（默认 9527）
#   DOMAIN          公网地址，用于素材上传回调（可选）
#   REMOTE_DIR      服务器项目目录（默认 /opt/c-aihuabu）
#   CONTAINER       容器名（默认 infinite-canvas）
#   SSHPASS         SSH 密码（也可用 ssh-key 免密）
set -euo pipefail
cd "$(dirname "$0")"

if [ $# -lt 1 ]; then
    cat <<USAGE
用法: ./deploy-remote.sh user@host [-p ssh_port]

示例:
  ./deploy-remote.sh root@1.2.3.4
  ./deploy-remote.sh root@1.2.3.4 -p 23411
  PORT=8080 DOMAIN=https://ai.example.com ./deploy-remote.sh root@1.2.3.4

环境变量:
  PORT=9527          服务端口
  DOMAIN=            公网域名（含 https://）
  REMOTE_DIR=        服务器目录（默认 /opt/c-aihuabu）
  CONTAINER=         容器名（默认 infinite-canvas）
  SSHPASS=           SSH 密码（留空则用 key 认证）
USAGE
    exit 1
fi

SSH_TARGET="$1"; shift
SSH_EXTRA=("$@")

PORT="${PORT:-9527}"
DOMAIN="${DOMAIN:-}"
REMOTE_DIR="${REMOTE_DIR:-/opt/c-aihuabu}"
CONTAINER="${CONTAINER:-infinite-canvas}"
TMP_TAR="/tmp/c-aihuabu-image.tar.gz"

# SSH/SCP 封装：有 SSHPASS 就用密码，否则走 key
_ssh() {
    if [ -n "${SSHPASS:-}" ]; then
        sshpass -p "$SSHPASS" ssh -o StrictHostKeyChecking=accept-new "${SSH_EXTRA[@]}" "$SSH_TARGET" "$@"
    else
        ssh -o StrictHostKeyChecking=accept-new "${SSH_EXTRA[@]}" "$SSH_TARGET" "$@"
    fi
}
_scp() {
    local src="$1" dst="$2"
    if [ -n "${SSHPASS:-}" ]; then
        sshpass -p "$SSHPASS" scp "${SSH_EXTRA[@]}" "$src" "$SSH_TARGET:$dst"
    else
        scp "${SSH_EXTRA[@]}" "$src" "$SSH_TARGET:$dst"
    fi
}

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
die() { printf '\033[1;31m[x] %s\033[0m\n' "$1" >&2; exit 1; }

log "检查服务器环境"
_ssh "docker --version" || die "服务器未安装 Docker"

log "本地构建镜像 (linux/amd64)"
docker build --platform linux/amd64 -t c-aihuabu:local .

log "导出镜像"
docker save c-aihuabu:local | gzip > "$TMP_TAR"
echo "镜像大小: $(du -h "$TMP_TAR" | cut -f1)"

log "传输到服务器 $SSH_TARGET:$REMOTE_DIR/"
_ssh "mkdir -p $REMOTE_DIR/data/uploads/references"
_scp "$TMP_TAR" "$REMOTE_DIR/image.tar.gz"
rm -f "$TMP_TAR"

log "服务器部署"
_ssh bash -s "$REMOTE_DIR" "$PORT" "$DOMAIN" "$CONTAINER" <<'REMOTE'
set -e
DIR="$1"; PORT="$2"; DOMAIN="$3"; CONTAINER="$4"
cd "$DIR"

echo "加载镜像..."
docker load < image.tar.gz
rm -f image.tar.gz

cat > docker-compose.yml <<EOF
services:
  app:
    image: c-aihuabu:local
    container_name: $CONTAINER
    ports:
      - "$PORT:3000"
    environment:
      C_AI_PUBLIC_BASE_URL: $DOMAIN
      C_AI_UPLOAD_DIR: /data/uploads/references
      C_AI_UPLOAD_TTL_DAYS: 15
    volumes:
      - ./data/uploads:/data/uploads
    restart: unless-stopped
EOF

docker compose up -d --force-recreate

echo "等待服务就绪..."
for i in $(seq 1 30); do
    if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
        ver=$(docker exec "$CONTAINER" cat /app/VERSION 2>/dev/null || echo unknown)
        echo ""
        echo "========================================="
        echo "  部署成功!"
        echo "  版本: $ver"
        echo "  地址: http://服务器IP:$PORT"
        echo "========================================="
        echo ""
        echo "后续:"
        echo "  1. Nginx 反代到 127.0.0.1:$PORT（透传 Host）"
        echo "  2. 打开站点 → 齿轮配置 → 填渠道 Key"
        echo ""
        echo "常用命令:"
        echo "  docker logs -f $CONTAINER"
        echo "  docker compose -f $DIR/docker-compose.yml down"
        exit 0
    fi
    sleep 1
done
echo "健康检查超时"
docker logs --tail 20 "$CONTAINER"
exit 1
REMOTE

log "完成"
