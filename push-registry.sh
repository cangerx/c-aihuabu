#!/usr/bin/env bash
# 本地构建 → 传输到服务器 → 加载并重启容器。
# 不需要任何 registry 配置，直接 scp 传输镜像文件。
#
# 用法: ./push-registry.sh
set -euo pipefail
cd "$(dirname "$0")"

SERVER="root@43.139.15.89"
SSH_PORT=23411
SSH_PASS="G3F7Q2wRI9se"
REMOTE_DIR="/www/wwwroot/c-aihuabu"
TMP_TAR="/tmp/c-aihuabu-image.tar.gz"

log() { printf '\n\033[1;36m==> %s\033[0m\n' "$1"; }

log "本地构建 (linux/amd64)"
docker build --platform linux/amd64 -t c-aihuabu:local .

log "导出镜像"
docker save c-aihuabu:local | gzip > "$TMP_TAR"
echo "大小: $(du -h "$TMP_TAR" | cut -f1)"

log "传输到服务器"
sshpass -p "$SSH_PASS" scp -P "$SSH_PORT" "$TMP_TAR" "$SERVER:$REMOTE_DIR/image.tar.gz"
rm -f "$TMP_TAR"

log "服务器加载并重启"
sshpass -p "$SSH_PASS" ssh -p "$SSH_PORT" "$SERVER" bash <<REMOTE
set -e
cd $REMOTE_DIR
docker load < image.tar.gz
rm -f image.tar.gz
docker compose up -d --force-recreate
sleep 3
if curl -fsS --max-time 3 http://127.0.0.1:23423/healthz >/dev/null 2>&1; then
    ver=\$(docker exec infinite-canvas cat /app/VERSION 2>/dev/null || echo unknown)
    echo "更新成功! 版本: \$ver"
else
    echo "健康检查失败"
    docker logs --tail 10 infinite-canvas
    exit 1
fi
REMOTE

log "完成"
