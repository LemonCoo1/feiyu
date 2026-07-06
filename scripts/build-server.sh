#!/usr/bin/env bash
# 飞鱼后端服务镜像构建脚本。
# 构建上下文为仓库根目录，Dockerfile 位于 apps/server/Dockerfile（多阶段：容器内编译 Rust + 打包运行镜像）。
# 用法：
#   ./scripts/build-server.sh           # 仅构建镜像
#   ./scripts/build-server.sh --push    # 构建并推送到 cnb 仓库
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 制品名与仓库一致：构建后可直接推送
IMAGE_TAG="docker.cnb.cool/dacong94/feiyu:latest"

# 解析参数
DO_PUSH=0
for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=1 ;;
    -h|--help)
      echo "用法: $0 [--push]"
      echo "  --push  构建完成后推送到 $IMAGE_TAG"
      exit 0
      ;;
    *) echo "未知参数: $arg" >&2; exit 1 ;;
  esac
done

echo "==> 飞鱼后端镜像构建"
echo "    项目目录: $ROOT_DIR"
echo "    镜像:     $IMAGE_TAG"

# 检查 docker
if ! command -v docker &>/dev/null; then
  echo "错误: 未找到 docker，请先安装 Docker / OrbStack" >&2
  exit 1
fi

cd "$ROOT_DIR"

# 多阶段构建：在 rust:1.88-bookworm builder 中编译，再打进 debian:bookworm-slim 运行镜像
echo "==> 开始 docker build ..."
docker build -f apps/server/Dockerfile -t "$IMAGE_TAG" .

echo ""
echo "==> 构建完成"
docker image ls "$IMAGE_TAG"

if [[ "$DO_PUSH" -eq 1 ]]; then
  echo ""
  echo "==> 推送到 $IMAGE_TAG ..."
  docker push "$IMAGE_TAG"
  echo "==> 推送完成"
fi
