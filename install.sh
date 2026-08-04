#!/usr/bin/env bash
# 无限画布一键安装脚本。新服务器执行即可完成全部部署。
# curl -fsSL http://43.139.15.89:23413/install.sh | bash
# 或指定参数:
# curl -fsSL http://43.139.15.89:23413/install.sh | PORT=8080 DOMAIN=https://x.com bash
set -euo pipefail

REGISTRY="43.139.15.89:23413"
IMAGE="$REGISTRY/c-aihuabu:latest"
PORT="${PORT:-9527}"
DOMAIN="${DOMAIN:-}"
CONTAINER="${CONTAINER:-infinite-canvas}"
INSTALL_DIR="${INSTALL_DIR:-/opt/c-aihuabu}"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$1"; }
die() { printf '\033[1;31m[x] %s\033[0m\n' "$1" >&2; exit 1; }

log "检查环境"
[ "$(id -u)" = "0" ] || die "请用 root 执行"
command -v docker >/dev/null 2>&1 || {
    log "安装 Docker"
    curl -fsSL https://get.docker.com | sh
    systemctl enable --now docker
}
docker info >/dev/null 2>&1 || die "Docker 未运行"

log "配置镜像源"
DAEMON_JSON="/etc/docker/daemon.json"
if [ -f "$DAEMON_JSON" ]; then
    if ! grep -q "$REGISTRY" "$DAEMON_JSON"; then
        # 追加 insecure-registries
        if grep -q "insecure-registries" "$DAEMON_JSON"; then
            sed -i "s|\"insecure-registries\":\s*\[|\"insecure-registries\": [\"$REGISTRY\", |" "$DAEMON_JSON"
        else
            sed -i "s|{|{\n  \"insecure-registries\": [\"$REGISTRY\"],|" "$DAEMON_JSON"
        fi
        systemctl restart docker
        sleep 3
    fi
else
    cat > "$DAEMON_JSON" <<EOF
{
  "insecure-registries": ["$REGISTRY"]
}
EOF
    systemctl restart docker
    sleep 3
fi

log "拉取镜像"
docker pull "$IMAGE" || die "拉取失败，确认服务器能访问 $REGISTRY"
docker tag "$IMAGE" c-aihuabu:local

log "部署服务"
mkdir -p "$INSTALL_DIR/data/uploads/references"
cat > "$INSTALL_DIR/docker-compose.yml" <<EOF
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

cd "$INSTALL_DIR"
docker compose up -d --force-recreate

log "等待服务就绪"
for i in $(seq 1 30); do
    if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then
        ver=$(docker exec "$CONTAINER" cat /app/VERSION 2>/dev/null || echo unknown)
        echo ""
        echo "========================================="
        echo "  安装成功!"
        echo "  版本: $ver"
        echo "  地址: http://$(hostname -I | awk '{print $1}'):$PORT"
        echo "========================================="
        echo ""
        echo "配置:"
        echo "  目录: $INSTALL_DIR"
        echo "  端口: $PORT"
        [ -n "$DOMAIN" ] && echo "  域名: $DOMAIN"
        echo ""
        echo "常用命令:"
        echo "  docker logs -f $CONTAINER          # 查看日志"
        echo "  cd $INSTALL_DIR && docker compose down  # 停止"
        echo ""
        echo "更新: 重新执行本脚本即可"
        exit 0
    fi
    sleep 1
done
die "健康检查超时，查看日志: docker logs $CONTAINER"
