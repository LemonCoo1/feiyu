# Phase 2: 核心 IM 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现完整的一对一聊天流程：WebSocket 实时通信、消息持久化、会话管理、客户端本地缓存，以及飞书风格的基础聊天 UI。

**Architecture:** 服务端新增 WebSocket Hub 管理连接和消息路由，消息通过 WebSocket 实时推送并持久化到 PostgreSQL。客户端通过 Tauri Rust Core 管理 WebSocket 连接和 SQLite 本地缓存，React 前端渲染聊天 UI。新增 AppState 统一管理 pool、config 和 WebSocket hub。

**Tech Stack:** Axum WebSocket, tokio-tungstenite, SQLite (rusqlite), Zustand, React, TailwindCSS

---

## 文件结构总览

### 服务端新增/修改
```
apps/server/src/
├── main.rs                    # 添加 ws 模块、AppState
├── api/
│   ├── mod.rs                 # 添加 conversations/messages 路由、ws 路由
│   ├── auth.rs                # 不变
│   ├── conversations.rs       # 新建：会话 API
│   └── messages.rs            # 新建：消息 API（REST 查询历史）
├── models/
│   ├── mod.rs                 # 添加 conversation, message
│   ├── user.rs                # 不变
│   ├── conversation.rs        # 新建：会话模型
│   └── message.rs             # 新建：消息模型
├── services/
│   ├── mod.rs                 # 添加 message, conversation
│   ├── auth.rs                # 不变
│   ├── message.rs             # 新建：消息服务
│   └── conversation.rs        # 新建：会话服务
└── ws/
    ├── mod.rs                 # 新建
    ├── hub.rs                 # 新建：WebSocket Hub
    ├── handler.rs             # 新建：消息处理
    └── protocol.rs            # 新建：协议定义
```

### 客户端新增/修改
```
apps/desktop/src/
├── App.tsx                    # 改为三栏布局 + 路由
├── main.tsx                   # 不变
├── styles/globals.css         # 不变
├── components/
│   ├── sidebar/
│   │   ├── NavSidebar.tsx     # 新建：左侧导航栏
│   │   └── NavItem.tsx        # 新建：导航项
│   ├── conversation/
│   │   ├── ConversationList.tsx # 新建：会话列表
│   │   ├── ConversationItem.tsx # 新建：会话项
│   │   └── SearchBar.tsx       # 新建：搜索栏
│   ├── chat/
│   │   ├── ChatWindow.tsx     # 新建：聊天窗口
│   │   ├── MessageList.tsx    # 新建：消息列表
│   │   ├── MessageBubble.tsx  # 新建：消息气泡
│   │   └── MessageInput.tsx   # 新建：输入框
│   └── common/
│       └── Avatar.tsx         # 新建：头像组件
├── hooks/
│   └── useWebSocket.ts        # 新建：WebSocket hook
├── stores/
│   ├── authStore.ts           # 新建：认证状态
│   └── chatStore.ts           # 新建：聊天状态
└── services/
    ├── api.ts                 # 新建：REST API 客户端
    └── ws.ts                  # 新建：WebSocket 客户端
```

### 共享类型修改
```
packages/shared/src/
└── types.ts                   # 添加会话、消息相关类型
```

---

## Task 1: 协议与模型定义

**Files:**
- Modify: `packages/shared/src/types.ts`
- Create: `apps/server/src/models/conversation.rs`
- Create: `apps/server/src/models/message.rs`
- Modify: `apps/server/src/models/mod.rs`
- Create: `apps/server/src/ws/protocol.rs`
- Create: `apps/server/src/ws/mod.rs`

- [ ] **Step 1: 更新 packages/shared/src/types.ts**

添加会话和消息相关类型（在现有类型之后追加）：

```typescript
// === Phase 2: 会话与消息 ===

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  joined_at: string;
}

export interface CreateConversationRequest {
  type: "direct" | "group";
  name?: string;
  member_ids: string[];
}

export interface ConversationWithLastMessage extends Conversation {
  last_message: Message | null;
  unread_count: number;
  other_user?: User; // for direct conversations
}

export interface SendMessageRequest {
  conversation_id: string;
  content_type: "text" | "image" | "file";
  content: Record<string, unknown>;
}

// WebSocket message payloads
export interface WsAuthPayload {
  token: string;
}

export interface WsAuthOkPayload {
  user_id: string;
}

export interface WsMessageSendPayload {
  conversation_id: string;
  content_type: "text" | "image" | "file";
  content: Record<string, unknown>;
  client_msg_id: string;
}

export interface WsMessageDeliverPayload {
  message: Message;
  conversation_id: string;
}

export interface WsMessageAckPayload {
  client_msg_id: string;
  server_msg_id: string;
  conversation_id: string;
}

export interface WsPresencePayload {
  user_id: string;
  status: "online" | "offline" | "away";
}
```

- [ ] **Step 2: 创建 apps/server/src/models/conversation.rs**

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Conversation {
    pub id: Uuid,
    pub r#type: String,
    pub name: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct ConversationMember {
    pub conversation_id: Uuid,
    pub user_id: Uuid,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateConversationRequest {
    pub r#type: String,
    pub name: Option<String>,
    pub member_ids: Vec<Uuid>,
}

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct ConversationWithMeta {
    pub id: Uuid,
    pub r#type: String,
    pub name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_message_content: Option<serde_json::Value>,
    pub last_message_at: Option<DateTime<Utc>>,
    pub other_user_id: Option<Uuid>,
    pub other_username: Option<String>,
    pub other_display_name: Option<String>,
}
```

- [ ] **Step 3: 创建 apps/server/src/models/message.rs**

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Message {
    pub id: Uuid,
    pub conversation_id: Uuid,
    pub sender_id: Option<Uuid>,
    pub content_type: String,
    pub content: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct GetMessagesQuery {
    pub before: Option<Uuid>,
    pub limit: Option<i64>,
}
```

- [ ] **Step 4: 更新 apps/server/src/models/mod.rs**

```rust
pub mod user;
pub mod conversation;
pub mod message;

pub use user::User;
pub use conversation::Conversation;
pub use message::Message;
```

- [ ] **Step 5: 创建 apps/server/src/ws/protocol.rs**

```rust
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsClientMessage {
    #[serde(rename = "auth.token")]
    AuthToken { token: String },

    #[serde(rename = "message.send")]
    MessageSend {
        conversation_id: Uuid,
        content_type: String,
        content: serde_json::Value,
        client_msg_id: String,
    },

    #[serde(rename = "message.read")]
    MessageRead {
        conversation_id: Uuid,
        message_id: Uuid,
    },

    #[serde(rename = "typing.start")]
    TypingStart { conversation_id: Uuid },

    #[serde(rename = "typing.stop")]
    TypingStop { conversation_id: Uuid },
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsServerMessage {
    #[serde(rename = "auth.ok")]
    AuthOk { user_id: Uuid },

    #[serde(rename = "auth.error")]
    AuthError { message: String },

    #[serde(rename = "message.deliver")]
    MessageDeliver {
        message: crate::models::message::Message,
        conversation_id: Uuid,
    },

    #[serde(rename = "message.ack")]
    MessageAck {
        client_msg_id: String,
        server_msg_id: Uuid,
        conversation_id: Uuid,
    },

    #[serde(rename = "presence.update")]
    PresenceUpdate {
        user_id: Uuid,
        status: String,
    },

    #[serde(rename = "typing.start")]
    TypingStart {
        user_id: Uuid,
        conversation_id: Uuid,
    },

    #[serde(rename = "typing.stop")]
    TypingStop {
        user_id: Uuid,
        conversation_id: Uuid,
    },
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WsEnvelope<T> {
    #[serde(flatten)]
    pub inner: T,
    pub request_id: Option<String>,
    pub timestamp: i64,
}
```

- [ ] **Step 6: 创建 apps/server/src/ws/mod.rs**

```rust
pub mod hub;
pub mod handler;
pub mod protocol;
```

- [ ] **Step 7: 编译检查**

```bash
cargo check -p feiyu-server
```

- [ ] **Step 8: 提交**

```bash
git add packages/shared/src/types.ts apps/server/src/models/ apps/server/src/ws/
git commit -m "feat: add conversation/message models and ws protocol"
```

---

## Task 2: WebSocket Hub

**Files:**
- Create: `apps/server/src/ws/hub.rs`
- Create: `apps/server/src/ws/handler.rs`

- [ ] **Step 1: 创建 apps/server/src/ws/hub.rs**

```rust
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use uuid::Uuid;

#[derive(Clone)]
pub struct Hub {
    /// user_id -> broadcast sender (each user gets their own channel)
    user_channels: Arc<RwLock<HashMap<Uuid, broadcast::Sender<String>>>>,
    /// conversation_id -> set of user_ids in that conversation
    conversation_members: Arc<RwLock<HashMap<Uuid, Vec<Uuid>>>>,
}

impl Hub {
    pub fn new() -> Self {
        Self {
            user_channels: Arc::new(RwLock::new(HashMap::new())),
            conversation_members: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    /// Register a user's connection. Returns a receiver for messages destined to this user.
    pub async fn connect(&self, user_id: Uuid) -> broadcast::Receiver<String> {
        let mut channels = self.user_channels.write().await;
        if let Some(tx) = channels.get(&user_id) {
            // User already has a channel (reconnection), reuse it
            return tx.subscribe();
        }
        let (tx, rx) = broadcast::channel(256);
        channels.insert(user_id, tx);
        rx
    }

    /// Remove a user's connection channel.
    pub async fn disconnect(&self, user_id: &Uuid) {
        let mut channels = self.user_channels.write().await;
        channels.remove(user_id);
    }

    /// Send a message to a specific user. Silently drops if user is not connected.
    pub async fn send_to_user(&self, user_id: &Uuid, msg: &str) {
        let channels = self.user_channels.read().await;
        if let Some(tx) = channels.get(user_id) {
            let _ = tx.send(msg.to_string());
        }
    }

    /// Send a message to all members of a conversation except the sender.
    pub async fn send_to_conversation(&self, conversation_id: &Uuid, sender_id: &Uuid, msg: &str) {
        let members = self.conversation_members.read().await;
        if let Some(user_ids) = members.get(conversation_id) {
            for uid in user_ids {
                if uid != sender_id {
                    self.send_to_user(uid, msg).await;
                }
            }
        }
    }

    /// Register members for a conversation (call when creating or loading a conversation).
    pub async fn register_conversation(&self, conversation_id: Uuid, user_ids: Vec<Uuid>) {
        let mut members = self.conversation_members.write().await;
        members.insert(conversation_id, user_ids);
    }
}
```

- [ ] **Step 2: 创建 apps/server/src/ws/handler.rs**

```rust
use axum::extract::ws::{Message, WebSocket};
use futures::{SinkExt, StreamExt};
use sqlx::PgPool;
use uuid::Uuid;

use super::hub::Hub;
use super::protocol::{WsClientMessage, WsServerMessage};
use crate::models::message::Message as DbMessage;

pub async fn handle_socket(mut socket: WebSocket, pool: PgPool, hub: Hub, jwt_secret: String) {
    let mut user_id: Option<Uuid> = None;
    let mut rx = None;

    // First message must be auth.token
    while let Some(Ok(msg)) = socket.next().await {
        if let Message::Text(text) = msg {
            match serde_json::from_str::<WsClientMessage>(&text) {
                Ok(WsClientMessage::AuthToken { token }) => {
                    match validate_jwt(&token, &jwt_secret) {
                        Ok(uid) => {
                            user_id = Some(uid);
                            let receiver = hub.connect(uid).await;
                            rx = Some(receiver);

                            let ok = serde_json::to_string(&WsServerMessage::AuthOk {
                                user_id: uid,
                            })
                            .unwrap();
                            let _ = socket.send(Message::Text(ok.into())).await;

                            // Broadcast online status
                            let presence = serde_json::to_string(&WsServerMessage::PresenceUpdate {
                                user_id: uid,
                                status: "online".to_string(),
                            })
                            .unwrap();
                            // TODO: broadcast to contacts
                            break;
                        }
                        Err(e) => {
                            let err = serde_json::to_string(&WsServerMessage::AuthError {
                                message: e.to_string(),
                            })
                            .unwrap();
                            let _ = socket.send(Message::Text(err.into())).await;
                            let _ = socket.close().await;
                            return;
                        }
                    }
                }
                _ => {
                    let err = serde_json::to_string(&WsServerMessage::AuthError {
                        message: "Expected auth.token message".to_string(),
                    })
                    .unwrap();
                    let _ = socket.send(Message::Text(err.into())).await;
                    let _ = socket.close().await;
                    return;
                }
            }
        }
    }

    let user_id = match user_id {
        Some(id) => id,
        None => return,
    };

    let mut rx = rx.unwrap();

    // Split socket for concurrent read/write
    let (mut sender, mut receiver) = socket.split();

    // Spawn task to forward hub messages to this socket
    let send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if sender.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }
    });

    // Handle incoming messages from this client
    let recv_task = {
        let hub = hub.clone();
        let pool = pool.clone();
        tokio::spawn(async move {
            while let Some(Ok(msg)) = receiver.next().await {
                if let Message::Text(text) = msg {
                    handle_client_message(&text, user_id, &pool, &hub).await;
                }
            }
        })
    };

    // Wait for either task to finish (disconnect)
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    // Cleanup
    hub.disconnect(&user_id).await;
    // Broadcast offline status (TODO: only if no other connections)
    let presence = serde_json::to_string(&WsServerMessage::PresenceUpdate {
        user_id,
        status: "offline".to_string(),
    })
    .unwrap();
    // TODO: broadcast to contacts
    let _ = presence;
}

async fn handle_client_message(text: &str, user_id: Uuid, pool: &PgPool, hub: &Hub) {
    let msg: WsClientMessage = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(_) => return,
    };

    match msg {
        WsClientMessage::MessageSend {
            conversation_id,
            content_type,
            content,
            client_msg_id,
        } => {
            // Persist message to database
            let result = sqlx::query_as::<_, DbMessage>(
                r#"
                INSERT INTO messages (id, conversation_id, sender_id, content_type, content)
                VALUES (gen_random_uuid(), $1, $2, $3, $4)
                RETURNING *
                "#,
            )
            .bind(conversation_id)
            .bind(user_id)
            .bind(&content_type)
            .bind(&content)
            .fetch_one(pool)
            .await;

            match result {
                Ok(db_msg) => {
                    // Send ACK to sender
                    let ack = serde_json::to_string(&WsServerMessage::MessageAck {
                        client_msg_id: client_msg_id.clone(),
                        server_msg_id: db_msg.id,
                        conversation_id,
                    })
                    .unwrap();
                    hub.send_to_user(&user_id, &ack).await;

                    // Deliver to other members
                    let deliver = serde_json::to_string(&WsServerMessage::MessageDeliver {
                        message: db_msg,
                        conversation_id,
                    })
                    .unwrap();
                    hub.send_to_conversation(&conversation_id, &user_id, &deliver).await;
                }
                Err(e) => {
                    tracing::error!("Failed to save message: {}", e);
                }
            }
        }
        WsClientMessage::MessageRead {
            conversation_id,
            message_id,
        } => {
            let _ = sqlx::query(
                r#"
                INSERT INTO read_receipts (user_id, conversation_id, last_read_message_id, updated_at)
                VALUES ($1, $2, $3, NOW())
                ON CONFLICT (user_id, conversation_id)
                DO UPDATE SET last_read_message_id = $3, updated_at = NOW()
                "#,
            )
            .bind(user_id)
            .bind(conversation_id)
            .bind(message_id)
            .execute(pool)
            .await;
        }
        WsClientMessage::TypingStart { conversation_id } => {
            let typing = serde_json::to_string(&WsServerMessage::TypingStart {
                user_id,
                conversation_id,
            })
            .unwrap();
            hub.send_to_conversation(&conversation_id, &user_id, &typing).await;
        }
        WsClientMessage::TypingStop { conversation_id } => {
            let typing = serde_json::to_string(&WsServerMessage::TypingStop {
                user_id,
                conversation_id,
            })
            .unwrap();
            hub.send_to_conversation(&conversation_id, &user_id, &typing).await;
        }
        _ => {}
    }
}

fn validate_jwt(token: &str, secret: &str) -> Result<Uuid, jsonwebtoken::errors::Error> {
    use jsonwebtoken::{decode, DecodingKey, Validation};
    use crate::models::user::Claims;

    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;
    Ok(token_data.claims.sub)
}
```

- [ ] **Step 3: 编译检查**

```bash
cargo check -p feiyu-server
```

- [ ] **Step 4: 提交**

```bash
git add apps/server/src/ws/
git commit -m "feat: add WebSocket hub with message routing and auth"
```

---

## Task 3: 会话与消息服务 + REST API

**Files:**
- Create: `apps/server/src/services/conversation.rs`
- Create: `apps/server/src/services/message.rs`
- Modify: `apps/server/src/services/mod.rs`
- Create: `apps/server/src/api/conversations.rs`
- Create: `apps/server/src/api/messages.rs`
- Modify: `apps/server/src/api/mod.rs`

- [ ] **Step 1: 创建 apps/server/src/services/conversation.rs**

```rust
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::conversation::{Conversation, ConversationMember, ConversationWithMeta};

#[derive(Debug, thiserror::Error)]
pub enum ConversationError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn create_direct(
    pool: &PgPool,
    user1_id: Uuid,
    user2_id: Uuid,
) -> Result<Conversation, ConversationError> {
    // Check if direct conversation already exists
    let existing = sqlx::query_as::<_, Conversation>(
        r#"
        SELECT c.* FROM conversations c
        JOIN conversation_members cm1 ON c.id = cm1.conversation_id
        JOIN conversation_members cm2 ON c.id = cm2.conversation_id
        WHERE c.type = 'direct'
          AND cm1.user_id = $1 AND cm2.user_id = $2
        LIMIT 1
        "#,
    )
    .bind(user1_id)
    .bind(user2_id)
    .fetch_optional(pool)
    .await?;

    if let Some(conv) = existing {
        return Ok(conv);
    }

    // Create new conversation
    let conv = sqlx::query_as::<_, Conversation>(
        r#"
        INSERT INTO conversations (id, type)
        VALUES (gen_random_uuid(), 'direct')
        RETURNING *
        "#,
    )
    .fetch_one(pool)
    .await?;

    // Add both members
    sqlx::query(
        "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2), ($1, $3)",
    )
    .bind(conv.id)
    .bind(user1_id)
    .bind(user2_id)
    .execute(pool)
    .await?;

    Ok(conv)
}

pub async fn list_for_user(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<ConversationWithMeta>, ConversationError> {
    let conversations = sqlx::query_as::<_, ConversationWithMeta>(
        r#"
        SELECT
            c.id,
            c.type,
            c.name,
            c.created_at,
            (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_content,
            (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
            (SELECT user_id FROM conversation_members WHERE conversation_id = c.id AND user_id != $1 LIMIT 1) as other_user_id,
            (SELECT username FROM users WHERE id = (SELECT user_id FROM conversation_members WHERE conversation_id = c.id AND user_id != $1 LIMIT 1)) as other_username,
            (SELECT display_name FROM users WHERE id = (SELECT user_id FROM conversation_members WHERE conversation_id = c.id AND user_id != $1 LIMIT 1)) as other_display_name
        FROM conversations c
        JOIN conversation_members cm ON c.id = cm.conversation_id
        WHERE cm.user_id = $1
        ORDER BY last_message_at DESC NULLS LAST, c.created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(conversations)
}

pub async fn get_members(
    pool: &PgPool,
    conversation_id: Uuid,
) -> Result<Vec<Uuid>, ConversationError> {
    let members = sqlx::query_scalar::<_, Uuid>(
        "SELECT user_id FROM conversation_members WHERE conversation_id = $1",
    )
    .bind(conversation_id)
    .fetch_all(pool)
    .await?;

    Ok(members)
}
```

- [ ] **Step 2: 创建 apps/server/src/services/message.rs**

```rust
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::message::Message;

#[derive(Debug, thiserror::Error)]
pub enum MessageError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn get_history(
    pool: &PgPool,
    conversation_id: Uuid,
    before: Option<Uuid>,
    limit: i64,
) -> Result<Vec<Message>, MessageError> {
    let messages = if let Some(before_id) = before {
        sqlx::query_as::<_, Message>(
            r#"
            SELECT * FROM messages
            WHERE conversation_id = $1 AND created_at < (SELECT created_at FROM messages WHERE id = $2)
            ORDER BY created_at DESC
            LIMIT $3
            "#,
        )
        .bind(conversation_id)
        .bind(before_id)
        .bind(limit)
        .fetch_all(pool)
        .await?
    } else {
        sqlx::query_as::<_, Message>(
            r#"
            SELECT * FROM messages
            WHERE conversation_id = $1
            ORDER BY created_at DESC
            LIMIT $2
            "#,
        )
        .bind(conversation_id)
        .bind(limit)
        .fetch_all(pool)
        .await?
    };

    Ok(messages)
}
```

- [ ] **Step 3: 更新 apps/server/src/services/mod.rs**

```rust
pub mod auth;
pub mod conversation;
pub mod message;
```

- [ ] **Step 4: 创建 apps/server/src/api/conversations.rs**

```rust
use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::conversation::{ConversationWithMeta, CreateConversationRequest};
use crate::services::conversation;

#[derive(Clone)]
pub struct ConversationState {
    pub pool: PgPool,
}

pub async fn list(
    State(state): State<ConversationState>,
    // TODO: extract user_id from JWT middleware
    Json(user_id): Json<Uuid>,
) -> Result<Json<Vec<ConversationWithMeta>>, (StatusCode, String)> {
    conversation::list_for_user(&state.pool, user_id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn create_direct(
    State(state): State<ConversationState>,
    Json(req): Json<CreateDirectRequest>,
) -> Result<Json<crate::models::conversation::Conversation>, (StatusCode, String)> {
    conversation::create_direct(&state.pool, req.user1_id, req.user2_id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

#[derive(Deserialize)]
pub struct CreateDirectRequest {
    pub user1_id: Uuid,
    pub user2_id: Uuid,
}
```

- [ ] **Step 5: 创建 apps/server/src/api/messages.rs**

```rust
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::message::Message;
use crate::services::message;

#[derive(Clone)]
pub struct MessageState {
    pub pool: PgPool,
}

#[derive(Deserialize)]
pub struct GetMessagesQuery {
    pub before: Option<Uuid>,
    pub limit: Option<i64>,
}

pub async fn get_history(
    State(state): State<MessageState>,
    axum::extract::Path(conversation_id): axum::extract::Path<Uuid>,
    Query(query): Query<GetMessagesQuery>,
) -> Result<Json<Vec<Message>>, (StatusCode, String)> {
    let limit = query.limit.unwrap_or(50).min(100);
    message::get_history(&state.pool, conversation_id, query.before, limit)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}
```

- [ ] **Step 6: 更新 apps/server/src/api/mod.rs**

```rust
pub mod auth;
pub mod conversations;
pub mod messages;

use axum::{
    routing::{get, post},
    Router,
};
use sqlx::PgPool;

use crate::config::Config;
use crate::ws::hub::Hub;

pub struct AppState {
    pub pool: PgPool,
    pub config: Config,
    pub hub: Hub,
}

pub fn router(pool: PgPool, config: &Config) -> Router {
    let hub = Hub::new();

    let auth_state = auth::AuthState {
        pool: pool.clone(),
        jwt_secret: config.jwt_secret.clone(),
    };

    let conv_state = conversations::ConversationState {
        pool: pool.clone(),
    };

    let msg_state = messages::MessageState {
        pool: pool.clone(),
    };

    let ws_state = crate::ws::handler::WsHandlerState {
        pool: pool.clone(),
        hub: hub.clone(),
        jwt_secret: config.jwt_secret.clone(),
    };

    Router::new()
        .route("/api/health", get(health))
        .route("/api/auth/register", post(auth::register))
        .route("/api/auth/login", post(auth::login))
        .route("/api/conversations", get(conversations::list))
        .route("/api/conversations/direct", post(conversations::create_direct))
        .route(
            "/api/conversations/{conversation_id}/messages",
            get(messages::get_history),
        )
        .route("/api/ws", get(crate::ws::handler::ws_handler))
        .with_state(AppState {
            pool,
            config: config.clone(),
            hub,
        })
}

async fn health() -> &'static str {
    "ok"
}
```

注意：此步骤需要调整路由结构，因为 Axum 要求所有路由共享同一个 State 类型。需要将 AppState 设计为统一的 state，或者使用嵌套路由。具体实现时需要处理这个约束。

- [ ] **Step 7: 更新 ws/handler.rs 添加 WsHandlerState 和 axum 路由支持**

在 ws/handler.rs 顶部添加：

```rust
use axum::extract::State as AxumState;
use axum::extract::WebSocketUpgrade;
use axum::response::IntoResponse;

#[derive(Clone)]
pub struct WsHandlerState {
    pub pool: PgPool,
    pub hub: Hub,
    pub jwt_secret: String,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    AxumState(state): AxumState<WsHandlerState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state.pool, state.hub, state.jwt_secret))
}
```

- [ ] **Step 8: 编译检查并修复类型错误**

```bash
cargo check -p feiyu-server
```

根据编译错误调整 State 类型统一问题。最终 main.rs 中的 router 函数签名可能需要改为接收 AppState。

- [ ] **Step 9: 测试会话创建和消息历史 API**

```bash
cargo run -p feiyu-server &
sleep 3

# Register two users
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@test.com","password":"pass123"}'
# Save user IDs from responses

curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"bob","email":"bob@test.com","password":"pass123"}'

# Create direct conversation
curl -s -X POST http://localhost:3000/api/conversations/direct \
  -H "Content-Type: application/json" \
  -d '{"user1_id":"<ALICE_ID>","user2_id":"<BOB_ID>"}'

# List conversations
curl -s -X GET http://localhost:3000/api/conversations \
  -H "Content-Type: application/json" \
  -d '"<ALICE_ID>"'

# Get message history (empty)
curl -s "http://localhost:3000/api/conversations/<CONV_ID>/messages?limit=10"

pkill -f feiyu-server; wait 2>/dev/null
```

- [ ] **Step 10: 提交**

```bash
git add apps/server/src/
git commit -m "feat: add conversation/message services and REST APIs"
```

---

## Task 4: 前端状态管理与 API 服务

**Files:**
- Create: `apps/desktop/src/services/api.ts`
- Create: `apps/desktop/src/services/ws.ts`
- Create: `apps/desktop/src/stores/authStore.ts`
- Create: `apps/desktop/src/stores/chatStore.ts`
- Create: `apps/desktop/src/hooks/useWebSocket.ts`

- [ ] **Step 1: 创建 apps/desktop/src/services/api.ts**

```typescript
const BASE_URL = "http://localhost:3000";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }

  return res.json();
}

export const api = {
  register: (data: {
    username: string;
    email: string;
    password: string;
    display_name?: string;
  }) => request<{ token: string; user: any }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  }),

  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: any }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getConversations: (userId: string) =>
    request<any[]>(`/api/conversations`, {
      method: "GET",
      body: JSON.stringify(userId),
    }),

  getMessages: (conversationId: string, limit = 50, before?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set("before", before);
    return request<any[]>(`/api/conversations/${conversationId}/messages?${params}`);
  },

  createDirectConversation: (user1Id: string, user2Id: string) =>
    request<any>("/api/conversations/direct", {
      method: "POST",
      body: JSON.stringify({ user1_id: user1Id, user2_id: user2Id }),
    }),
};
```

- [ ] **Step 2: 创建 apps/desktop/src/services/ws.ts**

```typescript
type MessageHandler = (data: any) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private token: string | null = null;
  private reconnectTimer: number | null = null;

  connect(token: string) {
    this.token = token;
    this.doConnect();
  }

  private doConnect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket("ws://localhost:3000/api/ws");

    this.ws.onopen = () => {
      // Send auth
      this.send({ type: "auth.token", payload: { token: this.token } });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.type;
        const handlers = this.handlers.get(type) || [];
        handlers.forEach((h) => h(data.payload));
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    this.ws.onclose = () => {
      // Auto-reconnect after 3 seconds
      if (this.token) {
        this.reconnectTimer = window.setTimeout(() => this.doConnect(), 3000);
      }
    };

    this.ws.onerror = (e) => {
      console.error("WS error:", e);
    };
  }

  disconnect() {
    this.token = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
    this.ws = null;
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  off(type: string, handler: MessageHandler) {
    const handlers = this.handlers.get(type) || [];
    this.handlers.set(
      type,
      handlers.filter((h) => h !== handler)
    );
  }

  sendMessage(conversationId: string, contentType: string, content: any) {
    this.send({
      type: "message.send",
      payload: {
        conversation_id: conversationId,
        content_type: contentType,
        content,
        client_msg_id: crypto.randomUUID(),
      },
    });
  }
}

export const wsClient = new WsClient();
```

- [ ] **Step 3: 创建 apps/desktop/src/stores/authStore.ts**

```typescript
import { create } from "zustand";
import { api } from "../services/api";
import { wsClient } from "../services/ws";

interface User {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.login({ email, password });
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      wsClient.connect(res.token);
      set({ user: res.user, token: res.token, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  register: async (username, email, password, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.register({ username, email, password, display_name: displayName });
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      wsClient.connect(res.token);
      set({ user: res.user, token: res.token, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    wsClient.disconnect();
    set({ user: null, token: null });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        wsClient.connect(token);
        set({ user, token });
      } catch {}
    }
  },
}));
```

- [ ] **Step 4: 创建 apps/desktop/src/stores/chatStore.ts**

```typescript
import { create } from "zustand";
import { api } from "../services/api";
import { wsClient } from "../services/ws";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content_type: string;
  content: any;
  created_at: string;
}

interface Conversation {
  id: string;
  type: string;
  name: string | null;
  created_at: string;
  last_message_content?: any;
  last_message_at?: string;
  other_user_id?: string;
  other_username?: string;
  other_display_name?: string;
}

interface ChatState {
  conversations: Conversation[];
  messages: Map<string, Message[]>;
  activeConversationId: string | null;
  typingUsers: Map<string, Set<string>>; // conversationId -> Set<userId>

  loadConversations: (userId: string) => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  sendMessage: (conversationId: string, content: string) => void;
  addIncomingMessage: (message: Message) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: new Map(),
  activeConversationId: null,
  typingUsers: new Map(),

  loadConversations: async (userId) => {
    try {
      const convs = await api.getConversations(userId);
      set({ conversations: convs });
    } catch (e) {
      console.error("Failed to load conversations:", e);
    }
  },

  loadMessages: async (conversationId) => {
    try {
      const msgs = await api.getMessages(conversationId);
      set((state) => {
        const newMessages = new Map(state.messages);
        newMessages.set(conversationId, msgs.reverse());
        return { messages: newMessages };
      });
    } catch (e) {
      console.error("Failed to load messages:", e);
    }
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
    if (id) {
      get().loadMessages(id);
    }
  },

  sendMessage: (conversationId, content) => {
    wsClient.sendMessage(conversationId, "text", { text: content });
  },

  addIncomingMessage: (message) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      const convMsgs = newMessages.get(message.conversation_id) || [];
      newMessages.set(message.conversation_id, [...convMsgs, message]);

      // Update conversation's last message
      const convs = state.conversations.map((c) =>
        c.id === message.conversation_id
          ? { ...c, last_message_content: message.content, last_message_at: message.created_at }
          : c
      );

      return { messages: newMessages, conversations: convs };
    });
  },
}));
```

- [ ] **Step 5: 创建 apps/desktop/src/hooks/useWebSocket.ts**

```typescript
import { useEffect } from "react";
import { wsClient } from "../services/ws";
import { useChatStore } from "../stores/chatStore";

export function useWebSocket() {
  const addIncomingMessage = useChatStore((s) => s.addIncomingMessage);

  useEffect(() => {
    const handleDeliver = (payload: any) => {
      addIncomingMessage(payload.message);
    };

    const handleAck = (payload: any) => {
      // Could update local message with server ID
      console.log("Message ACK:", payload);
    };

    wsClient.on("message.deliver", handleDeliver);
    wsClient.on("message.ack", handleAck);

    return () => {
      wsClient.off("message.deliver", handleDeliver);
      wsClient.off("message.ack", handleAck);
    };
  }, [addIncomingMessage]);
}
```

- [ ] **Step 6: 编译检查**

```bash
cd /Users/xucong/Documents/projects/feiyu
pnpm --filter @feiyu/desktop exec tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: 提交**

```bash
git add apps/desktop/src/stores/ apps/desktop/src/services/ apps/desktop/src/hooks/
git commit -m "feat: add frontend auth/chat stores, api service, ws client"
```

---

## Task 5: 聊天 UI 组件

**Files:**
- Create: `apps/desktop/src/components/common/Avatar.tsx`
- Create: `apps/desktop/src/components/sidebar/NavSidebar.tsx`
- Create: `apps/desktop/src/components/sidebar/NavItem.tsx`
- Create: `apps/desktop/src/components/conversation/ConversationList.tsx`
- Create: `apps/desktop/src/components/conversation/ConversationItem.tsx`
- Create: `apps/desktop/src/components/conversation/SearchBar.tsx`
- Create: `apps/desktop/src/components/chat/ChatWindow.tsx`
- Create: `apps/desktop/src/components/chat/MessageList.tsx`
- Create: `apps/desktop/src/components/chat/MessageBubble.tsx`
- Create: `apps/desktop/src/components/chat/MessageInput.tsx`
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: 创建 Avatar 组件**

`apps/desktop/src/components/common/Avatar.tsx`:
```tsx
interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
}

const colors = ["#4f9cf7", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#ec4899"];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function Avatar({ name, size = "md", online }: AvatarProps) {
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-12 h-12 text-lg" : "w-10 h-10 text-sm";
  const color = colors[hashCode(name) % colors.length];
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="relative flex-shrink-0">
      <div
        className={`${sizeClass} rounded-lg flex items-center justify-center text-white font-bold`}
        style={{ backgroundColor: color }}
      >
        {initial}
      </div>
      {online !== undefined && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
            online ? "bg-green-500" : "bg-gray-400"
          }`}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: 创建 NavSidebar**

`apps/desktop/src/components/sidebar/NavItem.tsx`:
```tsx
interface NavItemProps {
  icon: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors ${
        active
          ? "bg-gray-600 text-feiyu-primary"
          : "text-gray-400 hover:bg-gray-700 hover:text-gray-300"
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[9px] leading-none">{label}</span>
    </button>
  );
}
```

`apps/desktop/src/components/sidebar/NavSidebar.tsx`:
```tsx
import { NavItem } from "./NavItem";

type NavView = "messages" | "contacts" | "channels" | "settings";

interface NavSidebarProps {
  activeView: NavView;
  onViewChange: (view: NavView) => void;
}

export function NavSidebar({ activeView, onViewChange }: NavSidebarProps) {
  return (
    <div className="w-[60px] bg-feiyu-sidebar flex flex-col items-center pt-3 gap-2">
      <div className="w-10 h-10 rounded-xl bg-feiyu-primary flex items-center justify-center text-white text-xl font-bold mb-3">
        F
      </div>
      <NavItem
        icon="💬"
        label="消息"
        active={activeView === "messages"}
        onClick={() => onViewChange("messages")}
      />
      <NavItem
        icon="👥"
        label="通讯录"
        active={activeView === "contacts"}
        onClick={() => onViewChange("contacts")}
      />
      <NavItem
        icon="📋"
        label="频道"
        active={activeView === "channels"}
        onClick={() => onViewChange("channels")}
      />
      <div className="flex-1" />
      <NavItem
        icon="⚙️"
        label="设置"
        active={activeView === "settings"}
        onClick={() => onViewChange("settings")}
      />
    </div>
  );
}
```

- [ ] **Step 3: 创建会话列表组件**

`apps/desktop/src/components/conversation/SearchBar.tsx`:
```tsx
export function SearchBar() {
  return (
    <div className="px-3 py-2">
      <input
        type="text"
        placeholder="搜索联系人、消息..."
        className="w-full bg-white border border-feiyu-border rounded-md px-3 py-2 text-sm text-feiyu-text placeholder:text-feiyu-text-muted focus:outline-none focus:border-feiyu-primary"
      />
    </div>
  );
}
```

`apps/desktop/src/components/conversation/ConversationItem.tsx`:
```tsx
import { Avatar } from "../common/Avatar";

interface ConversationItemProps {
  name: string;
  lastMessage: string;
  time: string;
  active?: boolean;
  unread?: number;
  onClick?: () => void;
}

export function ConversationItem({
  name,
  lastMessage,
  time,
  active,
  unread,
  onClick,
}: ConversationItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2 flex items-center gap-2.5 transition-colors text-left ${
        active
          ? "bg-feiyu-primary/10 border-l-2 border-feiyu-primary"
          : "hover:bg-gray-100 border-l-2 border-transparent"
      }`}
    >
      <Avatar name={name} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-feiyu-text truncate">{name}</span>
          <span className="text-[11px] text-feiyu-text-muted flex-shrink-0 ml-2">{time}</span>
        </div>
        <div className="text-xs text-feiyu-text-secondary truncate mt-0.5">
          {lastMessage}
        </div>
      </div>
      {unread && unread > 0 ? (
        <span className="bg-red-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </button>
  );
}
```

`apps/desktop/src/components/conversation/ConversationList.tsx`:
```tsx
import { SearchBar } from "./SearchBar";
import { ConversationItem } from "./ConversationItem";
import { useChatStore } from "../../stores/chatStore";

export function ConversationList() {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeConversationId);
  const setActive = useChatStore((s) => s.setActiveConversation);

  const formatTime = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  const getLastMessage = (conv: any) => {
    if (!conv.last_message_content) return "暂无消息";
    const content = conv.last_message_content;
    if (content.text) return content.text;
    if (typeof content === "string") return content;
    return JSON.stringify(content);
  };

  return (
    <div className="w-[280px] bg-white border-r border-feiyu-border flex flex-col">
      <SearchBar />
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-feiyu-text-muted text-sm">
            暂无会话
          </div>
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              name={conv.other_display_name || conv.other_username || conv.name || "未知"}
              lastMessage={getLastMessage(conv)}
              time={formatTime(conv.last_message_at)}
              active={activeId === conv.id}
              onClick={() => setActive(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 创建聊天窗口组件**

`apps/desktop/src/components/chat/MessageBubble.tsx`:
```tsx
import { Avatar } from "../common/Avatar";

interface MessageBubbleProps {
  content: string;
  time: string;
  isOwn: boolean;
  senderName: string;
}

export function MessageBubble({ content, time, isOwn, senderName }: MessageBubbleProps) {
  return (
    <div className={`flex gap-2 max-w-[70%] ${isOwn ? "ml-auto flex-row-reverse" : ""}`}>
      <Avatar name={senderName} size="sm" />
      <div>
        <div
          className={`px-3 py-2 rounded-lg text-sm leading-relaxed ${
            isOwn
              ? "bg-feiyu-primary text-white"
              : "bg-gray-100 text-feiyu-text"
          }`}
        >
          {content}
        </div>
        <div className={`text-[11px] text-feiyu-text-muted mt-1 ${isOwn ? "text-right" : ""}`}>
          {time}
        </div>
      </div>
    </div>
  );
}
```

`apps/desktop/src/components/chat/MessageList.tsx`:
```tsx
import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { useChatStore } from "../../stores/chatStore";
import { useAuthStore } from "../../stores/authStore";

export function MessageList() {
  const activeId = useChatStore((s) => s.activeConversationId);
  const messages = useChatStore((s) => s.messages);
  const user = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);

  const msgs = activeId ? messages.get(activeId) || [] : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  if (!activeId) {
    return (
      <div className="flex-1 flex items-center justify-center text-feiyu-text-muted">
        选择一个会话开始聊天
      </div>
    );
  }

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
      {msgs.map((msg) => {
        const content = msg.content;
        const text = typeof content === "object" && content.text ? content.text : JSON.stringify(content);
        return (
          <MessageBubble
            key={msg.id}
            content={text}
            time={formatTime(msg.created_at)}
            isOwn={msg.sender_id === user?.id}
            senderName={msg.sender_id === user?.id ? "我" : "对方"}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
```

`apps/desktop/src/components/chat/MessageInput.tsx`:
```tsx
import { useState, KeyboardEvent } from "react";
import { useChatStore } from "../../stores/chatStore";

export function MessageInput() {
  const [text, setText] = useState("");
  const activeId = useChatStore((s) => s.activeConversationId);
  const sendMessage = useChatStore((s) => s.sendMessage);

  const handleSend = () => {
    if (!text.trim() || !activeId) return;
    sendMessage(activeId, text.trim());
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!activeId) return null;

  return (
    <div className="border-t border-feiyu-border px-5 py-3">
      <div className="flex items-center gap-2 mb-2 text-feiyu-text-muted">
        <button className="hover:text-feiyu-text transition-colors text-lg" title="表情">😊</button>
        <button className="hover:text-feiyu-text transition-colors text-lg" title="附件">📎</button>
        <button className="hover:text-feiyu-text transition-colors text-lg" title="图片">📷</button>
      </div>
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          rows={1}
          className="flex-1 bg-gray-50 border border-feiyu-border rounded-lg px-3 py-2 text-sm text-feiyu-text resize-none focus:outline-none focus:border-feiyu-primary"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="bg-feiyu-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-feiyu-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          发送
        </button>
      </div>
    </div>
  );
}
```

`apps/desktop/src/components/chat/ChatWindow.tsx`:
```tsx
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { useChatStore } from "../../stores/chatStore";

export function ChatWindow() {
  const activeId = useChatStore((s) => s.activeConversationId);
  const conversations = useChatStore((s) => s.conversations);

  const conv = conversations.find((c) => c.id === activeId);
  const title = conv
    ? conv.other_display_name || conv.other_username || conv.name || "未知"
    : "";

  if (!activeId) {
    return (
      <div className="flex-1 bg-feiyu-bg flex items-center justify-center">
        <span className="text-feiyu-text-muted text-sm">选择一个会话开始聊天</span>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-feiyu-bg flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-feiyu-border bg-white flex justify-between items-center">
        <div>
          <span className="font-medium text-feiyu-text">{title}</span>
        </div>
      </div>
      {/* Messages */}
      <MessageList />
      {/* Input */}
      <MessageInput />
    </div>
  );
}
```

- [ ] **Step 5: 更新 App.tsx**

```tsx
import { useState, useEffect } from "react";
import { NavSidebar } from "./components/sidebar/NavSidebar";
import { ConversationList } from "./components/conversation/ConversationList";
import { ChatWindow } from "./components/chat/ChatWindow";
import { useAuthStore } from "./stores/authStore";
import { useChatStore } from "./stores/chatStore";
import { useWebSocket } from "./hooks/useWebSocket";

type NavView = "messages" | "contacts" | "channels" | "settings";

function App() {
  const [activeView, setActiveView] = useState<NavView>("messages");
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const loadConversations = useChatStore((s) => s.loadConversations);

  // Wire up WebSocket message handlers
  useWebSocket();

  useEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    if (user) {
      loadConversations(user.id);
    }
  }, [user]);

  // Login/Register form
  if (!user || !token) {
    return <AuthScreen onLogin={login} onRegister={register} />;
  }

  return (
    <div className="flex h-screen w-screen">
      <NavSidebar activeView={activeView} onViewChange={setActiveView} />
      {activeView === "messages" && (
        <>
          <ConversationList />
          <ChatWindow />
        </>
      )}
      {activeView !== "messages" && (
        <div className="flex-1 bg-feiyu-bg flex items-center justify-center">
          <span className="text-feiyu-text-muted">
            {activeView === "contacts" && "通讯录 - 开发中"}
            {activeView === "channels" && "频道 - 开发中"}
            {activeView === "settings" && "设置 - 开发中"}
          </span>
        </div>
      )}
    </div>
  );
}

function AuthScreen({
  onLogin,
  onRegister,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (username: string, email: string, password: string) => Promise<void>;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const error = useAuthStore((s) => s.error);
  const isLoading = useAuthStore((s) => s.isLoading);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      await onLogin(email, password);
    } else {
      await onRegister(username, email, password);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-feiyu-bg">
      <div className="bg-white rounded-xl shadow-lg p-8 w-[360px]">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-feiyu-primary flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
            F
          </div>
          <h1 className="text-xl font-bold text-feiyu-text">飞语</h1>
          <p className="text-sm text-feiyu-text-muted mt-1">
            {mode === "login" ? "登录你的账号" : "创建新账号"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <input
              type="text"
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-feiyu-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-feiyu-primary"
              required
            />
          )}
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-feiyu-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-feiyu-primary"
            required
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-feiyu-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-feiyu-primary"
            required
          />
          {error && (
            <p className="text-red-500 text-xs">{error}</p>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-feiyu-primary text-white rounded-lg py-2.5 text-sm font-medium hover:bg-feiyu-primary-hover disabled:opacity-50 transition-colors"
          >
            {isLoading ? "请稍候..." : mode === "login" ? "登录" : "注册"}
          </button>
        </form>

        <p className="text-center mt-4 text-sm text-feiyu-text-muted">
          {mode === "login" ? "没有账号？" : "已有账号？"}
          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-feiyu-primary hover:underline ml-1"
          >
            {mode === "login" ? "注册" : "登录"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default App;
```

- [ ] **Step 6: 编译检查**

```bash
cd /Users/xucong/Documents/projects/feiyu
pnpm --filter @feiyu/desktop exec tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 7: 提交**

```bash
git add apps/desktop/src/
git commit -m "feat: add chat UI components with feiyu-style design"
```

---

## Task 6: 端到端集成测试

- [ ] **Step 1: 启动 Docker 服务**

```bash
cd /Users/xucong/Documents/projects/feiyu
docker compose up -d
docker compose ps
```

- [ ] **Step 2: 编译并启动后端**

```bash
cargo build -p feiyu-server && cargo run -p feiyu-server &
sleep 3
curl http://localhost:3000/api/health
# Expected: ok
```

- [ ] **Step 3: 启动前端 dev server**

```bash
pnpm --filter @feiyu/desktop dev &
sleep 3
# Expected: Vite dev server running on http://localhost:1420
```

- [ ] **Step 4: 注册两个测试用户**

```bash
# User A
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","email":"alice@test.com","password":"pass123","display_name":"Alice"}'

# User B
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"bob","email":"bob@test.com","password":"pass123","display_name":"Bob"}'
```

- [ ] **Step 5: 创建会话**

```bash
curl -s -X POST http://localhost:3000/api/conversations/direct \
  -H "Content-Type: application/json" \
  -d '{"user1_id":"<ALICE_ID>","user2_id":"<BOB_ID>"}'
```

- [ ] **Step 6: 用 wscat 测试 WebSocket**

```bash
npx wscat -c ws://localhost:3000/api/ws
> {"type":"auth.token","payload":{"token":"<ALICE_TOKEN>"}}
< {"type":"auth.ok","payload":{"user_id":"..."}}
> {"type":"message.send","payload":{"conversation_id":"<CONV_ID>","content_type":"text","content":{"text":"hello!"},"client_msg_id":"test-1"}}
< {"type":"message.ack",...}
< {"type":"message.deliver",...}
```

- [ ] **Step 7: 验证消息已持久化**

```bash
curl -s "http://localhost:3000/api/conversations/<CONV_ID>/messages?limit=10"
# Expected: array with the sent message
```

- [ ] **Step 8: 提交**

```bash
git add -A
git commit -m "chore: phase 2 complete - core IM with websocket, chat UI"
```

---

## 后续 Phase 概览

- **Phase 3: 用户体系** — 联系人管理、在线状态、个人资料
- **Phase 4: 频道功能** — 频道创建、频道消息、@提醒
- **Phase 5: 完善优化** — 群聊、文件消息、搜索、通知、UI 打磨
