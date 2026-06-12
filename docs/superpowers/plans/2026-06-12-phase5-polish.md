# Phase 5: 完善与优化 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking。

**Goal:** 完善群聊功能、添加文件/图片消息支持、实现消息搜索、通知提醒、以及 UI 打磨与飞书风格细化。

**Architecture:** 群聊复用会话模型（type='group'），文件消息通过 MinIO 上传后在消息中引用 URL。消息搜索使用 PostgreSQL 全文搜索。通知使用 Tauri 的通知 API。UI 打磨集中在 TailwindCSS 主题和组件微调。

**Tech Stack:** Axum, SQLx, PostgreSQL, MinIO (S3), Tauri notifications, Zustand, React, TailwindCSS

---

## Task 1: 群聊功能

**Files:**
- Modify: `apps/server/src/services/conversation.rs`
- Modify: `apps/server/src/api/conversations.rs`
- Modify: `apps/desktop/src/services/api.ts`
- Modify: `apps/desktop/src/stores/chatStore.ts`

- [ ] **Step 1: 后端 — 添加群聊创建**

在 `conversation.rs` 中添加：

```rust
pub async fn create_group(
    pool: &PgPool,
    creator_id: Uuid,
    name: &str,
    member_ids: &[Uuid],
) -> Result<Conversation, ConversationError> {
    let conv = sqlx::query_as::<_, Conversation>(
        r#"
        INSERT INTO conversations (id, type, name)
        VALUES (gen_random_uuid(), 'group', $1)
        RETURNING *
        "#,
    )
    .bind(name)
    .fetch_one(pool)
    .await?;

    // Add all members (including creator)
    let mut all_members = vec![creator_id];
    all_members.extend_from_slice(member_ids);
    all_members.dedup();

    for member_id in &all_members {
        sqlx::query(
            "INSERT INTO conversation_members (conversation_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        )
        .bind(conv.id)
        .bind(member_id)
        .execute(pool)
        .await?;
    }

    Ok(conv)
}
```

- [ ] **Step 2: 后端 — 添加群聊 API**

在 `conversations.rs` 中添加：

```rust
#[derive(Deserialize)]
pub struct CreateGroupRequest {
    pub creator_id: Uuid,
    pub name: String,
    pub member_ids: Vec<Uuid>,
}

pub async fn create_group(
    State(state): State<ConversationState>,
    Json(req): Json<CreateGroupRequest>,
) -> Result<Json<Conversation>, (StatusCode, String)> {
    conversation::create_group(&state.pool, req.creator_id, &req.name, &req.member_ids)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}
```

注册路由：`.route("/api/conversations/group", post(conversations::create_group))`

- [ ] **Step 3: 前端 — 更新 API 和 Store**

```typescript
// api.ts
createGroupConversation: (creatorId: string, name: string, memberIds: string[]) =>
  request<any>("/api/conversations/group", {
    method: "POST",
    body: JSON.stringify({ creator_id: creatorId, name, member_ids: memberIds }),
  }),
```

更新 chatStore 以支持群聊会话显示（群聊显示群名，不显示 other_user）。

- [ ] **Step 4: 前端 — 群聊 UI 适配**

更新 ConversationItem 和 ChatWindow 以正确显示群聊头像和名称。

- [ ] **Step 5: 编译检查**

```bash
cargo check -p feiyu-server
pnpm --filter @feiyu/desktop exec tsc --noEmit
```

- [ ] **Step 6: 提交**

```bash
git add apps/server/src/ apps/desktop/src/
git commit -m "feat: add group conversation support"
```

---

## Task 2: 文件/图片消息

**Files:**
- Create: `apps/server/src/api/files.rs`
- Create: `apps/server/src/services/file.rs`
- Modify: `apps/server/src/api/mod.rs`
- Modify: `apps/desktop/src/services/api.ts`

- [ ] **Step 1: 后端 — 文件上传服务**

```rust
// services/file.rs
use std::path::PathBuf;
use uuid::Uuid;

pub struct FileService {
    pub upload_dir: PathBuf,
}

impl FileService {
    pub fn new(upload_dir: &str) -> Self {
        let dir = PathBuf::from(upload_dir);
        std::fs::create_dir_all(&dir).ok();
        Self { upload_dir: dir }
    }

    pub async fn save(&self, filename: &str, data: &[u8]) -> Result<String, std::io::Error> {
        let ext = std::path::Path::new(filename)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin");
        let stored_name = format!("{}.{}", Uuid::new_v4(), ext);
        let path = self.upload_dir.join(&stored_name);
        tokio::fs::write(&path, data).await?;
        Ok(stored_name)
    }

    pub fn get_path(&self, stored_name: &str) -> PathBuf {
        self.upload_dir.join(stored_name)
    }
}
```

- [ ] **Step 2: 后端 — 文件上传 API**

```rust
// api/files.rs
use axum::extract::{Multipart, State};
use axum::http::StatusCode;
use axum::Json;
use serde::Serialize;

#[derive(Clone)]
pub struct FileState {
    pub file_service: crate::services::file::FileService,
}

#[derive(Serialize)]
pub struct UploadResponse {
    pub url: String,
    pub filename: String,
}

pub async fn upload(
    State(state): State<FileState>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, (StatusCode, String)> {
    while let Some(field) = multipart.next_field().await.map_err(|e| {
        (StatusCode::BAD_REQUEST, e.to_string())
    })? {
        let name = field.name().unwrap_or("file").to_string();
        let file_name = field.file_name().unwrap_or("unknown").to_string();
        let data = field.bytes().await.map_err(|e| {
            (StatusCode::BAD_REQUEST, e.to_string())
        })?;

        let stored = state.file_service.save(&file_name, &data).await.map_err(|e| {
            (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
        })?;

        return Ok(Json(UploadResponse {
            url: format!("/api/files/{}", stored),
            filename: file_name,
        }));
    }

    Err((StatusCode::BAD_REQUEST, "No file provided".to_string()))
}

pub async fn download(
    State(state): State<FileState>,
    axum::extract::Path(filename): axum::extract::Path<String>,
) -> Result<axum::response::Response, (StatusCode, String)> {
    let path = state.file_service.get_path(&filename);
    if !path.exists() {
        return Err((StatusCode::NOT_FOUND, "File not found".to_string()));
    }

    let data = tokio::fs::read(&path).await.map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, e.to_string())
    })?;

    Ok(axum::response::Response::builder()
        .header("Content-Type", "application/octet-stream")
        .body(axum::body::Body::from(data))
        .unwrap())
}
```

- [ ] **Step 3: 前端 — 文件上传支持**

在 MessageInput 中添加文件选择和上传逻辑。

- [ ] **Step 4: 编译检查并测试文件上传**

```bash
cargo check -p feiyu-server
curl -X POST http://localhost:3000/api/files/upload -F "file=@test.txt"
```

- [ ] **Step 5: 提交**

```bash
git add apps/server/src/ apps/desktop/src/
git commit -m "feat: add file upload and image/file message support"
```

---

## Task 3: 消息搜索

**Files:**
- Modify: `apps/server/src/services/message.rs`
- Modify: `apps/server/src/api/messages.rs`
- Modify: `apps/desktop/src/services/api.ts`

- [ ] **Step 1: 后端 — 消息搜索服务**

在 `services/message.rs` 中添加：

```rust
pub async fn search(
    pool: &PgPool,
    user_id: Uuid,
    query: &str,
    limit: i64,
) -> Result<Vec<Message>, MessageError> {
    let pattern = format!("%{}%", query);
    let messages = sqlx::query_as::<_, Message>(
        r#"
        SELECT m.* FROM messages m
        JOIN conversation_members cm ON m.conversation_id = cm.conversation_id
        WHERE cm.user_id = $1
          AND m.content::text ILIKE $2
        ORDER BY m.created_at DESC
        LIMIT $3
        "#,
    )
    .bind(user_id)
    .bind(&pattern)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(messages)
}
```

- [ ] **Step 2: 后端 — 搜索 API**

在 `api/messages.rs` 中添加：

```rust
#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
    pub user_id: Uuid,
    pub limit: Option<i64>,
}

pub async fn search_messages(
    State(state): State<MessageState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<Vec<Message>>, (StatusCode, String)> {
    let limit = query.limit.unwrap_or(20).min(50);
    message::search(&state.pool, query.user_id, &query.q, limit)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}
```

注册路由：`.route("/api/messages/search", get(messages::search_messages))`

- [ ] **Step 3: 前端 — 搜索 API**

```typescript
searchMessages: (query: string, userId: string) =>
  request<any[]>(`/api/messages/search?q=${encodeURIComponent(query)}&user_id=${userId}`),
```

- [ ] **Step 4: 前端 — 搜索 UI**

在 SearchBar 中集成消息搜索，点击搜索结果跳转到对应会话。

- [ ] **Step 5: 编译检查并提交**

```bash
cargo check -p feiyu-server
pnpm --filter @feiyu/desktop exec tsc --noEmit
git add apps/server/src/ apps/desktop/src/
git commit -m "feat: add message search with full-text search"
```

---

## Task 4: 通知提醒

**Files:**
- Modify: `apps/desktop/src/hooks/useWebSocket.ts`
- Modify: `apps/desktop/src-tauri/src/lib.rs`

- [ ] **Step 1: Tauri 通知插件**

在 `src-tauri/Cargo.toml` 添加：
```toml
tauri-plugin-notification = "2"
```

在 `lib.rs` 中注册：
```rust
.plugin(tauri_plugin_notification::init())
```

在 `capabilities/default.json` 添加权限：
```json
"notification:default"
```

- [ ] **Step 2: 前端 — 消息通知**

在 useWebSocket 的 message.deliver handler 中，如果不是当前活跃会话，发送系统通知：

```typescript
import { sendNotification } from "@tauri-apps/plugin-notification";

// In message.deliver handler:
if (message.conversation_id !== useChatStore.getState().activeConversationId) {
  sendNotification({
    title: "新消息",
    body: typeof message.content === "object" ? message.content.text : "收到新消息",
  });
}
```

- [ ] **Step 3: 编译检查并提交**

```bash
cargo check -p feiyu-desktop
pnpm --filter @feiyu/desktop exec tsc --noEmit
git add apps/desktop/
git commit -m "feat: add desktop notifications for new messages"
```

---

## Task 5: UI 打磨

**Files:**
- Modify: `apps/desktop/tailwind.config.js`
- Modify: `apps/desktop/src/styles/globals.css`
- Modify: various component files

- [ ] **Step 1: 完善飞书风格主题**

更新 tailwind.config.js 中的颜色系统，使其更接近飞书的配色方案。

- [ ] **Step 2: 添加消息时间分隔线**

在 MessageList 中，相邻消息间隔超过 5 分钟时显示时间分隔线。

- [ ] **Step 3: 消息已读状态显示**

在 MessageBubble 中添加已读/未读状态指示器。

- [ ] **Step 4: 输入框自动高度**

MessageInput 的 textarea 根据内容自动调整高度。

- [ ] **Step 5: 滚动到底部按钮**

当用户向上滚动查看历史消息时，显示"回到底部"浮动按钮。

- [ ] **Step 6: 加载状态和骨架屏**

为会话列表和消息列表添加加载状态和骨架屏效果。

- [ ] **Step 7: 提交**

```bash
git add apps/desktop/src/
git commit -m "feat: polish UI with feiyu-style refinements"
```

---

## Task 6: 最终集成与验收

- [ ] **Step 1: 全量编译**

```bash
cargo check --workspace
pnpm --filter @feiyu/desktop exec tsc --noEmit
```

- [ ] **Step 2: 端到端测试**

```bash
docker compose up -d
cargo run -p feiyu-server &
sleep 3
pnpm --filter @feiyu/desktop dev &
```

测试完整流程：
1. 注册两个用户
2. 添加联系人
3. 创建一对一聊天，发送消息
4. 创建群聊，发送群消息
5. 创建频道，发送频道消息
6. 上传文件
7. 搜索消息
8. 验证通知

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "chore: phase 5 complete - group chat, files, search, notifications, UI polish"
```
