# Phase 3: 用户体系 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现联系人管理（添加、搜索、列表）、用户在线状态、个人资料编辑，以及通讯录 UI。

**Architecture:** 后端新增联系人 API 和用户搜索/资料 API，复用 PostgreSQL contacts 表。在线状态通过 WebSocket Hub 的 PresenceUpdate 广播。前端新增通讯录页面和联系人相关 store。

**Tech Stack:** Axum, SQLx, PostgreSQL, Redis (presence), Zustand, React, TailwindCSS

---

## Task 1: 后端 — 用户 API 扩展

**Files:**
- Create: `apps/server/src/api/users.rs`
- Modify: `apps/server/src/api/mod.rs`
- Create: `apps/server/src/services/user.rs`
- Modify: `apps/server/src/services/mod.rs`

- [ ] **Step 1: 创建 apps/server/src/services/user.rs**

```rust
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::user::User;

#[derive(Debug, thiserror::Error)]
pub enum UserError {
    #[error("User not found")]
    NotFound,
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn get_by_id(pool: &PgPool, user_id: Uuid) -> Result<User, UserError> {
    sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(user_id)
        .fetch_optional(pool)
        .await?
        .ok_or(UserError::NotFound)
}

pub async fn search(pool: &PgPool, query: &str, current_user_id: Uuid) -> Result<Vec<User>, UserError> {
    let pattern = format!("%{}%", query);
    let users = sqlx::query_as::<_, User>(
        r#"
        SELECT * FROM users
        WHERE (username ILIKE $1 OR display_name ILIKE $1 OR email ILIKE $1)
          AND id != $2
        LIMIT 20
        "#,
    )
    .bind(&pattern)
    .bind(current_user_id)
    .fetch_all(pool)
    .await?;

    Ok(users)
}

pub async fn update_profile(
    pool: &PgPool,
    user_id: Uuid,
    display_name: Option<String>,
    avatar_url: Option<String>,
) -> Result<User, UserError> {
    let user = sqlx::query_as::<_, User>(
        r#"
        UPDATE users
        SET display_name = COALESCE($2, display_name),
            avatar_url = COALESCE($3, avatar_url),
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(display_name)
    .bind(avatar_url)
    .fetch_optional(pool)
    .await?
    .ok_or(UserError::NotFound)?;

    Ok(user)
}

pub async fn update_status(pool: &PgPool, user_id: Uuid, status: &str) -> Result<(), UserError> {
    sqlx::query("UPDATE users SET status = $2, updated_at = NOW() WHERE id = $1")
        .bind(user_id)
        .bind(status)
        .execute(pool)
        .await?;
    Ok(())
}
```

- [ ] **Step 2: 更新 apps/server/src/services/mod.rs**

```rust
pub mod auth;
pub mod conversation;
pub mod message;
pub mod user;
```

- [ ] **Step 3: 创建 apps/server/src/api/users.rs**

```rust
use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::user::User;
use crate::services::user;

#[derive(Clone)]
pub struct UserState {
    pub pool: PgPool,
}

#[derive(Deserialize)]
pub struct SearchQuery {
    pub q: String,
    pub user_id: Uuid,
}

#[derive(Deserialize)]
pub struct UpdateProfileRequest {
    pub user_id: Uuid,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
}

pub async fn get_user(
    State(state): State<UserState>,
    axum::extract::Path(user_id): axum::extract::Path<Uuid>,
) -> Result<Json<User>, (StatusCode, String)> {
    user::get_by_id(&state.pool, user_id)
        .await
        .map(Json)
        .map_err(|e| match e {
            user::UserError::NotFound => (StatusCode::NOT_FOUND, "User not found".to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}

pub async fn search_users(
    State(state): State<UserState>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<Vec<User>>, (StatusCode, String)> {
    user::search(&state.pool, &query.q, query.user_id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn update_profile(
    State(state): State<UserState>,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<User>, (StatusCode, String)> {
    user::update_profile(&state.pool, req.user_id, req.display_name, req.avatar_url)
        .await
        .map(Json)
        .map_err(|e| match e {
            user::UserError::NotFound => (StatusCode::NOT_FOUND, "User not found".to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}
```

- [ ] **Step 4: 更新 apps/server/src/api/mod.rs 注册用户路由**

在 router 函数中添加：
```rust
.route("/api/users/{user_id}", get(users::get_user))
.route("/api/users/search", get(users::search_users))
.route("/api/users/profile", post(users::update_profile))
```

- [ ] **Step 5: 编译检查**

```bash
cargo check -p feiyu-server
```

- [ ] **Step 6: 提交**

```bash
git add apps/server/src/
git commit -m "feat: add user search, profile, and status APIs"
```

---

## Task 2: 后端 — 联系人 API

**Files:**
- Create: `apps/server/src/api/contacts.rs`
- Create: `apps/server/src/services/contact.rs`
- Modify: `apps/server/src/services/mod.rs`
- Modify: `apps/server/src/api/mod.rs`

- [ ] **Step 1: 创建 apps/server/src/services/contact.rs**

```rust
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::user::User;

#[derive(Debug, thiserror::Error)]
pub enum ContactError {
    #[error("Contact already exists")]
    AlreadyExists,
    #[error("Cannot add yourself")]
    CannotAddSelf,
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub async fn add_contact(
    pool: &PgPool,
    user_id: Uuid,
    contact_id: Uuid,
) -> Result<(), ContactError> {
    if user_id == contact_id {
        return Err(ContactError::CannotAddSelf);
    }

    let existing = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM contacts WHERE user_id = $1 AND contact_id = $2)",
    )
    .bind(user_id)
    .bind(contact_id)
    .fetch_one(pool)
    .await?;

    if existing {
        return Err(ContactError::AlreadyExists);
    }

    sqlx::query(
        r#"
        INSERT INTO contacts (user_id, contact_id, status)
        VALUES ($1, $2, 'accepted'), ($2, $1, 'accepted')
        ON CONFLICT DO NOTHING
        "#,
    )
    .bind(user_id)
    .bind(contact_id)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn list_contacts(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<Vec<User>, ContactError> {
    let users = sqlx::query_as::<_, User>(
        r#"
        SELECT u.* FROM users u
        JOIN contacts c ON u.id = c.contact_id
        WHERE c.user_id = $1 AND c.status = 'accepted'
        ORDER BY u.display_name, u.username
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    Ok(users)
}

pub async fn remove_contact(
    pool: &PgPool,
    user_id: Uuid,
    contact_id: Uuid,
) -> Result<(), ContactError> {
    sqlx::query(
        "DELETE FROM contacts WHERE (user_id = $1 AND contact_id = $2) OR (user_id = $2 AND contact_id = $1)",
    )
    .bind(user_id)
    .bind(contact_id)
    .execute(pool)
    .await?;

    Ok(())
}
```

- [ ] **Step 2: 更新 apps/server/src/services/mod.rs**

添加 `pub mod contact;`

- [ ] **Step 3: 创建 apps/server/src/api/contacts.rs**

```rust
use axum::{extract::State, http::StatusCode, Json};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::user::User;
use crate::services::contact;

#[derive(Clone)]
pub struct ContactState {
    pub pool: PgPool,
}

#[derive(Deserialize)]
pub struct AddContactRequest {
    pub user_id: Uuid,
    pub contact_id: Uuid,
}

#[derive(Deserialize)]
pub struct UserIdQuery {
    pub user_id: Uuid,
}

pub async fn list(
    State(state): State<ContactState>,
    axum::extract::Query(query): axum::extract::Query<UserIdQuery>,
) -> Result<Json<Vec<User>>, (StatusCode, String)> {
    contact::list_contacts(&state.pool, query.user_id)
        .await
        .map(Json)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

pub async fn add(
    State(state): State<ContactState>,
    Json(req): Json<AddContactRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    contact::add_contact(&state.pool, req.user_id, req.contact_id)
        .await
        .map(|_| StatusCode::CREATED)
        .map_err(|e| match e {
            contact::ContactError::CannotAddSelf => (StatusCode::BAD_REQUEST, e.to_string()),
            contact::ContactError::AlreadyExists => (StatusCode::CONFLICT, e.to_string()),
            _ => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()),
        })
}

pub async fn remove(
    State(state): State<ContactState>,
    Json(req): Json<AddContactRequest>,
) -> Result<StatusCode, (StatusCode, String)> {
    contact::remove_contact(&state.pool, req.user_id, req.contact_id)
        .await
        .map(|_| StatusCode::OK)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}
```

- [ ] **Step 4: 更新 apps/server/src/api/mod.rs 注册联系人路由**

```rust
.route("/api/contacts", get(contacts::list))
.route("/api/contacts", post(contacts::add))
.route("/api/contacts", delete(contacts::remove))
```

- [ ] **Step 5: 编译并测试**

```bash
cargo check -p feiyu-server
cargo run -p feiyu-server &
sleep 3
# Add contact
curl -X POST http://localhost:3000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{"user_id":"<ALICE_ID>","contact_id":"<BOB_ID>"}'
# List contacts
curl "http://localhost:3000/api/contacts?user_id=<ALICE_ID>"
pkill -f feiyu-server
```

- [ ] **Step 6: 提交**

```bash
git add apps/server/src/
git commit -m "feat: add contact management APIs"
```

---

## Task 3: 前端 — 通讯录页面

**Files:**
- Create: `apps/desktop/src/stores/contactStore.ts`
- Create: `apps/desktop/src/components/contact/ContactList.tsx`
- Create: `apps/desktop/src/components/contact/ContactItem.tsx`
- Create: `apps/desktop/src/components/contact/AddContact.tsx`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/services/api.ts`

- [ ] **Step 1: 更新 api.ts 添加联系人和用户 API**

```typescript
// 在 api 对象中添加：
getContacts: (userId: string) =>
  request<any[]>(`/api/contacts?user_id=${userId}`),

addContact: (userId: string, contactId: string) =>
  request<void>("/api/contacts", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, contact_id: contactId }),
  }),

searchUsers: (query: string, userId: string) =>
  request<any[]>(`/api/users/search?q=${encodeURIComponent(query)}&user_id=${userId}`),

getUser: (userId: string) =>
  request<any>(`/api/users/${userId}`),

updateProfile: (userId: string, data: { display_name?: string; avatar_url?: string }) =>
  request<any>("/api/users/profile", {
    method: "POST",
    body: JSON.stringify({ user_id: userId, ...data }),
  }),
```

- [ ] **Step 2: 创建 contactStore.ts**

```typescript
import { create } from "zustand";
import { api } from "../services/api";

interface User {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
}

interface ContactState {
  contacts: User[];
  searchResults: User[];
  isLoading: boolean;

  loadContacts: (userId: string) => Promise<void>;
  searchUsers: (query: string, userId: string) => Promise<void>;
  addContact: (userId: string, contactId: string) => Promise<void>;
  clearSearch: () => void;
}

export const useContactStore = create<ContactState>((set) => ({
  contacts: [],
  searchResults: [],
  isLoading: false,

  loadContacts: async (userId) => {
    set({ isLoading: true });
    try {
      const contacts = await api.getContacts(userId);
      set({ contacts, isLoading: false });
    } catch (e) {
      console.error("Failed to load contacts:", e);
      set({ isLoading: false });
    }
  },

  searchUsers: async (query, userId) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    try {
      const results = await api.searchUsers(query, userId);
      set({ searchResults: results });
    } catch (e) {
      console.error("Search failed:", e);
    }
  },

  addContact: async (userId, contactId) => {
    try {
      await api.addContact(userId, contactId);
      // Reload contacts
      const contacts = await api.getContacts(userId);
      set({ contacts, searchResults: [] });
    } catch (e) {
      console.error("Add contact failed:", e);
    }
  },

  clearSearch: () => set({ searchResults: [] }),
}));
```

- [ ] **Step 3: 创建 ContactItem.tsx**

```tsx
import { Avatar } from "../common/Avatar";

interface ContactItemProps {
  name: string;
  username: string;
  online?: boolean;
  onClick?: () => void;
  action?: React.ReactNode;
}

export function ContactItem({ name, username, online, onClick, action }: ContactItemProps) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
    >
      <Avatar name={name} online={online} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-feiyu-text truncate">{name}</div>
        <div className="text-xs text-feiyu-text-muted">@{username}</div>
      </div>
      {action}
    </div>
  );
}
```

- [ ] **Step 4: 创建 AddContact.tsx**

```tsx
import { useState } from "react";
import { useContactStore } from "../../stores/contactStore";
import { useAuthStore } from "../../stores/authStore";
import { ContactItem } from "./ContactItem";

export function AddContact({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const user = useAuthStore((s) => s.user);
  const contacts = useContactStore((s) => s.contacts);
  const searchResults = useContactStore((s) => s.searchResults);
  const searchUsers = useContactStore((s) => s.searchUsers);
  const addContact = useContactStore((s) => s.addContact);

  const handleSearch = (q: string) => {
    setQuery(q);
    if (user) searchUsers(q, user.id);
  };

  const contactIds = new Set(contacts.map((c) => c.id));

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[400px] max-h-[500px] flex flex-col">
        <div className="px-4 py-3 border-b border-feiyu-border flex justify-between items-center">
          <h3 className="font-medium text-feiyu-text">添加联系人</h3>
          <button onClick={onClose} className="text-feiyu-text-muted hover:text-feiyu-text">✕</button>
        </div>
        <div className="px-4 py-2">
          <input
            type="text"
            placeholder="搜索用户名或邮箱..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full border border-feiyu-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-feiyu-primary"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {searchResults.map((u) => (
            <ContactItem
              key={u.id}
              name={u.display_name || u.username}
              username={u.username}
              action={
                contactIds.has(u.id) ? (
                  <span className="text-xs text-feiyu-text-muted">已添加</span>
                ) : (
                  <button
                    onClick={() => user && addContact(user.id, u.id)}
                    className="text-xs bg-feiyu-primary text-white px-3 py-1 rounded-md hover:bg-feiyu-primary-hover"
                  >
                    添加
                  </button>
                )
              }
            />
          ))}
          {query && searchResults.length === 0 && (
            <div className="text-center py-8 text-feiyu-text-muted text-sm">未找到用户</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 创建 ContactList.tsx**

```tsx
import { useState } from "react";
import { ContactItem } from "./ContactItem";
import { AddContact } from "./AddContact";
import { useContactStore } from "../../stores/contactStore";
import { useAuthStore } from "../../stores/authStore";
import { api } from "../../services/api";

export function ContactList() {
  const [showAdd, setShowAdd] = useState(false);
  const contacts = useContactStore((s) => s.contacts);
  const user = useAuthStore((s) => s.user);

  const handleStartChat = async (contactId: string) => {
    if (!user) return;
    try {
      const conv = await api.createDirectConversation(user.id, contactId);
      // Navigate to messages view and select this conversation
      // This will be handled by parent component
    } catch (e) {
      console.error("Failed to create conversation:", e);
    }
  };

  return (
    <div className="w-[280px] bg-white border-r border-feiyu-border flex flex-col">
      <div className="px-4 py-3 border-b border-feiyu-border flex justify-between items-center">
        <h2 className="font-medium text-feiyu-text">通讯录</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="text-feiyu-primary text-sm hover:underline"
        >
          + 添加
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-feiyu-text-muted text-sm">
            <span>暂无联系人</span>
            <button
              onClick={() => setShowAdd(true)}
              className="text-feiyu-primary text-xs mt-1 hover:underline"
            >
              添加第一个联系人
            </button>
          </div>
        ) : (
          contacts.map((c) => (
            <ContactItem
              key={c.id}
              name={c.display_name || c.username}
              username={c.username}
              online={c.status === "online"}
              onClick={() => handleStartChat(c.id)}
            />
          ))
        )}
      </div>
      {showAdd && <AddContact onClose={() => setShowAdd(false)} />}
    </div>
  );
}
```

- [ ] **Step 6: 更新 App.tsx 支持通讯录视图**

在 App 组件中：
- 导入 ContactList
- 导入 useContactStore
- 在 useEffect 中加载联系人
- 在 contacts 视图中渲染 ContactList
- 处理从通讯录发起聊天的逻辑

- [ ] **Step 7: 编译检查**

```bash
pnpm --filter @feiyu/desktop exec tsc --noEmit
```

- [ ] **Step 8: 提交**

```bash
git add apps/desktop/src/
git commit -m "feat: add contacts page with search and add contact"
```

---

## Task 4: 前端 — 在线状态集成

**Files:**
- Modify: `apps/desktop/src/hooks/useWebSocket.ts`
- Modify: `apps/desktop/src/stores/contactStore.ts`

- [ ] **Step 1: 更新 useWebSocket.ts 处理 presence.update**

```typescript
// 添加 presence 处理
const handlePresence = (payload: any) => {
  // 更新联系人在线状态
  useContactStore.setState((state) => ({
    contacts: state.contacts.map((c) =>
      c.id === payload.user_id ? { ...c, status: payload.status } : c
    ),
  }));
};

wsClient.on("presence.update", handlePresence);
// cleanup: wsClient.off("presence.update", handlePresence);
```

- [ ] **Step 2: 更新服务端 WebSocket handler 广播 presence**

在 ws/handler.rs 的 disconnect 逻辑中，将 presence 广播到联系人（需要查询联系人列表）。

- [ ] **Step 3: 编译检查**

```bash
cargo check -p feiyu-server
pnpm --filter @feiyu/desktop exec tsc --noEmit
```

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/hooks/ apps/server/src/ws/
git commit -m "feat: integrate online presence with contacts"
```

---

## Task 5: 端到端验证

- [ ] **Step 1: 启动服务**

```bash
docker compose up -d
cargo build -p feiyu-server && cargo run -p feiyu-server &
sleep 3
pnpm --filter @feiyu/desktop dev &
```

- [ ] **Step 2: 测试联系人流程**

```bash
# 注册用户
curl -s -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"username":"charlie","email":"charlie@test.com","password":"pass123","display_name":"Charlie"}'
curl -s -X POST http://localhost:3000/api/auth/register -H "Content-Type: application/json" -d '{"username":"diana","email":"diana@test.com","password":"pass123","display_name":"Diana"}'

# 搜索用户
curl "http://localhost:3000/api/users/search?q=char&user_id=<DIANA_ID>"

# 添加联系人
curl -X POST http://localhost:3000/api/contacts -H "Content-Type: application/json" -d '{"user_id":"<DIANA_ID>","contact_id":"<CHARLIE_ID>"}'

# 列出联系人
curl "http://localhost:3000/api/contacts?user_id=<DIANA_ID>"

# 更新资料
curl -X POST http://localhost:3000/api/users/profile -H "Content-Type: application/json" -d '{"user_id":"<CHARLIE_ID>","display_name":"Charlie Brown"}'
```

- [ ] **Step 3: 提交**

```bash
git add -A
git commit -m "chore: phase 3 complete - contacts, presence, profile"
```
