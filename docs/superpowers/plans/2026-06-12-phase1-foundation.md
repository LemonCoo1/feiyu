# 飞书风格 IM — Phase 1：基础框架 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建飞书风格 IM 应用的完整项目骨架，包括 Monorepo、Tauri 桌面应用、Axum 后端服务、Docker 基础设施，以及用户注册/登录功能。

**Architecture:** 前端使用 React + TypeScript + Vite 通过 Tauri 2.0 渲染桌面窗口，后端使用 Rust Axum 提供 REST API 和 WebSocket 服务。两者通过 HTTP/WebSocket 通信。开发环境使用 Docker Compose 运行 PostgreSQL、Redis、MinIO。

**Tech Stack:** Tauri 2.0, React 18, TypeScript, Vite, TailwindCSS, Zustand, Axum, Tokio, SQLx, PostgreSQL, Redis, JWT

---

## 文件结构总览

```
feiyu/
├── Cargo.toml                          # Rust workspace root
├── package.json                        # pnpm workspace root
├── pnpm-workspace.yaml
├── docker-compose.yml
├── .gitignore
├── apps/
│   ├── desktop/                        # Tauri 桌面应用
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.js
│   │   ├── postcss.config.js
│   │   ├── index.html
│   │   ├── src/                        # React 前端
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── styles/
│   │   │   │   └── globals.css
│   │   │   └── components/
│   │   │       └── (后续 Phase 填充)
│   │   └── src-tauri/                  # Tauri Rust Core
│   │       ├── Cargo.toml
│   │       ├── tauri.conf.json
│   │       ├── build.rs
│   │       ├── capabilities/
│   │       │   └── default.json
│   │       └── src/
│   │           ├── main.rs
│   │           └── lib.rs
│   └── server/                         # 后端服务
│       ├── Cargo.toml
│       └── src/
│           ├── main.rs
│           ├── config.rs
│           ├── db/
│           │   ├── mod.rs
│           │   └── pool.rs
│           ├── api/
│           │   ├── mod.rs
│           │   └── auth.rs
│           ├── models/
│           │   ├── mod.rs
│           │   └── user.rs
│           └── services/
│               ├── mod.rs
│               └── auth.rs
└── packages/
    └── shared/
        ├── package.json
        └── src/
            └── types.ts
```

---

## Task 1: 初始化 Monorepo 与 Git

**Files:**
- Create: `.gitignore`
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `Cargo.toml`

- [ ] **Step 1: 初始化 Git 仓库**

```bash
cd /Users/xucong/Documents/projects/feiyu
git init
```

- [ ] **Step 2: 创建 .gitignore**

```gitignore
# Dependencies
node_modules/
target/

# Build outputs
dist/
release/
*.exe
*.dmg
*.AppImage

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo
.DS_Store

# Tauri
*.pdb
*.wixpdb

# Docker volumes
pgdata/
miniodata/

# Superpowers brainstorm
.superpowers/
```

- [ ] **Step 3: 创建 pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 4: 创建根 package.json**

```json
{
  "name": "feiyu",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @feiyu/desktop dev",
    "build": "pnpm --filter @feiyu/desktop build",
    "server": "cargo run -p feiyu-server"
  },
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 5: 创建 Cargo.toml (Rust workspace)**

```toml
[workspace]
resolver = "2"
members = [
    "apps/server",
    "apps/desktop/src-tauri",
]

[workspace.package]
version = "0.1.0"
edition = "2021"

[workspace.dependencies]
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
anyhow = "1"
thiserror = "2"
tracing = "0.1"
tracing-subscriber = "0.3"

# Axum
axum = { version = "0.8", features = ["ws"] }
tower = "0.5"
tower-http = { version = "0.6", features = ["cors", "trace"] }

# Database
sqlx = { version = "0.8", features = ["runtime-tokio", "tls-rustls", "postgres", "uuid", "chrono", "migrate"] }

# Auth
jsonwebtoken = "9"
bcrypt = "0.16"

# Redis
redis = { version = "0.27", features = ["tokio-comp", "connection-manager"] }
```

- [ ] **Step 6: 验证 workspace 结构**

```bash
cd /Users/xucong/Documents/projects/feiyu
cargo metadata --no-deps 2>&1 | head -5
# Expected: should show workspace members (will error until we create the crates, that's OK)
```

- [ ] **Step 7: 首次提交**

```bash
cd /Users/xucong/Documents/projects/feiyu
git add .gitignore pnpm-workspace.yaml package.json Cargo.toml
git commit -m "chore: init monorepo workspace"
```

---

## Task 2: Docker 基础设施

**Files:**
- Create: `docker-compose.yml`
- Create: `apps/server/migrations/001_init.sql`

- [ ] **Step 1: 创建 docker-compose.yml**

```yaml
version: "3.8"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: feiyu
      POSTGRES_USER: feiyu
      POSTGRES_PASSWORD: feiyu_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U feiyu"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data

volumes:
  pgdata:
  miniodata:
```

- [ ] **Step 2: 创建数据库迁移文件**

```bash
mkdir -p /Users/xucong/Documents/projects/feiyu/apps/server/migrations
```

```sql
-- apps/server/migrations/001_init.sql
-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    avatar_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'offline',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 会话表
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL,
    name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 会话成员表
CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    content_type VARCHAR(20) NOT NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 已读状态表
CREATE TABLE IF NOT EXISTS read_receipts (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    last_read_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, conversation_id)
);

-- 频道表
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 频道成员表
CREATE TABLE IF NOT EXISTS channel_members (
    channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (channel_id, user_id)
);

-- 频道消息表
CREATE TABLE IF NOT EXISTS channel_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    content_type VARCHAR(20) NOT NULL,
    content JSONB NOT NULL,
    parent_message_id UUID REFERENCES channel_messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 联系人表
CREATE TABLE IF NOT EXISTS contacts (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, contact_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_conversation_members_user ON conversation_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_members_user ON channel_members(user_id);
CREATE INDEX IF NOT EXISTS idx_channel_messages_channel ON channel_messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_channel_messages_sender ON channel_messages(sender_id);
```

- [ ] **Step 3: 启动 Docker 服务并验证**

```bash
cd /Users/xucong/Documents/projects/feiyu
docker compose up -d
docker compose ps
# Expected: postgres, redis, minio all running
```

- [ ] **Step 4: 验证 PostgreSQL 连接**

```bash
docker compose exec postgres psql -U feiyu -d feiyu -c "SELECT 1;"
# Expected: returns 1
```

- [ ] **Step 5: 执行数据库迁移**

```bash
cat apps/server/migrations/001_init.sql | docker compose exec -T postgres psql -U feiyu -d feiyu
# Expected: all CREATE TABLE / CREATE INDEX succeed
```

- [ ] **Step 6: 验证表已创建**

```bash
docker compose exec postgres psql -U feiyu -d feiyu -c "\dt"
# Expected: lists users, conversations, messages, etc.
```

- [ ] **Step 7: 提交**

```bash
git add docker-compose.yml apps/server/migrations/
git commit -m "chore: add docker-compose and initial db migration"
```

---

## Task 3: 后端 Axum 服务骨架

**Files:**
- Create: `apps/server/Cargo.toml`
- Create: `apps/server/src/main.rs`
- Create: `apps/server/src/config.rs`
- Create: `apps/server/src/db/mod.rs`
- Create: `apps/server/src/db/pool.rs`
- Create: `apps/server/src/api/mod.rs`

- [ ] **Step 1: 创建 apps/server/Cargo.toml**

```toml
[package]
name = "feiyu-server"
version.workspace = true
edition.workspace = true

[[bin]]
name = "feiyu-server"
path = "src/main.rs"

[dependencies]
# Workspace
tokio.workspace = true
serde.workspace = true
serde_json.workspace = true
uuid.workspace = true
chrono.workspace = true
anyhow.workspace = true
thiserror.workspace = true
tracing.workspace = true
tracing-subscriber.workspace = true
axum.workspace = true
tower.workspace = true
tower-http.workspace = true
sqlx.workspace = true
jsonwebtoken.workspace = true
bcrypt.workspace = true
redis.workspace = true
```

- [ ] **Step 2: 创建 apps/server/src/config.rs**

```rust
use std::env;

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub redis_url: String,
    pub jwt_secret: String,
    pub server_host: String,
    pub server_port: u16,
}

impl Config {
    pub fn from_env() -> Self {
        Self {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://feiyu:feiyu_dev@localhost:5432/feiyu".to_string()),
            redis_url: env::var("REDIS_URL")
                .unwrap_or_else(|_| "redis://localhost:6379".to_string()),
            jwt_secret: env::var("JWT_SECRET")
                .unwrap_or_else(|_| "dev-secret-change-in-production".to_string()),
            server_host: env::var("SERVER_HOST")
                .unwrap_or_else(|_| "0.0.0.0".to_string()),
            server_port: env::var("SERVER_PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3000),
        }
    }
}
```

- [ ] **Step 3: 创建 apps/server/src/db/pool.rs**

```rust
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

pub async fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(20)
        .connect(database_url)
        .await
}
```

- [ ] **Step 4: 创建 apps/server/src/db/mod.rs**

```rust
pub mod pool;

pub use pool::create_pool;
```

- [ ] **Step 5: 创建 apps/server/src/api/mod.rs**

```rust
use axum::{routing::get, Router};

pub fn router() -> Router {
    Router::new()
        .route("/api/health", get(health))
}

async fn health() -> &'static str {
    "ok"
}
```

- [ ] **Step 6: 创建 apps/server/src/main.rs**

```rust
use tracing_subscriber::EnvFilter;

mod config;
mod db;
mod api;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("info".parse()?))
        .init();

    let config = config::Config::from_env();

    let pool = db::create_pool(&config.database_url).await?;
    tracing::info!("Database connected");

    let app = api::router()
        .with_state(pool);

    let addr = format!("{}:{}", config.server_host, config.server_port);
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
```

- [ ] **Step 7: 编译验证后端**

```bash
cd /Users/xucong/Documents/projects/feiyu
cargo check -p feiyu-server
# Expected: compiles without errors
```

- [ ] **Step 8: 启动后端并测试 health 端点**

```bash
# Terminal 1: 启动服务器
cargo run -p feiyu-server &

# Terminal 2: 测试
curl http://localhost:3000/api/health
# Expected: "ok"

# 停止服务器
kill %1
```

- [ ] **Step 9: 提交**

```bash
git add apps/server/
git commit -m "feat: add axum server skeleton with health endpoint"
```

---

## Task 4: 用户模型与认证服务

**Files:**
- Create: `apps/server/src/models/mod.rs`
- Create: `apps/server/src/models/user.rs`
- Create: `apps/server/src/services/mod.rs`
- Create: `apps/server/src/services/auth.rs`
- Create: `apps/server/src/api/auth.rs`

- [ ] **Step 1: 创建 apps/server/src/models/mod.rs**

```rust
pub mod user;

pub use user::User;
```

- [ ] **Step 2: 创建 apps/server/src/models/user.rs**

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
    pub display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: User,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,  // user id
    pub exp: usize,
    pub iat: usize,
}
```

- [ ] **Step 3: 创建 apps/server/src/services/mod.rs**

```rust
pub mod auth;
```

- [ ] **Step 4: 创建 apps/server/src/services/auth.rs**

```rust
use chrono::Utc;
use jsonwebtoken::{encode, DecodingKey, EncodingKey, Header, Validation};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::user::{AuthResponse, Claims, LoginRequest, RegisterRequest, User};

#[derive(Debug, thiserror::Error)]
pub enum AuthError {
    #[error("Email already exists")]
    EmailExists,
    #[error("Username already exists")]
    UsernameExists,
    #[error("Invalid credentials")]
    InvalidCredentials,
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),
    #[error("Bcrypt error: {0}")]
    Bcrypt(#[from] bcrypt::BcryptError),
}

pub async fn register(
    pool: &PgPool,
    req: RegisterRequest,
    jwt_secret: &str,
) -> Result<AuthResponse, AuthError> {
    // Check if email exists
    let existing = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)"
    )
    .bind(&req.email)
    .fetch_one(pool)
    .await?;
    if existing {
        return Err(AuthError::EmailExists);
    }

    // Check if username exists
    let existing = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)"
    )
    .bind(&req.username)
    .fetch_one(pool)
    .await?;
    if existing {
        return Err(AuthError::UsernameExists);
    }

    let password_hash = bcrypt::hash(&req.password, 10)?;
    let user_id = Uuid::new_v4();
    let now = Utc::now();

    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (id, username, email, password_hash, display_name, status, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, 'offline', $6, $6)
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(&req.username)
    .bind(&req.email)
    .bind(&password_hash)
    .bind(&req.display_name)
    .bind(now)
    .fetch_one(pool)
    .await?;

    let token = generate_token(user_id, jwt_secret)?;

    Ok(AuthResponse { token, user })
}

pub
    pool: &PgPool,
    req: LoginRequest,
    jwt_secret: &str,
) -> Result<AuthResponse, AuthError> {
    let user = sqlx::query_as::<_, User>(
        "SELECT * FROM users WHERE email = $1"
    )
    .bind(&req.email)
    .fetch_optional(pool)
    .await?
    .ok_or(AuthError::InvalidCredentials)?;

    let valid = bcrypt::verify(&req.password, &user.password_hash)?;
    if !valid {
        return Err(AuthError::InvalidCredentials);
    }

    let token = generate_token(user.id, jwt_secret)?;

    Ok(AuthResponse { token, user })
}

fn generate_token(user_id: Uuid, secret: &str) -> Result<String, AuthError> {
    let now = Utc::now().timestamp() as usize;
    let claims = Claims {
        sub: user_id,
        iat: now,
        exp: now + 86400 * 7, // 7 days
    };
    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;
    Ok(token)
}
```

- [ ] **Step 5: 创建 apps/server/src/api/auth.rs**

```rust
use axum::{extract::State, http::StatusCode, Json};
use sqlx::PgPool;

use crate::config::Config;
use crate::models::user::{AuthResponse, LoginRequest, RegisterRequest};
use crate::services::auth::{self, AuthError};

#[derive(Clone)]
pub struct AuthState {
    pub pool: PgPool,
    pub jwt_secret: String,
}

pub async fn register(
    State(state): State<AuthState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    auth::register(&state.pool, req, &state.jwt_secret)
        .await
        .map(Json)
        .map_err(|e| match e {
            AuthError::EmailExists => (StatusCode::CONFLICT, "Email already exists".to_string()),
            AuthError::UsernameExists => (StatusCode::CONFLICT, "Username already exists".to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}

pub async fn login(
    State(state): State<AuthState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>, (StatusCode, String)> {
    auth::login(&state.pool, req, &state.jwt_secret)
        .await
        .map(Json)
        .map_err(|e| match e {
            AuthError::InvalidCredentials => (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}
```

- [ ] **Step 6: 更新 apps/server/src/api/mod.rs 注册 auth 路由**

```rust
pub mod auth;

use axum::{routing::{get, post}, Router};
use sqlx::PgPool;

use crate::config::Config;

pub fn router(pool: PgPool, config: &Config) -> Router {
    let auth_state = auth::AuthState {
        pool: pool.clone(),
        jwt_secret: config.jwt_secret.clone(),
    };

    Router::new()
        .route("/api/health", get(health))
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .with_state(auth_state)
}

async fn health() -> &'static str {
    "ok"
}
```

- [ ] **Step 7: 更新 apps/server/src/main.rs 使用新路由**

将 `api::router()` 调用改为传递 pool 和 config：

```rust
mod config;
mod db;
mod api;
mod models;
mod services;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env().add_directive("info".parse()?))
        .init();

    let config = config::Config::from_env();

    let pool = db::create_pool(&config.database_url).await?;
    tracing::info!("Database connected");

    let app = api::router(pool, &config);

    let addr = format!("{}:{}", config.server_host, config.server_port);
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
```

- [ ] **Step 8: 编译验证**

```bash
cargo check -p feiyu-server
# Expected: compiles without errors
```

- [ ] **Step 9: 测试注册和登录**

```bash
# 启动服务器
cargo run -p feiyu-server &

# 注册
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123","display_name":"Test User"}'
# Expected: JSON with token and user object

# 登录
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
# Expected: JSON with token and user object

# 重复注册
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
# Expected: 409 Conflict

kill %1
```

- [ ] **Step 10: 提交**

```bash
git add apps/server/src/
git commit -m "feat: add user model, auth service, register/login endpoints"
```

---

## Task 5: Tauri 桌面应用骨架

**Files:**
- Create: `apps/desktop/package.json`
- Create: `apps/desktop/vite.config.ts`
- Create: `apps/desktop/tsconfig.json`
- Create: `apps/desktop/tailwind.config.js`
- Create: `apps/desktop/postcss.config.js`
- Create: `apps/desktop/index.html`
- Create: `apps/desktop/src/main.tsx`
- Create: `apps/desktop/src/App.tsx`
- Create: `apps/desktop/src/styles/globals.css`
- Create: `apps/desktop/src-tauri/Cargo.toml`
- Create: `apps/desktop/src-tauri/tauri.conf.json`
- Create: `apps/desktop/src-tauri/build.rs`
- Create: `apps/desktop/src-tauri/capabilities/default.json`
- Create: `apps/desktop/src-tauri/src/main.rs`
- Create: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: 创建 apps/desktop/package.json**

```json
{
  "name": "@feiyu/desktop",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "tauri": "tauri"
  },
  "dependencies": {
    "@tauri-apps/api": "^2",
    "@tauri-apps/plugin-shell": "^2",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^5"
  },
  "devDependencies": {
    "@tauri-apps/cli": "^2",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.6.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: 创建 apps/desktop/vite.config.ts**

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
  },
}));
```

- [ ] **Step 3: 创建 apps/desktop/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "useDefineForClassFields": true,
    "lib": ["ES2021", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: 创建 apps/desktop/tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        feiyu: {
          bg: "#f7f7f8",
          sidebar: "#2b2f36",
          primary: "#4f9cf7",
          "primary-hover": "#3b82f6",
          border: "#e5e5e6",
          text: "#1f2937",
          "text-secondary": "#6b7280",
          "text-muted: "#9ca3af",
        },
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 5: 创建 apps/desktop/postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 6: 创建 apps/desktop/index.html**

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>飞语</title>
  </head>
  <body class="bg-feiyu-bg">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: 创建 apps/desktop/src/styles/globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC",
    "Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial,
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow: hidden;
  user-select: none;
}
```

- [ ] **Step 8: 创建 apps/desktop/src/main.tsx**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 9: 创建 apps/desktop/src/App.tsx**

```tsx
function App() {
  return (
    <div className="flex h-screen w-screen">
      {/* Placeholder: will be filled with sidebar + conversation list + chat window */}
      <div className="w-[60px] bg-feiyu-sidebar flex items-center justify-center">
        <span className="text-white text-2xl font-bold">F</span>
      </div>
      <div className="w-[280px] bg-white border-r border-feiyu-border flex items-center justify-center">
        <span className="text-feiyu-text-muted">会话列表</span>
      </div>
      <div className="flex-1 bg-feiyu-bg flex items-center justify-center">
        <span className="text-feiyu-text-muted">聊天窗口</span>
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 10: 创建 apps/desktop/src-tauri/Cargo.toml**

```toml
[package]
name = "feiyu-desktop"
version.workspace = true
edition.workspace = true

[lib]
name = "feiyu_desktop_lib"
crate-type = ["lib", "cdylib", "staticlib"]

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
serde.workspace = true
serde_json.workspace = true
```

- [ ] **Step 11: 创建 apps/desktop/src-tauri/build.rs**

```rust
fn main() {
    tauri_build::build()
}
```

- [ ] **Step 12: 创建 apps/desktop/src-tauri/tauri.conf.json**

```json
{
  "$schema": "https://raw.githubusercontent.com/tauri-apps/tauri/dev/crates/tauri-cli/schema.json",
  "productName": "飞语",
  "version": "0.1.0",
  "identifier": "com.feiyu.app",
  "build": {
    "beforeDevCommand": "pnpm dev",
    "devUrl": "http://localhost:1420",
    "beforeBuildCommand": "pnpm build",
    "frontendDist": "../dist"
  },
  "app": {
    "title": "飞语",
    "windows": [
      {
        "title": "飞语",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null
    }
  },
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ]
  }
}
```

- [ ] **Step 13: 创建 apps/desktop/src-tauri/capabilities/default.json**

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open"
  ]
}
```

- [ ] **Step 14: 创建 apps/desktop/src-tauri/src/lib.rs**

```rust
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 15: 创建 apps/desktop/src-tauri/src/main.rs**

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    feiyu_desktop_lib::run()
}
```

- [ ] **Step 16: 安装前端依赖**

```bash
cd /Users/xucong/Documents/projects/feiyu
pnpm install
# Expected: installs all dependencies without errors
```

- [ ] **Step 17: 编译 Tauri 应用（仅检查，不打包）**

```bash
cd /Users/xucong/Documents/projects/feiyu
cargo check -p feiyu-desktop
# Expected: compiles without errors
```

- [ ] **Step 18: 提交**

```bash
git add apps/desktop/
git commit -m "feat: add tauri desktop app skeleton with react + tailwind"
```

---

## Task 6: 共享类型包

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types.ts`

- [ ] **Step 1: 创建 packages/shared/package.json**

```json
{
  "name": "@feiyu/shared",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "main": "src/types.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

- [ ] **Step 2: 创建 packages/shared/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "declaration": true,
    "outDir": "dist",
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: 创建 packages/shared/src/types.ts**

```typescript
// 与后端 models/user.rs 对齐的类型定义

export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  status: "online" | "offline" | "away";
  created_at: string;
  updated_at: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  display_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content_type: "text" | "image" | "file";
  content: Record<string, unknown>;
  created_at: string;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  name: string | null;
  created_at: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

// WebSocket 消息类型
export type WsMessageType =
  | "auth.token"
  | "auth.ok"
  | "message.send"
  | "message.deliver"
  | "message.ack"
  | "message.read"
  | "typing.start"
  | "typing.stop"
  | "presence.update"
  | "channel.join"
  | "channel.leave";

export interface WsMessage<T = unknown> {
  type: WsMessageType;
  payload: T;
  request_id?: string;
  timestamp: number;
}
```

- [ ] **Step 4: 类型检查**

```bash
cd /Users/xucong/Documents/projects/feiyu
pnpm --filter @feiyu/shared typecheck
# Expected: no errors
```

- [ ] **Step 5: 提交**

```bash
git add packages/shared/
git commit -m "feat: add shared types package"
```

---

## Task 7: 整体验证与最终提交

- [ ] **Step 1: 全量编译 Rust workspace**

```bash
cd /Users/xucong/Documents/projects/feiyu
cargo check --workspace
# Expected: both feiyu-server and feiyu-desktop compile
```

- [ ] **Step 2: 确认 Docker 服务正常**

```bash
docker compose ps
# Expected: postgres, redis, minio all running and healthy
```

- [ ] **Step 3: 端到端验证 — 启动后端、注册用户、登录**

```bash
# 确保数据库已迁移
cat apps/server/migrations/001_init.sql | docker compose exec -T postgres psql -U feiyu -d feiyu

# 启动后端
cargo run -p feiyu-server &
sleep 2

# 注册
REGISTER_RESULT=$(curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"e2e_user","email":"e2e@test.com","password":"test123456"}')
echo "$REGISTER_RESULT" | python3 -m json.tool

# 登录
LOGIN_RESULT=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"e2e@test.com","password":"test123456"}')
echo "$LOGIN_RESULT" | python3 -m json.tool

# Health check
curl http://localhost:3000/api/health
# Expected: "ok"

kill %1
```

- [ ] **Step 4: 最终提交**

```bash
git add -A
git status
# Review changes, then commit
git commit -m "chore: phase 1 complete - monorepo, server, desktop app skeleton"
```

---

## 后续 Phase 概览

完成 Phase 1 后，后续阶段将依次实现：

- **Phase 2: 核心 IM** — WebSocket Hub、一对一聊天、消息持久化、基础 UI 组件
- **Phase 3: 用户体系** — 联系人管理、在线状态、个人资料
- **Phase 4: 频道功能** — 频道创建、频道消息、@提醒、话题
- **Phase 5: 完善优化** — 群聊、文件消息、搜索、通知、UI 打磨
