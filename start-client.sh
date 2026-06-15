#!/usr/bin/env bash
set -e

# 加载 cargo 环境（非交互 shell 不会自动加载）
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"

GREEN='\033[0;32m'
NC='\033[0m'
log() { echo -e "${GREEN}[client]${NC} $1"; }

# 支持多开：./start-client.sh [实例编号]
INSTANCE=${1:-1}
BASE_PORT=1420
PORT=$((BASE_PORT + INSTANCE - 1))

cleanup() {
    log "正在停止客户端实例 #$INSTANCE..."
    kill $TAURI_PID 2>/dev/null
    wait $TAURI_PID 2>/dev/null
    log "客户端实例 #$INSTANCE 已停止"
}
trap cleanup EXIT INT TERM

cd "$(dirname "$0")/apps/desktop"

log "启动桌面客户端实例 #$INSTANCE (端口: $PORT)..."
VITE_PORT=$PORT pnpm tauri dev &
TAURI_PID=$!

wait
