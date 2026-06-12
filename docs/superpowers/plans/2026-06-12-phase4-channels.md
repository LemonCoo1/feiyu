# Phase 4: 频道功能 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现频道的创建、加入、频道内消息收发、@提醒功能、话题分类，以及频道 UI。

**Architecture:** 后端复用 messages 表的 channel_messages 子表存储频道消息，新增频道 CRUD API 和频道内 WebSocket 消息类型。前端新增频道视图和频道相关 store。@提醒通过解析消息内容中的 `@user_id` 标记实现。

**Tech Stack:** Axum, SQLx, PostgreSQL, Zustand, React, TailwindCSS

---

## Task 1: 后端 — 频道模型与服务

**Files:**
- Create: `apps/server/src/models/channel.rs`
- Modify: `apps/server/src/models/mod.rs`
- Create: `apps/server/src/services/channel.rs`
- Modify: `apps/server/src/services/mod.rs`

- [ ] **Step 1: 创建 apps/server/src/models/channel.rs**

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Channel {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ChannelMember {
    pub channel_id: Uuid,
    pub user_id: Uuid,
    pub role: String,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct ChannelMessage {
    pub id: Uuid,
    pub channel_id: Uuid,
    pub sender_id: Uuid,
    pub content_type: String,
    pub content: serde_json::Value,
    pub parent_message_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateChannelRequest {
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ChannelWithMeta {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub member_count: i64,
}
```

- [ ] **Step 2: 更新 apps/server/src/models/mod.rs**

添加 `pub mod channel;`

- [ ] **Step 3: 创建 apps/server/src/services/channel.rs**

```rust
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::channel::{Channel, ChannelMember, ChannelMessage, ChannelWithMeta};

#[derive(Debug, thiserror::Error)]
pub enum ChannelError {
    #[error("Channel not found")]
    NotFound,
    #[error("Already a member")]
    AlreadyMember,
    #[error("Not a member")]
    NotMember,
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn create(
    pool: &PgPool,
    creator_id: Uuid,
    name: &str,
    description: Option<&str>,
) -> Result<Channel, ChannelError> {
    let channel = sqlx::query_as::<_, Channel>(
        r#"
        INSERT INTO channels (id, name, description, created_by)
        VALUES (gen_random_uuid(), $1, $2, $3)
        RETURNING *
        "#,
    )
    .bind(name)
    .bind(description)
    .bind(creator_id)
    .fetch_one(pool)
    .await?;

    // Add creator as owner
    sqlx::query(
        "INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, 'owner')",
    )
    .bind(channel.id)
    .bind(creator_id)
    .execute(pool)
    .await?;

    Ok(channel)
}

pub async fn list_for_user(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<ChannelWithMeta>, ChannelError> {
    let channels = sqlx::query_as::<_, ChannelWithMeta>(
        r#"
        SELECT c.*, 
            (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) as member_count
        FROM channels c
        JOIN channel_members cm ON c.id = cm.channel_id
        WHERE cm.user_id = $1
        ORDER BY c.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(channels)
}

pub async fn join(
    pool: &PgPool,
    channel_id: Uuid,
    user_id: Uuid,
) -> Result<(), ChannelError> {
    let existing = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2)",
    )
    .bind(channel_id)
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    if existing {
        return Err(ChannelError::AlreadyMember);
    }

    sqlx::query(
        "INSERT INTO channel_members (channel_id, user_id, role) VALUES ($1, $2, 'member')",
    )
    .bind(channel_id)
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_members(
    pool: &PgPool,
    channel_id: Uuid,
) -> Result<Vec<ChannelMember>, ChannelError> {
    let members = sqlx::query_as::<_, ChannelMember>(
        "SELECT * FROM channel_members WHERE channel_id = $1",
    )
    .bind(channel_id)
    .fetch_all(pool)
    .await?;

    Ok(members)
}

pub async fn get_messages(
    pool: &PgPool,
    channel_id: Uuid,
    before: Option<Uuid>,
    limit: i64,
) -> Result<Vec<ChannelMessage>, ChannelError> {
    let messages = if let Some(before_id) = before {
        sqlx::query_as::<_, ChannelMessage>(
            r#"
            SELECT * FROM channel_messages
            WHERE channel_id = $1 AND created_at < (SELECT created_at FROM channel_messages WHERE id = $2)
            ORDER BY created_at DESC
            LIMIT $3
            "#,
        )
        .bind(channel_id)
        .bind(before_id)
        .bind(limit)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, ChannelMessage>(
            r#"
            SELECT * FROM channel_messages
            WHERE channel_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(channel_id)
        .bind(limit)
        .fetch_all(pool)
        .await?
    };

    Ok(messages)
}

pub async fn send_message(
    pool: &PgPool,
    channel_id: Uuid,
    sender_id: Uuid,
    content_type: &str,
    content: serde_json::Value,
    parent_message_id: Option<Uuid>,
) -> Result<ChannelMessage, ChannelError> {
    // Verify membership
    let is_member = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM channel_members WHERE channel_id = $1 AND user_id = $2)",
    )
    .bind(channel_id)
    .bind(sender_id)
    .fetch_one(pool)
    .await?;

    if !is_member {
        return Err(ChannelError::NotMember);
    }

    let msg = sqlx::query_as::<_, ChannelMessage>(
        r#"
        INSERT INTO channel_messages (id, channel_id, sender_id, content_type, content, parent_message_id)
        VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)
        RETURNING *
        "#,
    )
    .bind(channel_id)
    .bind(sender_id)
    .bind(content_type)
    .bind(content)
    .bind(parent_message_id)
    .fetch_one(pool)
    .await?;

    Ok(msg)
}
```

- [ ] **Step 4: 更新 apps/server/src/services/mod.rs**

添加 `pub mod channel;`

- [ ] **Step 5: 编译检查**

```bash
cargo check -p feiyu-server
```

- [ ] **Step 6: 提交**

```bash
git add apps/server/src/models/ apps/server/src/services/
git commit -m "feat: add channel models and services"
```

---

## Task 2: 后端 — 频道 REST API 与 WebSocket

**Files:**
- Create: `apps/server/src/api/channels.rs`
- Modify: `apps/server/src/api/mod.rs`
- Modify: `apps/server/src/ws/protocol.rs`
- Modify: `apps/server/src/ws/handler.rs`

- [ ] **Step 1: 创建 apps/server/src/api/channels.rs**

```rust
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::channel::{Channel, ChannelMessage, ChannelWithMeta, CreateChannelRequest};
use crate::services::channel;

#[derive(Clone)]
pub struct ChannelState {
    pub pool: PgPool,
}

#[derive(Deserialize)]
pub struct UserIdQuery {
    pub user_id: Uuid,
}

#[derive(Deserialize)]
pub struct ChannelMessageQuery {
    pub before: Option<Uuid>,
    pub limit: Option<i64>,
}

#[derive(Deserialize)]
pub struct JoinRequest {
    pub user_id: Uuid,
}

pub async fn create(
    State(state): State<ChannelState>,
    Json(req): Json<CreateChannelRequest>,
) -> Result<Json<Channel>, (StatusCode, String)> {
    // TODO: get creator_id from auth
    channel::create(&state.pool, Uuid::nil(), &req.name, req.description.as_deref())
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn list(
    State(state): State<ChannelState>,
    Query(query): Query<UserIdQuery>,
) -> Result<Json<Vec<ChannelWithMeta>>, (StatusCode, String)> {
    channel::list_for_user(&state.pool, query.user_id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn join(
    State(state): State<ChannelState>,
    axum::extract::Path(channel_id): axum::extract::Path<Uuid>,
    Json(req): Json<JoinRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    channel::join(&state.pool, channel_id, req.user_id)
        .await
        .map(|_| StatusCode::OK)
        .map_err(|e| match e {
            channel::ChannelError::AlreadyMember => (StatusCode::CONFLICT, e.to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}

pub async fn get_messages(
    State(state): State<ChannelState>,
    axum::extract::Path(channel_id): axum::extract::Path<Uuid>,
    Query(query): Query<ChannelMessageQuery>,
) -> Result<Json<Vec<ChannelMessage>>, (StatusCode, String)> {
    let limit = query.limit.unwrap_or(50).min(100);
    channel::get_messages(&state.pool, channel_id, query.before, limit)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}
```

- [ ] **Step 2: 更新 apps/server/src/api/mod.rs**

注册频道路由：
```rust
.route("/api/channels", post(channels::create))
.route("/api/channels", get(channels::list))
.route("/api/channels/{channel_id}/join", post(channels::join))
.route("/api/channels/{channel_id}/messages", get(channels::get_messages))
```

- [ ] **Step 3: 更新 ws/protocol.rs 添加频道消息类型**

```rust
// 在 WsClientMessage 中添加：
#[serde(rename = "channel.message.send")]
ChannelMessageSend {
    channel_id: Uuid,
    content_type: String,
    content: serde_json::Value,
    parent_message_id: Option<Uuid>,
    client_msg_id: String,
},

// 在 WsServerMessage 中添加：
#[serde(rename = "channel.message.deliver")]
ChannelMessageDeliver {
    message: ChannelMessage,
    channel_id: Uuid,
},

#[serde(rename = "channel.message.ack")]
ChannelMessageAck {
    client_msg_id: String,
    server_msg_id: Uuid,
    channel_id: Uuid,
},
```

- [ ] **Step 4: 更新 ws/handler.rs 处理频道消息**

在 `handle_client_message` 中添加 `ChannelMessageSend` 分支：
- 持久化到 channel_messages 表
- 发送 ACK 给发送者
- 广播给频道所有成员

- [ ] **Step 5: 编译检查**

```bash
cargo check -p feiyu-server
```

- [ ] **Step 6: 提交**

```bash
git add apps/server/src/
git commit -m "feat: add channel REST API and WebSocket channel messages"
```

---

## Task 3: 前端 — 频道 Store 与 API

**Files:**
- Create: `apps/desktop/src/stores/channelStore.ts`
- Modify: `apps/desktop/src/services/api.ts`
- Modify: `apps/desktop/src/hooks/useWebSocket.ts`

- [ ] **Step 1: 更新 api.ts 添加频道 API**

```typescript
getChannels: (userId: string) =>
  request<any[]>(`/api/channels?user_id=${userId}`),

createChannel: (name: string, description?: string) =>
  request<any>("/api/channels", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  }),

joinChannel: (channelId: string, userId: string) =>
  request<void>(`/api/channels/${channelId}/join`, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  }),

getChannelMessages: (channelId: string, limit = 50, before?: string) => {
  const params = new URLSearchParams({ limit: String(limit) });
  if (before) params.set("before", before);
  return request<any[]>(`/api/channels/${channelId}/messages?${params}`);
},
```

- [ ] **Step 2: 创建 channelStore.ts**

```typescript
import { create } from "zustand";
import { api } from "../services/api";
import { wsClient } from "../services/ws";

interface Channel {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  member_count: number;
}

interface ChannelMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content_type: string;
  content: any;
  parent_message_id: string | null;
  created_at: string;
}

interface ChannelState {
  channels: Channel[];
  messages: Map<string, ChannelMessage[]>;
  activeChannelId: string | null;

  loadChannels: (userId: string) => Promise<void>;
  loadMessages: (channelId: string) => Promise<void>;
  setActiveChannel: (id: string | null) => void;
  sendMessage: (channelId: string, content: string, parentId?: string) => void;
  addIncomingMessage: (message: ChannelMessage) => void;
  createChannel: (name: string, description?: string) => Promise<void>;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: [],
  messages: new Map(),
  activeChannelId: null,

  loadChannels: async (userId) => {
    try {
      const channels = await api.getChannels(userId);
      set({ channels });
    } catch (e) {
      console.error("Failed to load channels:", e);
    }
  },

  loadMessages: async (channelId) => {
    try {
      const msgs = await api.getChannelMessages(channelId);
      set((state) => {
        const newMessages = new Map(state.messages);
        newMessages.set(channelId, msgs.reverse());
        return { messages: newMessages };
      });
    } catch (e) {
      console.error("Failed to load channel messages:", e);
    }
  },

  setActiveChannel: (id) => {
    set({ activeChannelId: id });
    if (id) get().loadMessages(id);
  },

  sendMessage: (channelId, content, parentId) => {
    wsClient.send({
      type: "channel.message.send",
      payload: {
        channel_id: channelId,
        content_type: "text",
        content: { text: content },
        parent_message_id: parentId || null,
        client_msg_id: crypto.randomUUID(),
      },
    });
  },

  addIncomingMessage: (message) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      const channelMsgs = newMessages.get(message.channel_id) || [];
      newMessages.set(message.channel_id, [...channelMsgs, message]);
      return { messages: newMessages };
    });
  },

  createChannel: async (name, description) => {
    try {
      await api.createChannel(name, description);
    } catch (e) {
      console.error("Failed to create channel:", e);
    }
  },
}));
```

- [ ] **Step 3: 更新 useWebSocket.ts 处理频道消息**

```typescript
const handleChannelDeliver = (payload: any) => {
  useChannelStore.getState().addIncomingMessage(payload.message);
};

wsClient.on("channel.message.deliver", handleChannelDeliver);
```

- [ ] **Step 4: 编译检查**

```bash
pnpm --filter @feiyu/desktop exec tsc --noEmit
```

- [ ] **Step 5: 提交**

```bash
git add apps/desktop/src/
git commit -m "feat: add channel store and API integration"
```

---

## Task 4: 前端 — 频道 UI 组件

**Files:**
- Create: `apps/desktop/src/components/channel/ChannelList.tsx`
- Create: `apps/desktop/src/components/channel/ChannelView.tsx`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: 创建 ChannelList.tsx**

```tsx
import { useState } from "react";
import { useChannelStore } from "../../stores/channelStore";
import { useAuthStore } from "../../stores/authStore";

export function ChannelList() {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const channels = useChannelStore((s) => s.channels);
  const activeId = useChannelStore((s) => s.activeChannelId);
  const setActive = useChannelStore((s) => s.setActiveChannel);
  const createChannel = useChannelStore((s) => s.createChannel);
  const user = useAuthStore((s) => s.user);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createChannel(newName, newDesc || undefined);
    setNewName("");
    setNewDesc("");
    setShowCreate(false);
    if (user) {
      useChannelStore.getState().loadChannels(user.id);
    }
  };

  return (
    <div className="w-[280px] bg-white border-r border-feiyu-border flex flex-col">
      <div className="px-4 py-3 border-b border-feiyu-border flex justify-between items-center">
        <h2 className="font-medium text-feiyu-text">频道</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="text-feiyu-primary text-sm hover:underline"
        >
          + 创建
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-feiyu-text-muted text-sm">
            <span>暂无频道</span>
          </div>
        ) : (
          channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActive(ch.id)}
              className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors text-left ${
                activeId === ch.id
                  ? "bg-feiyu-primary/10 border-l-2 border-feiyu-primary"
                  : "hover:bg-gray-50 border-l-2 border-transparent"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-purple-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                #
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-feiyu-text truncate">{ch.name}</div>
                <div className="text-xs text-feiyu-text-muted">{ch.member_count} 成员</div>
              </div>
            </button>
          ))
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[360px] p-6">
            <h3 className="font-medium text-feiyu-text mb-4">创建频道</h3>
            <input
              type="text"
              placeholder="频道名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-feiyu-border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-feiyu-primary"
              autoFocus
            />
            <textarea
              placeholder="频道描述（可选）"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full border border-feiyu-border rounded-lg px-3 py-2 text-sm mb-4 resize-none focus:outline-none focus:border-feiyu-primary"
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-feiyu-text-muted hover:text-feiyu-text"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-4 py-2 text-sm bg-feiyu-primary text-white rounded-lg hover:bg-feiyu-primary-hover disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 创建 ChannelView.tsx**

```tsx
import { useState, useEffect, useRef } from "react";
import { useChannelStore } from "../../stores/channelStore";
import { useAuthStore } from "../../stores/authStore";
import { MessageBubble } from "../chat/MessageBubble";

export function ChannelView() {
  const activeId = useChannelStore((s) => s.activeChannelId);
  const channels = useChannelStore((s) => s.channels);
  const messages = useChannelStore((s) => s.messages);
  const sendMessage = useChannelStore((s) => s.sendMessage);
  const user = useAuthStore((s) => s.user);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const channel = channels.find((c) => c.id === activeId);
  const msgs = activeId ? messages.get(activeId) || [] : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  if (!activeId || !channel) {
    return (
      <div className="flex-1 bg-feiyu-bg flex items-center justify-center">
        <span className="text-feiyu-text-muted text-sm">选择一个频道</span>
      </div>
    );
  }

  const handleSend = () => {
    if (!text.trim() || !activeId) return;
    sendMessage(activeId, text.trim());
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 bg-feiyu-bg flex flex-col">
      <div className="px-5 py-3 border-b border-feiyu-border bg-white">
        <div className="flex items-center gap-2">
          <span className="text-purple-500 font-bold">#</span>
          <span className="font-medium text-feiyu-text">{channel.name}</span>
          <span className="text-xs text-feiyu-text-muted">{channel.member_count} 成员</span>
        </div>
        {channel.description && (
          <p className="text-xs text-feiyu-text-muted mt-1">{channel.description}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {msgs.map((msg) => {
          const text = typeof msg.content === "object" && msg.content.text
            ? msg.content.text
            : JSON.stringify(msg.content);
          return (
            <MessageBubble
              key={msg.id}
              content={text}
              time={new Date(msg.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
              isOwn={msg.sender_id === user?.id}
              senderName={msg.sender_id === user?.id ? "我" : "他人"}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-feiyu-border px-5 py-3">
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`在 #${channel.name} 中发送消息...`}
            rows={1}
            className="flex-1 bg-gray-50 border border-feiyu-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-feiyu-primary"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="bg-feiyu-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-feiyu-primary-hover disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 更新 App.tsx 集成频道视图**

在 App 组件中：
- 导入 ChannelList, ChannelView
- 导入 useChannelStore
- 在 useEffect 中加载频道
- 在 channels 视图中渲染 ChannelList + ChannelView

- [ ] **Step 4: 编译检查**

```bash
pnpm --filter @feiyu/desktop exec tsc --noEmit
```

- [ ] **Step 5: 提交**

```bash
git add apps/desktop/src/
git commit -m "feat: add channel UI with list, view, and create"
```

---

## Task 5: 端到端验证

- [ ] **Step 1: 启动服务并测试频道流程**

```bash
docker compose up -d
cargo build -p feiyu-server && cargo run -p feiyu-server &
sleep 3

# 创建频道
curl -s -X POST http://localhost:3000/api/channels \
  -H "Content-Type: application/json" \
  -d '{"name":"技术分享","description":"分享技术文章和心得"}'

# 加入频道
curl -s -X POST http://localhost:3000/api/channels/<CHANNEL_ID>/join \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<USER_ID>"}'

# 列出频道
curl "http://localhost:3000/api/channels?user_id=<USER_ID>"

# 获取频道消息（空）
curl "http://localhost:3000/api/channels/<CHANNEL_ID>/messages"
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "chore: phase 4 complete - channels with messages and UI"
```
