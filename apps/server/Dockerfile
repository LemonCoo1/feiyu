# 多阶段构建：在 builder 中编译 Rust 二进制，再打进精简运行镜像。
# 构建上下文为仓库根目录：docker build -f apps/server/Dockerfile .
# （由 scripts/build-server.sh 调用）
# ---- Builder ----
FROM rust:1.88-bookworm AS builder

WORKDIR /app

# 复制 workspace 结构（仅 Rust 部分）
COPY Cargo.toml Cargo.lock ./
COPY apps/server/Cargo.toml apps/server/Cargo.toml
COPY apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/Cargo.toml

# 创建空 src 以满足 cargo workspace 依赖检查：
# - server: bin
# - desktop: 同时声明 [lib] 与 bin，需补 lib.rs 与 main.rs 两个 stub
RUN mkdir -p apps/server/src apps/desktop/src-tauri/src && \
    echo "fn main() {}" > apps/server/src/main.rs && \
    echo "fn main() {}" > apps/desktop/src-tauri/src/main.rs && \
    echo "" > apps/desktop/src-tauri/src/lib.rs

# 预下载并编译依赖（利用 layer 缓存）
RUN cargo build --release -p feiyu-server || true

# 复制真实源码与迁移文件（迁移在编译期由 sqlx::migrate! 嵌入二进制）
COPY apps/server/src apps/server/src
COPY apps/server/migrations apps/server/migrations

# 最终构建（touch 触发 server crate 重编译，不影响已缓存的依赖）
RUN touch apps/server/src/main.rs && \
    cargo build --release -p feiyu-server

# ---- Runtime ----
FROM debian:bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/target/release/feiyu-server .
COPY apps/server/config.toml .
COPY apps/server/migrations migrations/

EXPOSE 3000

ENTRYPOINT ["./feiyu-server"]
