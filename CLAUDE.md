# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供指引。

## 项目概述

飞鱼 (Feiyu) 是一个实时通讯应用，后端使用 Rust，桌面客户端使用 Tauri。

## 架构

**Monorepo，包含两个 workspace：**
- **pnpm workspace**（`pnpm-workspace.yaml`）：`apps/desktop`（React/TS）、`packages/shared`（共享类型）
- **Cargo workspace**（`Cargo.toml`）：`apps/server`（Axum HTTP 服务）、`apps/desktop/src-tauri`（Tauri 壳）

**服务端**（`apps/server`）— Axum + SQLx + PostgreSQL：
- `src/main.rs` → 入口，串联 config → DB pool → router → TCP listener
- `src/config.rs` → `Config::from_env()` 读取 `DATABASE_URL`、`REDIS_URL`、`JWT_SECRET`、`SERVER_HOST`、`SERVER_PORT`
- `src/api/mod.rs` → Axum `Router`，注册 `/api/health`、`/api/auth/register`、`/api/auth/login`
- `src/api/auth.rs` → HTTP handler，将 `AuthError` 映射为状态码
- `src/services/auth.rs` → 业务逻辑：bcrypt 密码哈希、JWT 生成（7 天有效期）、注册/登录
- `src/models/user.rs` → `User`、`RegisterRequest`、`LoginRequest`、`AuthResponse`、`Claims`（serde + sqlx）
- `src/db/pool.rs` → `create_pool()` 使用 sqlx `PgPool`

**桌面端**（`apps/desktop`）— Tauri v2 + React 18 + Tailwind：
- `src/App.tsx` → 三栏聊天布局（侧边栏 60px | 会话列表 280px | 聊天窗口）
- 使用 Zustand 进行状态管理

**共享类型**（`packages/shared/src/types.ts`）— TypeScript 接口：User、Message、Conversation、Channel、WsMessage、WsMessageType。引用名 `@feiyu/shared`。

## 常用命令

```bash
# 启动基础设施（PostgreSQL、Redis、MinIO）
docker compose up -d

# 运行服务端
cargo run -p feiyu-server
# 或
pnpm server

# 运行桌面端（前端开发服务器）
pnpm dev
# 或带 Tauri
cd apps/desktop && pnpm tauri dev

# 构建桌面端
pnpm build

# 类型检查共享类型
cd packages/shared && pnpm typecheck
```

## 环境变量

服务端所有配置项在本地开发时均有默认值，可通过环境变量覆盖：
- `DATABASE_URL`（默认：`postgres://feiyu:feiyu_dev@localhost:5432/feiyu`）
- `REDIS_URL`（默认：`redis://localhost:6379`）
- `JWT_SECRET`（默认：`dev-secret-change-in-production`）
- `SERVER_HOST`（默认：`0.0.0.0`）
- `SERVER_PORT`（默认：`3000`）

## 数据库

- 迁移文件位于 `apps/server/migrations/`（SQLx migrate）
- 表：`users`、`conversations`、`conversation_members`、`messages`、`read_receipts`、`channels`、`channel_members`、`channel_messages`、`contacts`
- 所有 ID 使用 UUID；时间戳使用 `TIMESTAMPTZ`

## 关键模式

- 服务端使用 `thiserror` 定义错误枚举，配合 `#[from]` 实现自动转换
- 认证服务返回 `Result<T, AuthError>`，API 层将错误映射为 HTTP 状态码
- JWT claims 包含 `sub`（用户 UUID）、`iat`、`exp`；使用 `jsonwebtoken` 编码
- 未使用 SQLx 编译期检查查询——所有查询均为运行时（`query_as`、`query_scalar`）
- Axum 状态为 `AuthState { pool, jwt_secret }`，路由间共享

## 提交规范

提交信息使用中文。不添加 co-author 头，除非 co-author 是真人。

## 进度管理

项目进度记录在 `PROGRESS.md` 中。每次完成任务后，必须更新该文档：
- 将完成的任务从"进行中"移至"已完成"，注明完成日期
- 如有新发现的待办任务，追加到"待办"列表
- 保持文档整洁，定期归档已完成任务
