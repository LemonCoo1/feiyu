# 飞书风格 IM 桌面应用 — 技术架构设计

## 概述

构建一个类似飞书 UI 风格的轻量级 IM 桌面通讯应用，支持 Windows 和 macOS，具备基础聊天、用户体系和频道功能。采用 Tauri 2.0 + React + Rust (Axum) 技术栈，独立开发者可维护的简化架构。

## 技术选型

| 层级 | 技术 | 理由 |
|------|------|------|
| 桌面框架 | Tauri 2.0 | Rust 生态，体积小（~5-10MB），内存占用低，跨平台 |
| 前端框架 | React 18 + TypeScript + Vite | 生态成熟，飞书 UI 复现灵活 |
| 状态管理 | Zustand | 轻量，TypeScript 友好，适合 IM 场景 |
| UI 样式 | TailwindCSS + 自定义组件库 | 高效还原飞书设计风格 |
| 后端框架 | Axum + Tokio | Rust 异步高性能，WebSocket 原生支持 |
| 数据库 | PostgreSQL + SQLx | 关系数据存储，编译期 SQL 校验 |
| 缓存 | Redis | 在线状态、会话缓存、轻量消息队列 |
| 本地存储 | SQLite + rusqlite | 客户端消息缓存，支持离线查看 |
| 实时通信 | tokio-tungstenite | WebSocket 客户端/服务端 |
| 文件存储 | MinIO (S3 兼容) | 自托管对象存储 |
| 认证 | JWT (jsonwebtoken) | 无状态认证，适合桌面客户端 |
| 包管理 | pnpm workspace + Cargo workspace | Monorepo 统一管理 |

## 系统架构

```
┌─────────────────────────────────────┐     ⇄     ┌─────────────────────────────────────┐
│       Tauri 桌面客户端               │           │         Rust 后端服务 (Axum)          │
│                                     │           │                                     │
│  ┌─────────────────────────────┐    │           │  ┌─────────────────────────────┐    │
│  │  WebView (React + TS)       │    │           │  │  接入层 (Gateway)            │    │
│  │  - 聊天窗口                 │    │  WebSocket │  │  - HTTP Router              │    │
│  │  - 会话列表                 │    │  + REST    │  │  - WebSocket Hub            │    │
│  │  - 联系人/频道              │    │           │  │  - Auth Middleware (JWT)     │    │
│  │  - 搜索                     │    │           │  └─────────────────────────────┘    │
│  └──────────────┬──────────────┘    │           │  ┌─────────────────────────────┐    │
│                 │ IPC               │           │  │  业务层 (Services)           │    │
│  ┌──────────────▼──────────────┐    │           │  │  - 用户服务                  │    │
│  │  Rust Core (Tauri Backend)  │    │           │  │  - 消息服务                  │    │
│  │  - SQLite 本地缓存          │    │           │  │  - 频道服务                  │    │
│  │  - WebSocket 客户端         │    │           │  │  - 文件服务                  │    │
│  │  - 本地文件存储             │    │           │  └─────────────────────────────┘    │
│  │  - 加密模块                 │    │           │  ┌─────────────────────────────┐    │
│  └─────────────────────────────┘    │           │  │  数据层 (Storage)            │    │
│                                     │           │  │  - PostgreSQL               │    │
└─────────────────────────────────────┘           │  │  - Redis                    │    │
                                                  │  │  - MinIO (S3 兼容)          │    │
                                                  │  └─────────────────────────────┘    │
                                                  └─────────────────────────────────────┘
```

## 概念模型

**会话 (Conversation)** 用于一对一聊天和群聊，是私密的消息容器。成员在创建时确定，消息仅成员可见。

**频道 (Channel)** 用于公开或半公开的主题讨论区。任何人可以浏览和加入，消息按话题组织。频道支持 @提醒 功能。

两者在消息存储上共用同一套消息表结构，通过 `conversation_id` 或 `channel_id` 字段区分归属。

## 通信协议

### WebSocket 消息格式

所有 WebSocket 消息使用 JSON 格式，包含 `type` 字段标识消息类型：

```json
{
  "type": "message.send",
  "payload": { ... },
  "request_id": "uuid",
  "timestamp": 1718249483
}
```

### 消息类型定义

| 类型 | 方向 | 说明 |
|------|------|------|
| `auth.token` | C→S | 认证握手 |
| `auth.ok` | S→C | 认证成功 |
| `message.send` | C→S | 发送消息 |
| `message.deliver` | S→C | 投递消息 |
| `message.ack` | S→C | 消息确认（带服务端 ID） |
| `message.read` | C→S | 已读回执 |
| `typing.start` | C→S | 开始输入 |
| `typing.stop` | C→S | 停止输入 |
| `presence.update` | S→C | 在线状态变更 |
| `channel.join` | C→S | 加入频道 |
| `channel.leave` | C→S | 离开频道 |

### REST API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/login` | POST | 用户登录，返回 JWT |
| `/api/users/me` | GET | 获取当前用户信息 |
| `/api/users/:id` | GET | 获取用户信息 |
| `/api/users/search` | GET | 搜索用户 |
| `/api/contacts` | GET | 联系人列表 |
| `/api/contacts` | POST | 添加联系人 |
| `/api/conversations` | GET | 会话列表 |
| `/api/conversations/:id/messages` | GET | 历史消息（分页） |
| `/api/channels` | GET/POST | 频道列表/创建频道 |
| `/api/channels/:id/messages` | GET | 频道消息（分页） |
| `/api/files/upload` | POST | 文件上传 |
| `/api/files/:id` | GET | 文件下载 |

## 客户端架构

### UI 布局

采用飞书经典的三栏布局：

- **左侧导航栏**（60px）— 消息、通讯录、频道、设置，深色背景
- **中间会话列表**（280px）— 搜索栏 + 会话列表，支持头像、未读数、最新消息预览
- **右侧聊天窗口**（flex）— 聊天头部 + 消息气泡 + 输入区域

### 前端模块划分

```
src/
├── components/
│   ├── sidebar/       # 左侧导航栏
│   │   ├── NavSidebar.tsx
│   │   └── NavItem.tsx
│   ├── conversation/  # 会话列表
│   │   ├── ConversationList.tsx
│   │   ├── ConversationItem.tsx
│   │   └── SearchBar.tsx
│   ├── chat/          # 聊天窗口
│   │   ├── ChatWindow.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageInput.tsx
│   │   └── TypingIndicator.tsx
│   ├── contact/       # 通讯录
│   │   ├── ContactList.tsx
│   │   ├── ContactItem.tsx
│   │   └── AddContact.tsx
│   ├── channel/       # 频道
│   │   ├── ChannelList.tsx
│   │   ├── ChannelView.tsx
│   │   └── ChannelTopic.tsx
│   └── common/        # 通用组件
│       ├── Avatar.tsx
│       ├── Badge.tsx
│       ├── Modal.tsx
│       └── Tooltip.tsx
├── hooks/
│   ├── useWebSocket.ts    # WebSocket 连接管理
│   ├── useChat.ts         # 聊天逻辑
│   ├── useAuth.ts         # 认证状态
│   └── useTauriIPC.ts     # Tauri IPC 封装
├── stores/
│   ├── authStore.ts       # 认证状态
│   ├── chatStore.ts       # 聊天消息
│   ├── contactStore.ts    # 联系人
│   └── channelStore.ts    # 频道
├── services/
│   ├── api.ts             # REST API 客户端
│   ├── ws.ts              # WebSocket 客户端
│   └── tauri.ts           # Tauri 命令封装
└── styles/
    └── theme.ts           # 飞书风格主题变量
```

### 状态管理 (Zustand)

```typescript
// 示例：chatStore 核心结构
interface ChatStore {
  conversations: Map<string, Conversation>;
  messages: Map<string, Message[]>;  // conversationId -> messages
  activeConversation: string | null;

  sendMessage: (conversationId: string, content: MessageContent) => Promise<void>;
  loadHistory: (conversationId: string, before?: string) => Promise<void>;
  markAsRead: (conversationId: string, messageId: string) => void;
  setActiveConversation: (id: string) => void;
}
```

### Tauri IPC 命令

```rust
// 客户端 Rust Core 职责
#[tauri::command]
async fn db_save_message(msg: Message) -> Result<(), String>;

#[tauri::command]
async fn db_get_messages(conversation_id: String, limit: u32) -> Result<Vec<Message>, String>;

#[tauri::command]
async fn ws_connect(token: String) -> Result<(), String>;

#[tauri::command]
async fn file_save(path: String, data: Vec<u8>) -> Result<String, String>;
```

## 后端架构

### 模块划分

```
server/src/
├── main.rs              # Axum 服务入口
├── api/
│   ├── mod.rs
│   ├── auth.rs          # 认证路由
│   ├── users.rs         # 用户路由
│   ├── conversations.rs # 会话路由
│   ├── channels.rs      # 频道路由
│   └── files.rs         # 文件路由
├── services/
│   ├── mod.rs
│   ├── auth.rs          # 认证逻辑
│   ├── user.rs          # 用户逻辑
│   ├── message.rs       # 消息逻辑
│   ├── channel.rs       # 频道逻辑
│   └── file.rs          # 文件逻辑
├── models/
│   ├── mod.rs
│   ├── user.rs          # 用户模型
│   ├── message.rs       # 消息模型
│   ├── conversation.rs  # 会话模型
│   └── channel.rs       # 频道模型
├── ws/
│   ├── mod.rs
│   ├── hub.rs           # WebSocket 连接管理中心
│   ├── handler.rs       # 消息分发处理
│   └── protocol.rs      # 协议定义
├── db/
│   ├── mod.rs
│   ├── pool.rs          # 连接池管理
│   └── migrations/      # 数据库迁移
└── config.rs            # 配置管理
```

### WebSocket Hub 设计

```
┌─────────────────────────────────────────┐
│              WebSocket Hub              │
│                                         │
│  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │ User A   │  │ User B   │  │ ...   │ │
│  │ (conn 1) │  │ (conn 1) │  │       │ │
│  └────┬─────┘  └────┬─────┘  └───────┘ │
│       │              │                   │
│  ┌────▼──────────────▼───────────────┐  │
│  │       Message Router              │  │
│  │  - 查找目标用户连接               │  │
│  │  - 消息持久化                     │  │
│  │  - 推送到目标用户                 │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌───────────────────────────────────┐  │
│  │       Presence Tracker            │  │
│  │  - 用户在线状态                   │  │
│  │  - 心跳检测 (30s)                │  │
│  │  - 断线重连处理                   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 数据模型

```sql
-- 用户表
CREATE TABLE users (
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
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL, -- 'direct' | 'group'
    name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 会话成员表
CREATE TABLE conversation_members (
    conversation_id UUID REFERENCES conversations(id),
    user_id UUID REFERENCES users(id),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

-- 消息表
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES conversations(id),
    sender_id UUID REFERENCES users(id),
    content_type VARCHAR(20) NOT NULL, -- 'text' | 'image' | 'file'
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 已读状态表
CREATE TABLE read_receipts (
    user_id UUID REFERENCES users(id),
    conversation_id UUID REFERENCES conversations(id),
    last_read_message_id UUID REFERENCES messages(id),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, conversation_id)
);

-- 频道表
CREATE TABLE channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 频道成员表
CREATE TABLE channel_members (
    channel_id UUID REFERENCES channels(id),
    user_id UUID REFERENCES users(id),
    role VARCHAR(20) DEFAULT 'member', -- 'owner' | 'admin' | 'member'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (channel_id, user_id)
);

-- 联系人表
CREATE TABLE contacts (
    user_id UUID REFERENCES users(id),
    contact_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending', -- 'pending' | 'accepted' | 'blocked'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, contact_id)
);

-- 索引
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_conversation_members_user ON conversation_members(user_id);
CREATE INDEX idx_channel_members_user ON channel_members(user_id);

-- 频道消息表
CREATE TABLE channel_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id UUID NOT NULL REFERENCES channels(id),
    sender_id UUID NOT NULL REFERENCES users(id),
    content_type VARCHAR(20) NOT NULL, -- 'text' | 'image' | 'file'
    content JSONB NOT NULL,
    parent_message_id UUID REFERENCES channel_messages(id), -- 话题回复
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_channel_messages_channel ON channel_messages(channel_id, created_at);
CREATE INDEX idx_channel_messages_sender ON channel_messages(sender_id);
```

## 项目结构 (Monorepo)

```
feiyu/
├── apps/
│   ├── desktop/                 # Tauri 桌面应用
│   │   ├── src-tauri/           # Rust Core
│   │   │   ├── Cargo.toml
│   │   │   ├── tauri.conf.json
│   │   │   └── src/
│   │   │       ├── main.rs
│   │   │       ├── commands/    # Tauri IPC 命令
│   │   │       ├── db/          # SQLite 本地缓存
│   │   │       ├── ws/          # WebSocket 客户端
│   │   │       └── storage/     # 本地文件管理
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── tailwind.config.js
│   │   └── src/                 # React 前端
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       ├── components/
│   │       ├── hooks/
│   │       ├── stores/
│   │       ├── services/
│   │       └── styles/
│   └── server/                  # 后端服务
│       ├── Cargo.toml
│       └── src/
│           ├── main.rs
│           ├── api/
│           ├── services/
│           ├── models/
│           ├── ws/
│           ├── db/
│           └── config.rs
├── packages/
│   ├── shared/                  # 共享类型定义
│   │   ├── package.json
│   │   └── src/
│   │       └── types.ts         # TypeScript 类型
│   └── ui/                      # 共享 UI 组件库
│       ├── package.json
│       └── src/
├── Cargo.toml                   # Rust workspace root
├── package.json                 # pnpm workspace root
├── pnpm-workspace.yaml
├── docker-compose.yml           # PostgreSQL + Redis + MinIO
└── .gitignore
```

## 开发环境搭建

### 依赖服务 (docker-compose.yml)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: feiyu
      POSTGRES_USER: feiyu
      POSTGRES_PASSWORD: feiyu_dev
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

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

## 实现阶段建议

### Phase 1：基础框架 (1-2 周)
- 搭建 Monorepo 项目结构
- Tauri 应用骨架 + React 前端模板
- 后端 Axum 服务骨架
- PostgreSQL + Redis + MinIO Docker 环境
- 基础用户注册/登录 (JWT)

### Phase 2：核心 IM (2-3 周)
- WebSocket Hub 实现
- 一对一聊天完整流程
- 消息持久化 + 历史消息加载
- SQLite 本地缓存
- 基础 UI 组件（会话列表、消息气泡、输入框）

### Phase 3：用户体系 (1-2 周)
- 联系人管理（添加、搜索、列表）
- 用户在线状态
- 个人资料管理

### Phase 4：频道功能 (1-2 周)
- 频道创建与管理
- 频道内消息
- @提醒功能
- 话题分类

### Phase 5：完善与优化 (1-2 周)
- 群聊功能
- 文件/图片消息
- 消息搜索
- 通知提醒
- UI 打磨与飞书风格细化

## 简化点

相比飞书完整实现，以下方面做了简化：

1. **无音视频通话** — 仅文字/图片/文件消息
2. **无机器人/应用** — 纯人工 IM
3. **单服务部署** — 不做微服务拆分，一个 Axum 进程承载所有业务
4. **无消息加密端到端** — 仅传输层 HTTPS/WSS 加密
5. **简化推送** — 仅 WebSocket 推送，不做 APNs/FCM
6. **无多设备同步** — 单设备登录
7. **简化权限** — 无细粒度 RBAC，仅频道 owner/admin/member 三级
