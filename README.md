# 飞鱼 (Feiyu)

[![Release](https://github.com/your-username/feiyu/actions/workflows/release.yml/badge.svg)](https://github.com/your-username/feiyu/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

一个现代化的实时通讯应用，基于 Rust 后端和 Tauri 桌面客户端构建。

## 功能特性

- **实时消息** — WebSocket 实时通信，支持文本、图片、文件消息
- **会话管理** — 一对一私聊和群聊功能
- **频道系统** — 主题频道，支持多人讨论
- **联系人管理** — 搜索、添加、管理联系人
- **在线状态** — 实时显示用户在线/离线状态
- **已读回执** — 消息已读状态跟踪
- **通知系统** — 桌面通知和消息提醒
- **深色/浅色主题** — 可切换的 UI 主题
- **国际化** — 支持中文和英文
- **跨平台** — 支持 macOS 和 Windows

## 技术栈

### 后端
- **语言**: Rust
- **框架**: Axum
- **数据库**: PostgreSQL (SQLx)
- **缓存**: Redis
- **存储**: MinIO (S3 兼容)
- **认证**: JWT (JSON Web Token)

### 桌面客户端
- **框架**: Tauri v2
- **前端**: React 18 + TypeScript
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **国际化**: i18next

### 基础设施
- **容器化**: Docker Compose
- **CI/CD**: GitHub Actions

## 项目结构

```
feiyu/
├── apps/
│   ├── server/                 # Rust 后端服务
│   │   ├── src/
│   │   │   ├── api/           # HTTP 路由和处理器
│   │   │   ├── db/            # 数据库连接池
│   │   │   ├── models/        # 数据模型
│   │   │   ├── services/      # 业务逻辑
│   │   │   └── main.rs        # 入口文件
│   │   └── migrations/        # 数据库迁移
│   └── desktop/                # Tauri 桌面应用
│       ├── src/                # React 前端代码
│       └── src-tauri/          # Tauri Rust 代码
├── packages/
│   └── shared/                 # 共享 TypeScript 类型
├── docker-compose.yml          # 基础设施配置
├── Cargo.toml                  # Rust workspace 配置
└── pnpm-workspace.yaml         # pnpm workspace 配置
```

## 快速开始

### 前置要求

- Rust (最新稳定版)
- Node.js 18+
- pnpm
- Docker Desktop

### 1. 克隆项目

```bash
git clone https://github.com/your-username/feiyu.git
cd feiyu
```

### 2. 启动基础设施

```bash
docker compose up -d
```

这将启动：
- PostgreSQL (端口 5432)
- Redis (端口 6379)
- MinIO (端口 9000, 控制台 9001)

### 3. 安装依赖

```bash
pnpm install
```

### 4. 启动开发服务器

**仅前端开发:**
```bash
pnpm dev
```

**完整桌面应用 (带 Tauri):**
```bash
cd apps/desktop
pnpm tauri dev
```

**仅后端服务:**
```bash
cargo run -p feiyu-server
# 或
pnpm server
```

## 环境变量

服务端配置可通过环境变量覆盖（所有选项在本地开发时均有默认值）:

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `postgres://feiyu:feiyu_dev@localhost:5432/feiyu` | PostgreSQL 连接字符串 |
| `REDIS_URL` | `redis://localhost:6379` | Redis 连接字符串 |
| `JWT_SECRET` | `dev-secret-change-in-production` | JWT 签名密钥 |
| `SERVER_HOST` | `0.0.0.0` | 服务监听地址 |
| `SERVER_PORT` | `3000` | 服务监听端口 |

## 构建和打包

### 构建桌面应用

```bash
pnpm build
```

或使用一键脚本:
```bash
./scripts/build-desktop.sh
```



## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。
