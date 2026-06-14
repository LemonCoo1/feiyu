#!/usr/bin/env bash
set -e

GREEN='\033[0;32m'
NC='\033[0m'
log() { echo -e "${GREEN}[server]${NC} $1"; }

cleanup() {
    log "正在停止后端服务..."
    kill $SERVER_PID 2>/dev/null
    wait $SERVER_PID 2>/dev/null
    log "后端服务已停止"
}
trap cleanup EXIT INT TERM

# 启动基础设施
log "启动 Docker 容器..."
docker compose up -d

# 等待 PostgreSQL
log "等待 PostgreSQL..."
until docker compose exec -T postgres pg_isready -U feiyu &>/dev/null; do sleep 1; done
log "PostgreSQL 已就绪"

# 清理残留的后端进程
EXISTING=$(lsof -ti :3000 2>/dev/null || true)
if [ -n "$EXISTING" ]; then
    log "检测到端口 3000 被占用，正在清理残留进程..."
    echo "$EXISTING" | xargs kill 2>/dev/null || true
    sleep 1
fi

# 启动后端
cd "$(dirname "$0")"
log "启动后端服务器..."
cargo run -p feiyu-server -- --config apps/server/config.toml &
SERVER_PID=$!

# 等待后端就绪
for i in {1..30}; do
    curl -s http://localhost:3000/api/health &>/dev/null && break
    sleep 1
done
log "后端服务已就绪: http://localhost:3000"

wait
