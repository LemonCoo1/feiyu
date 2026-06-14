#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> 飞鱼桌面端本地打包"
echo "    项目目录: $ROOT_DIR"

cd "$ROOT_DIR"

# 检查 pnpm
if ! command -v pnpm &>/dev/null; then
  echo "错误: 未找到 pnpm，请先安装 pnpm"
  exit 1
fi

# 检查 rust
if ! command -v cargo &>/dev/null; then
  echo "错误: 未找到 cargo/Rust，请先安装 Rust (https://rustup.rs)"
  exit 1
fi

# 安装依赖
echo "==> 安装前端依赖..."
pnpm install --frozen-lockfile

# 构建
echo "==> 开始 Tauri 构建..."
cd apps/desktop
pnpm tauri build

echo ""
echo "==> 构建完成！安装包位于:"
if [[ "$(uname)" == "Darwin" ]]; then
  ls -lh src-tauri/target/release/bundle/dmg/*.dmg 2>/dev/null || echo "  (未找到 .dmg 文件)"
  ls -lh src-tauri/target/release/bundle/macos/*.app 2>/dev/null || echo "  (未找到 .app 文件)"
elif [[ "$(uname)" == MINGW* ]] || [[ "$(uname)" == MSYS* ]]; then
  ls -lh src-tauri/target/release/bundle/msi/*.msi 2>/dev/null || echo "  (未找到 .msi 文件)"
  ls -lh src-tauri/target/release/bundle/nsis/*.exe 2>/dev/null || echo "  (未找到 .exe 文件)"
else
  echo "  请查看 src-tauri/target/release/bundle/ 目录"
fi
