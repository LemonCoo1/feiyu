# 客户端消息缓存实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为飞鱼桌面端实现本地消息缓存和增量同步，参考主流 IM（微信/Telegram）方案，实现秒开聊天记录和离线浏览。

**Architecture:** 新增 `CacheService` 透明缓存层，UI 不变。Store 调用 CacheService，CacheService 管理 SQLite 读写和图片本地缓存。后端新增 `since` 参数支持增量同步。

**Tech Stack:** Tauri v2 + `tauri-plugin-sql` (SQLite) + `tauri-plugin-fs` (文件写入) + TypeScript CacheService + Rust Axum 后端

---

## 文件结构

### 新建文件
| 文件 | 职责 |
|------|------|
| `apps/desktop/src/services/cacheService.ts` | 消息缓存核心：SQLite 读写、增量同步、媒体缓存 |
| `apps/desktop/src/services/db.ts` | SQLite 连接初始化，建表 |

### 修改文件
| 文件 | 改动 |
|------|------|
| `apps/desktop/src-tauri/Cargo.toml` | 添加 `tauri-plugin-sql`、`tauri-plugin-fs` 依赖 |
| `apps/desktop/src-tauri/src/lib.rs` | 注册 SQL 和 FS 插件 |
| `apps/desktop/src-tauri/tauri.conf.json` | 配置 asset 协议允许访问 appData |
| `apps/desktop/src-tauri/capabilities/default.json` | 添加 fs 和 sql 权限 |
| `apps/desktop/package.json` | 添加 `@tauri-apps/plugin-sql`、`@tauri-apps/plugin-fs` npm 包 |
| `apps/desktop/src/stores/chatStore.ts` | `loadMessages` 改为先读缓存再增量同步；`addIncomingMessage` 写入缓存 |
| `apps/desktop/src/services/api.ts` | `getMessages` 新增 `since` 参数 |
| `apps/desktop/src/components/chat/MessageBubble.tsx` | 使用 `convertFileSrc` 加载本地缓存的图片 |
| `apps/server/src/api/messages.rs` | 新增 `since` 查询参数 |
| `apps/server/src/services/message.rs` | `get_history` 支持 `since` 时间戳过滤 |

---

## Task 1: 后端 — 新增 `since` 增量同步参数

**Files:**
- Modify: `apps/server/src/services/message.rs:12-48`
- Modify: `apps/server/src/api/messages.rs:12-16`

- [ ] **Step 1: 修改 `GetMessagesQuery` 结构体，新增 `since` 字段**

在 `apps/server/src/api/messages.rs:12-16`：

```rust
#[derive(Deserialize)]
pub struct GetMessagesQuery {
    pub before: Option<Uuid>,
    pub since: Option<String>,   // ISO 8601 时间戳，用于增量同步
    pub limit: Option<i64>,
}
```

- [ ] **Step 2: 修改 `message::get_history` 支持 `since` 参数**

在 `apps/server/src/services/message.rs:12-48`，将函数签名改为：

```rust
pub async fn get_history(
    pool: &PgPool,
    conversation_id: Uuid,
    before: Option<Uuid>,
    since: Option<String>,
    limit: i64,
) -> Result<Vec<Message>, MessageError> {
    let messages = if let Some(since_ts) = since {
        // 增量同步：返回 since 之后的所有新消息（升序）
        sqlx::query_as::<_, Message>(
            r#"
            SELECT * FROM messages
            WHERE conversation_id = $1 AND created_at > $2::timestamptz
            ORDER BY created_at ASC
            LIMIT $3
            "#,
        )
        .bind(conversation_id)
        .bind(&since_ts)
        .bind(limit)
        .fetch_all(pool)
        .await?
    } else if let Some(before_id) = before {
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

- [ ] **Step 3: 修改 API handler，传递 `since` 参数**

在 `apps/server/src/api/messages.rs:18-30`：

```rust
pub async fn get_history(
    State(state): State<crate::api::AppState>,
    headers: HeaderMap,
    axum::extract::Path(conversation_id): axum::extract::Path<Uuid>,
    Query(query): Query<GetMessagesQuery>,
) -> Result<Json<Vec<Message>>, (StatusCode, String)> {
    let _user_id = extract_user_id(&headers, &state.config.jwt_secret)?;
    let limit = query.limit.unwrap_or(50).min(100);
    message::get_history(&state.pool, conversation_id, query.before, query.since, limit)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}
```

- [ ] **Step 4: 验证编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu && cargo check -p feiyu-server
```

Expected: 编译成功，无错误

- [ ] **Step 5: 提交**

```bash
git add apps/server/src/api/messages.rs apps/server/src/services/message.rs
git commit -m "feat: 消息查询 API 新增 since 参数支持增量同步"
```

---

## Task 2: Tauri 插件引入 — 添加 SQLite 和 FS 支持

**Files:**
- Modify: `apps/desktop/src-tauri/Cargo.toml`
- Modify: `apps/desktop/src-tauri/src/lib.rs`
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: 添加 Rust 依赖**

在 `apps/desktop/src-tauri/Cargo.toml` 的 `[dependencies]` 中添加：

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-shell = "2"
tauri-plugin-notification = "2"
tauri-plugin-sql = { version = "2", features = ["sqlite"] }
tauri-plugin-fs = "2"
serde.workspace = true
serde_json.workspace = true
```

- [ ] **Step 2: 注册 SQL 和 FS 插件**

在 `apps/desktop/src-tauri/src/lib.rs` 中，修改 `tauri::Builder::default()` 链：

```rust
use tauri::{Manager, RunEvent};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_sqlite("feiyu.db")
                .build(),
        )
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                let window = app.get_webview_window("main").unwrap();
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        #[cfg(target_os = "macos")]
        if let RunEvent::Reopen { .. } = event {
            if let Some(window) = app_handle.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
    });
}
```

- [ ] **Step 3: 配置 asset 协议（允许访问 appData 目录）**

在 `apps/desktop/src-tauri/tauri.conf.json` 的 `app` 中添加 `assetProtocol`：

```json
{
  "app": {
    "windows": [
      {
        "title": "飞鱼",
        "width": 1200,
        "height": 800,
        "resizable": true,
        "fullscreen": false
      }
    ],
    "security": {
      "csp": null,
      "assetProtocol": {
        "enable": true,
        "scope": ["$APPDATA/**"]
      }
    }
  }
}
```

- [ ] **Step 4: 添加 capabilities 权限**

在 `apps/desktop/src-tauri/capabilities/default.json` 中添加权限：

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "default",
  "description": "Capability for the main window",
  "windows": ["main"],
  "permissions": [
    "core:default",
    "shell:allow-open",
    "notification:default",
    "sql:default",
    "fs:default",
    "fs:allow-exists",
    "fs:allow-mkdir",
    "fs:allow-write-file",
    "fs:allow-read-file",
    "fs:allow-appdata-read-recursive"
  ]
}
```

- [ ] **Step 5: 添加前端 npm 依赖**

```bash
cd /Users/xucong/Documents/projects/feiyu/apps/desktop && pnpm add @tauri-apps/plugin-sql @tauri-apps/plugin-fs
```

- [ ] **Step 6: 验证 Tauri 编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu && cargo check -p feiyu-desktop
```

- [ ] **Step 7: 提交**

```bash
git add apps/desktop/src-tauri/Cargo.toml apps/desktop/src-tauri/src/lib.rs apps/desktop/src-tauri/tauri.conf.json apps/desktop/src-tauri/capabilities/default.json apps/desktop/package.json apps/desktop/pnpm-lock.yaml
git commit -m "feat: 引入 tauri-plugin-sql 和 tauri-plugin-fs"
```

---

## Task 3: 数据库初始化 — 建表与连接管理

**Files:**
- Create: `apps/desktop/src/services/db.ts`

- [ ] **Step 1: 创建 `db.ts` — SQLite 连接与建表**

```typescript
import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (db) return db;

  db = await Database.load("sqlite:feiyu.db");

  // 消息本地缓存表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS cached_messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT,
      content_type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_cached_messages_conv_time
      ON cached_messages(conversation_id, created_at)
  `);

  // 同步状态表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sync_state (
      conversation_id TEXT PRIMARY KEY,
      last_sync_at TEXT NOT NULL,
      last_message_id TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 媒体缓存索引表
  await db.execute(`
    CREATE TABLE IF NOT EXISTS media_cache (
      url TEXT PRIMARY KEY,
      local_path TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return db;
}
```

- [ ] **Step 2: 验证前端编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu/apps/desktop && pnpm build
```

Expected: 编译成功（类型检查通过）

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/services/db.ts
git commit -m "feat: 添加 SQLite 数据库初始化与建表"
```

---

## Task 4: CacheService — 消息缓存核心逻辑

**Files:**
- Create: `apps/desktop/src/services/cacheService.ts`
- Modify: `apps/desktop/src/services/api.ts:101-105`

- [ ] **Step 1: 更新 `api.ts` — `getMessages` 支持 `since` 参数**

在 `apps/desktop/src/services/api.ts:101-105`，修改为：

```typescript
getMessages: (conversationId: string, limit = 50, before?: string, since?: string) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) params.set("before", before);
    if (since) params.set("since", since);
    return request<any[]>(`/api/conversations/${conversationId}/messages?${params}`);
  },
```

- [ ] **Step 2: 创建 `cacheService.ts`**

```typescript
import { getDb } from "./db";
import { api } from "./api";

interface CachedMessage {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content_type: string;
  content: string; // JSON string
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content_type: string;
  content: any;
  created_at: string;
}

// === 消息缓存 ===

/**
 * 从 SQLite 读取本地缓存的消息
 */
export async function getLocalMessages(
  conversationId: string,
  limit = 50
): Promise<Message[]> {
  const db = await getDb();
  const rows = await db.select<CachedMessage[]>(
    `SELECT * FROM cached_messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [conversationId, limit]
  );

  return rows.map(rowToMessage).reverse(); // 反转为时间升序
}

/**
 * 获取该会话的最后同步时间
 */
export async function getLastSyncAt(conversationId: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ last_sync_at: string }[]>(
    `SELECT last_sync_at FROM sync_state WHERE conversation_id = $1`,
    [conversationId]
  );
  return rows.length > 0 ? rows[0].last_sync_at : null;
}

/**
 * 增量同步：请求服务端 since 之后的新消息，写入本地
 */
export async function syncNewMessages(conversationId: string): Promise<Message[]> {
  const lastSync = await getLastSyncAt(conversationId);

  // 请求增量数据
  const newMsgs = await api.getMessages(conversationId, 100, undefined, lastSync || undefined);

  if (newMsgs.length === 0) {
    return [];
  }

  // 写入 SQLite
  const db = await getDb();
  for (const msg of newMsgs) {
    await db.execute(
      `INSERT OR REPLACE INTO cached_messages (id, conversation_id, sender_id, content_type, content, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        msg.id,
        msg.conversation_id,
        msg.sender_id,
        msg.content_type,
        JSON.stringify(msg.content),
        msg.created_at,
      ]
    );
  }

  // 更新同步状态
  const lastMsg = newMsgs[newMsgs.length - 1];
  await db.execute(
    `INSERT INTO sync_state (conversation_id, last_sync_at, last_message_id, synced_at)
     VALUES ($1, $2, $3, datetime('now'))
     ON CONFLICT(conversation_id) DO UPDATE SET
       last_sync_at = $2,
       last_message_id = $3,
       synced_at = datetime('now')`,
    [conversationId, lastMsg.created_at, lastMsg.id]
  );

  return newMsgs.map(m => ({
    ...m,
    content: typeof m.content === "string" ? JSON.parse(m.content) : m.content,
  }));
}

/**
 * 将单条消息写入缓存（WebSocket 收到新消息时调用）
 */
export async function cacheMessage(msg: Message): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT OR REPLACE INTO cached_messages (id, conversation_id, sender_id, content_type, content, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      msg.id,
      msg.conversation_id,
      msg.sender_id,
      msg.content_type,
      JSON.stringify(msg.content),
      msg.created_at,
    ]
  );

  // 同步更新 sync_state
  await db.execute(
    `INSERT INTO sync_state (conversation_id, last_sync_at, last_message_id, synced_at)
     VALUES ($1, $2, $3, datetime('now'))
     ON CONFLICT(conversation_id) DO UPDATE SET
       last_sync_at = CASE WHEN $2 > last_sync_at THEN $2 ELSE last_sync_at END,
       last_message_id = CASE WHEN $2 > last_sync_at THEN $3 ELSE last_message_id END,
       synced_at = datetime('now')`,
    [msg.conversation_id, msg.created_at, msg.id]
  );
}

/**
 * 向上翻页加载更多历史消息（从本地缓存）
 */
export async function getLocalMessagesBefore(
  conversationId: string,
  beforeTimestamp: string,
  limit = 30
): Promise<Message[]> {
  const db = await getDb();
  const rows = await db.select<CachedMessage[]>(
    `SELECT * FROM cached_messages
     WHERE conversation_id = $1 AND created_at < $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [conversationId, beforeTimestamp, limit]
  );

  return rows.map(rowToMessage).reverse();
}

/**
 * 从服务端拉取更早的历史消息并缓存
 */
export async function fetchAndCacheOlderMessages(
  conversationId: string,
  beforeMessageId: string,
  limit = 30
): Promise<Message[]> {
  const msgs = await api.getMessages(conversationId, limit, beforeMessageId);

  if (msgs.length === 0) return [];

  const db = await getDb();
  for (const msg of msgs) {
    await db.execute(
      `INSERT OR IGNORE INTO cached_messages (id, conversation_id, sender_id, content_type, content, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        msg.id,
        msg.conversation_id,
        msg.sender_id,
        msg.content_type,
        JSON.stringify(msg.content),
        msg.created_at,
      ]
    );
  }

  return msgs;
}

/**
 * 获取缓存统计信息（用于设置页展示）
 */
export async function getCacheStats(): Promise<{ messageCount: number; totalSize: number }> {
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM cached_messages`
  );
  return { messageCount: rows[0]?.count || 0, totalSize: 0 };
}

/**
 * 清除指定会话的缓存
 */
export async function clearConversationCache(conversationId: string): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM cached_messages WHERE conversation_id = $1`, [conversationId]);
  await db.execute(`DELETE FROM sync_state WHERE conversation_id = $1`, [conversationId]);
}

/**
 * 清除所有缓存
 */
export async function clearAllCache(): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM cached_messages`);
  await db.execute(`DELETE FROM sync_state`);
  await db.execute(`DELETE FROM media_cache`);
}

// === 媒体文件缓存 ===

import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, writeBinaryFile } from "@tauri-apps/plugin-fs";

async function getMediaDir(): Promise<string> {
  const appData = await appDataDir();
  return await join(appData, "media");
}

function urlToFilename(url: string): string {
  const ext = url.split(".").pop()?.split("?")[0] || "bin";
  // 简单 hash：将 URL 转为 Base36
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  }
  return `${Math.abs(hash).toString(36)}.${ext}`;
}

/**
 * 获取本地缓存的媒体 URL，未缓存则下载。
 * 返回值可直接用于 <img src>。
 */
export async function getCachedMediaUrl(url: string): Promise<string> {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return url;

  // 1. 查缓存表
  const db = await getDb();
  const rows = await db.select<{ local_path: string }[]>(
    `SELECT local_path FROM media_cache WHERE url = $1`,
    [url]
  );
  if (rows.length > 0) {
    return convertFileSrc(rows[0].local_path);
  }

  // 2. 下载并缓存到磁盘
  try {
    const mediaDir = await getMediaDir();
    const filename = urlToFilename(url);
    const localPath = await join(mediaDir, filename);

    // 确保目录存在
    const dirExists = await exists(mediaDir);
    if (!dirExists) {
      await mkdir(mediaDir, { recursive: true });
    }

    // 检查文件是否已存在
    const fileExists = await exists(localPath);
    if (!fileExists) {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      await writeBinaryFile(localPath, new Uint8Array(buffer));

      // 写入缓存索引
      await db.execute(
        `INSERT OR REPLACE INTO media_cache (url, local_path, size, cached_at)
         VALUES ($1, $2, $3, datetime('now'))`,
        [url, localPath, buffer.byteLength]
      );
    } else {
      await db.execute(
        `INSERT OR IGNORE INTO media_cache (url, local_path, size, cached_at)
         VALUES ($1, $2, 0, datetime('now'))`,
        [url, localPath]
      );
    }

    return convertFileSrc(localPath);
  } catch (e) {
    console.error("Failed to cache media:", e);
    return url; // 降级：返回原始 URL
  }
}

/**
 * 清理旧的媒体缓存（LRU，超过 maxBytes 时删除最旧的）
 */
export async function cleanupMediaCache(maxBytes = 500 * 1024 * 1024): Promise<void> {
  const db = await getDb();
  const rows = await db.select<{ total: number }[]>(
    `SELECT COALESCE(SUM(size), 0) as total FROM media_cache`
  );
  const total = rows[0]?.total || 0;
  if (total <= maxBytes) return;

  await db.execute(
    `DELETE FROM media_cache WHERE url IN (
      SELECT url FROM media_cache ORDER BY cached_at ASC
      LIMIT (SELECT COUNT(*) FROM media_cache WHERE (SELECT SUM(size) FROM media_cache) > $1)
    )`,
    [maxBytes]
  );
}

// --- 内部工具函数 ---

function rowToMessage(row: CachedMessage): Message {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id || "",
    content_type: row.content_type,
    content: JSON.parse(row.content),
    created_at: row.created_at,
  };
}
```

- [ ] **Step 3: 验证前端编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu/apps/desktop && pnpm build
```

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/services/cacheService.ts apps/desktop/src/services/api.ts
git commit -m "feat: 实现 CacheService 消息缓存核心逻辑"
```

---

## Task 5: chatStore 改造 — 接入缓存层

**Files:**
- Modify: `apps/desktop/src/stores/chatStore.ts`

- [ ] **Step 1: 在文件顶部添加 import**

在 `chatStore.ts` 顶部添加：

```typescript
import * as cacheService from "../services/cacheService";
```

- [ ] **Step 2: 修改 `loadMessages` 方法**

将 `chatStore.ts:109-127` 的 `loadMessages` 替换为：

```typescript
  loadMessages: async (conversationId) => {
    set({ isLoadingMsgs: true });
    try {
      // 1. 先从本地缓存读取，立即展示
      const localMsgs = await cacheService.getLocalMessages(conversationId);
      if (localMsgs.length > 0) {
        set((state) => {
          const newMessages = new Map(state.messages);
          newMessages.set(conversationId, localMsgs);
          return { messages: newMessages, isLoadingMsgs: false };
        });
      }

      // 2. 增量同步：拉取 since 之后的新消息
      const newMsgs = await cacheService.syncNewMessages(conversationId);

      // 3. 合并更新
      if (newMsgs.length > 0) {
        set((state) => {
          const newMessages = new Map(state.messages);
          const existing = newMessages.get(conversationId) || localMsgs;
          const existingIds = new Set(existing.map((m) => m.id));
          const merged = [...existing, ...newMsgs.filter((m) => !existingIds.has(m.id))];
          merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          newMessages.set(conversationId, merged);
          return { messages: newMessages, isLoadingMsgs: false };
        });
      } else if (localMsgs.length === 0) {
        // 本地无数据且增量无新数据 → 全量拉取
        const msgs = await api.getMessages(conversationId);
        const reversed = msgs.reverse();
        for (const msg of reversed) {
          await cacheService.cacheMessage(msg);
        }
        set((state) => {
          const newMessages = new Map(state.messages);
          newMessages.set(conversationId, reversed);
          return { messages: newMessages, isLoadingMsgs: false };
        });
      }

      // 标记已读
      const state = get();
      const msgs = state.messages.get(conversationId) || [];
      if (msgs.length > 0) {
        wsClient.sendRead(conversationId, msgs[msgs.length - 1].id);
      }
    } catch (e) {
      console.error("Failed to load messages:", e);
      set({ isLoadingMsgs: false });
    }
  },
```

- [ ] **Step 3: 修改 `addIncomingMessage` 方法，写入缓存**

在 `chatStore.ts` 的 `addIncomingMessage` 方法开头添加缓存写入：

```typescript
  addIncomingMessage: (message) => {
    // 写入本地缓存
    cacheService.cacheMessage(message).catch((e) =>
      console.error("Failed to cache incoming message:", e)
    );

    console.log("[chatStore] addIncomingMessage", { id: message.id, content_type: message.content_type, content: message.content, conversation_id: message.conversation_id });
    set((state) => {
      const newMessages = new Map(state.messages);
      const convMsgs = newMessages.get(message.conversation_id) || [];
      newMessages.set(message.conversation_id, [...convMsgs, message]);

      const isActive = state.activeConversationId === message.conversation_id;
      const convs = state.conversations.map((c) => {
        if (c.id !== message.conversation_id) return c;
        return {
          ...c,
          last_message_content: message.content,
          last_message_content_type: message.content_type,
          last_message_at: message.created_at,
          unread_count: isActive ? 0 : (c.unread_count || 0) + 1,
        };
      });

      return { messages: newMessages, conversations: convs };
    });

    const state = get();
    if (state.activeConversationId === message.conversation_id) {
      const readReceipt = useSettingsStore.getState().settings.privacy_read_receipt;
      if (readReceipt) {
        wsClient.sendRead(message.conversation_id, message.id);
      }
    }
  },
```

- [ ] **Step 4: 验证前端编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu/apps/desktop && pnpm build
```

- [ ] **Step 5: 提交**

```bash
git add apps/desktop/src/stores/chatStore.ts
git commit -m "feat: chatStore 接入缓存层，支持本地优先+增量同步"
```

---

## Task 6: 图片本地缓存 — 使用 convertFileSrc

**Files:**
- Modify: `apps/desktop/src/components/chat/MessageBubble.tsx`

- [ ] **Step 1: 添加 `useCachedUrl` hook**

在 `MessageBubble.tsx` 顶部添加 import：

```typescript
import { useState, useEffect } from "react";
import { getCachedMediaUrl } from "../../services/cacheService";
```

在组件外部定义 hook：

```typescript
function useCachedUrl(url: string | undefined): string | undefined {
  const [cached, setCached] = useState(url);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    getCachedMediaUrl(url).then((localUrl) => {
      if (!cancelled) setCached(localUrl);
    });
    return () => { cancelled = true; };
  }, [url]);
  return cached;
}
```

- [ ] **Step 2: 在 MessageBubble 组件中使用缓存 URL**

在 `MessageBubble` 函数内部开头添加：

```typescript
  const cachedStickerUrl = useCachedUrl(rawContent?.url);
  const cachedImageUrl = useCachedUrl(rawContent?.url);
```

将 sticker/gif 分支（约第 39 行）的 `src={rawContent?.url}` 改为 `src={cachedStickerUrl}`。

将 image 分支（约第 75 行）的 `src={rawContent.url}` 改为 `src={cachedImageUrl}`。

- [ ] **Step 3: 验证前端编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu/apps/desktop && pnpm build
```

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/components/chat/MessageBubble.tsx
git commit -m "feat: 图片本地文件缓存，使用 convertFileSrc 加载"
```

---

## Task 7: 缓存管理设置页

**Files:**
- Modify: `apps/desktop/src/stores/settingsStore.ts`
- Modify: 对应的设置页面组件

- [ ] **Step 1: 在 `settingsStore.ts` 中添加缓存管理方法**

在 settingsStore 中添加 import 和 action：

```typescript
import * as cacheService from "../services/cacheService";

// 在 store 的 state 中添加：
cacheStats: { messageCount: 0, totalSize: 0 },

// 在 actions 中添加：
loadCacheStats: async () => {
  const stats = await cacheService.getCacheStats();
  set({ cacheStats: stats });
},

clearAllCache: async () => {
  await cacheService.clearAllCache();
  set({ cacheStats: { messageCount: 0, totalSize: 0 } });
},
```

- [ ] **Step 2: 在设置页面中添加缓存管理 UI**

在设置页面中添加一个"存储管理"section：
- 展示缓存的消息数量
- "清除缓存"按钮

- [ ] **Step 3: 验证并提交**

```bash
cd /Users/xucong/Documents/projects/feiyu/apps/desktop && pnpm build
git add apps/desktop/src/stores/settingsStore.ts
git commit -m "feat: 设置页添加缓存管理功能"
```

---

## Task 8: 端到端验证

- [ ] **Step 1: 启动服务端和桌面端**

```bash
# 终端 1：启动基础设施
cd /Users/xucong/Documents/projects/feiyu && docker compose up -d

# 终端 2：启动服务端
cd /Users/xucong/Documents/projects/feiyu && cargo run -p feiyu-server

# 终端 3：启动桌面端
cd /Users/xucong/Documents/projects/feiyu/apps/desktop && pnpm tauri dev
```

- [ ] **Step 2: 验证核心流程**

1. 登录后打开一个有消息的会话 → 验证消息正常展示
2. 关闭 App 重新打开 → 验证消息秒开（从本地缓存加载）
3. 在另一个会话发送新消息 → 验证实时消息正常接收并缓存
4. 断网后重新打开 → 验证已缓存的消息可离线浏览
5. 检查 SQLite 数据库文件：`~/Library/Application Support/com.feiyu.desktop/feiyu.db`
6. 检查图片缓存目录：`~/Library/Application Support/com.feiyu.desktop/media/`

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: 客户端消息缓存系统完成 — SQLite 本地存储 + 增量同步 + 图片缓存"
```
