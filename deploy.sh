#!/usr/bin/env bash
# C-AI 画布一键 Docker 部署。默认监听 9527，可用环境变量或 .env 覆盖。
#
#   ./deploy.sh                                     使用默认值部署
#   C_AI_HOST_PORT=9528 ./deploy.sh                 换端口
#   C_AI_PUBLIC_BASE_URL=https://x.com ./deploy.sh  指定公网域名（参考素材上传需要）
#
# 同一台机器部署多个实例时，额外指定 C_AI_CONTAINER_NAME 和 C_AI_IMAGE_NAME 避免撞名。
set -euo pipefail

cd "$(dirname "$0")"

PORT="${C_AI_HOST_PORT:-9527}"
CONTAINER="${C_AI_CONTAINER_NAME:-infinite-canvas}"
IMAGE="${C_AI_IMAGE_NAME:-c-aihuabu:local}"
PUBLIC_BASE_URL="${C_AI_PUBLIC_BASE_URL:-}"
UPLOAD_TTL_DAYS="${C_AI_UPLOAD_TTL_DAYS:-15}"
UPLOAD_HOST_DIR="${C_AI_UPLOAD_HOST_DIR:-./data/uploads}"
# bun.lock 有部分依赖没记录解析地址，会回退到 registry.npmjs.org。访问 npmjs
# 困难时用这个指定镜像源，例如 NPM_REGISTRY=https://registry.npmmirror.com。
NPM_REGISTRY="${NPM_REGISTRY:-}"
# 设为 1 时直接拉 CI 构建好的镜像，跳过本地编译（需要能访问 ghcr.io）。
USE_REGISTRY="${C_AI_USE_REGISTRY:-}"
REGISTRY_IMAGE="${C_AI_REGISTRY_IMAGE:-ghcr.io/cangerx/c-aihuabu:latest}"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }
warn() { printf '\033[1;33m[!] %s\033[0m\n' "$1"; }
die() { printf '\033[1;31m[x] %s\033[0m\n' "$1" >&2; exit 1; }

log "检查环境"
command -v docker >/dev/null 2>&1 || die "未找到 docker，请先安装 Docker。"
docker info >/dev/null 2>&1 || die "docker 守护进程未运行，请先启动 Docker。"
docker compose version >/dev/null 2>&1 || die "未找到 docker compose 插件（需要 Docker Compose v2）。"
echo "docker: $(docker --version)"

# 端口被别的进程占用时立刻停下，避免 compose 报一堆看不懂的错。
if command -v lsof >/dev/null 2>&1; then
    holder="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
    if [ -n "$holder" ]; then
        holder_container="$(docker ps --filter "publish=$PORT" --format '{{.Names}}' | head -1 || true)"
        if [ "$holder_container" != "$CONTAINER" ]; then
            die "端口 $PORT 已被占用（PID $holder${holder_container:+，容器 $holder_container}）。换端口：C_AI_HOST_PORT=9528 ./deploy.sh"
        fi
    fi
fi

log "写入 .env"
# 已有 .env 先备份：旧版本可能残留 ADMIN_PASSWORD / JWT_SECRET / DATABASE_DSN 等
# 当前代码已不再读取的凭据，直接覆盖会把它们悄悄销毁。
if [ -f .env ] && grep -qvE '^(#|$|C_AI_)' .env; then
    backup=".env.bak.$(date +%Y%m%d%H%M%S)"
    cp .env "$backup"
    warn "原 .env 含本项目不使用的键，已备份为 $backup"
fi

# 只有这几个变量会被真正读取：proxy 读 C_AI_PUBLIC_BASE_URL / C_AI_UPLOAD_*，
# compose 读端口和镜像/容器名。
cat > .env <<EOF
C_AI_HOST_PORT=$PORT
C_AI_CONTAINER_NAME=$CONTAINER
C_AI_IMAGE_NAME=$IMAGE
C_AI_PUBLIC_BASE_URL=$PUBLIC_BASE_URL
C_AI_UPLOAD_DIR=/data/uploads/references
C_AI_UPLOAD_TTL_DAYS=$UPLOAD_TTL_DAYS
C_AI_UPLOAD_HOST_DIR=$UPLOAD_HOST_DIR
NPM_REGISTRY=$NPM_REGISTRY
EOF
echo "端口 $PORT / 容器 $CONTAINER / 镜像 $IMAGE"
[ -n "$PUBLIC_BASE_URL" ] || warn "未设置 C_AI_PUBLIC_BASE_URL：参考素材上传会拿不到公网地址，图生视频提交会失败。可稍后改 .env 再重跑本脚本。"

log "准备上传目录"
mkdir -p "$UPLOAD_HOST_DIR/references"

if [ "$USE_REGISTRY" = "1" ]; then
    log "拉取 CI 镜像 $REGISTRY_IMAGE"
    if docker pull "$REGISTRY_IMAGE"; then
        docker tag "$REGISTRY_IMAGE" "$IMAGE"
    else
        warn "拉取失败，回退到本地构建。"
        USE_REGISTRY=""
    fi
fi

if [ "$USE_REGISTRY" != "1" ]; then
    log "构建镜像（首次较慢）"
    [ -n "$NPM_REGISTRY" ] && echo "依赖镜像源 $NPM_REGISTRY"
    docker compose build app
fi

log "启动容器"
docker compose up -d --force-recreate

log "等待服务就绪"
ready=""
for i in $(seq 1 40); do
    if curl -fsS --max-time 3 "http://127.0.0.1:$PORT/healthz" >/dev/null 2>&1; then ready="1"; break; fi
    sleep 1
done

if [ -z "$ready" ]; then
    warn "健康检查未通过，最近日志："
    docker logs --tail=40 "$CONTAINER" || true
    die "服务未就绪。"
fi

version="$(docker exec "$CONTAINER" cat /app/VERSION 2>/dev/null | tr -d '\r\n' || echo unknown)"
log "部署完成"
echo "版本      $version"
echo "健康检查  http://127.0.0.1:$PORT/healthz -> $(curl -fsS --max-time 3 "http://127.0.0.1:$PORT/healthz")"
echo "本机访问  http://127.0.0.1:$PORT"
echo
echo "后续："
echo "  1. 外层反代到 127.0.0.1:$PORT，必须透传 Host（否则同域代理会 403）："
echo "       proxy_set_header Host \$host;"
echo "       proxy_set_header X-Forwarded-Host \$host;"
echo "       client_max_body_size 200m;"
echo "       proxy_read_timeout 2100s;"
echo "  2. 打开站点 → 齿轮「配置」→ 渠道，填 Base URL 和 Key（配置存在浏览器本地，服务端不保存）。"
echo
echo "常用命令："
echo "  docker logs -f $CONTAINER"
echo "  docker compose down"
echo "  ./deploy.sh          # 改完 .env 或拉了新代码后重跑即可更新"
