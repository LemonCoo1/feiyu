# 断线重连与存储管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现断网离线体验和完善的存储管理，使飞鱼桌面端在服务器不可达时仍能展示本地数据，并提供分类缓存管理。

**Architecture:** 在现有 WsClient + cacheService 基础上增量增强。WsClient 增加指数退避重连、心跳检测、状态事件、发送队列；cacheService 扩展会话/联系人/频道缓存表和分类清理；新增 ConnectionBanner UI 组件；改造三个 Store 实现本地优先加载。

**Tech Stack:** TypeScript, React 18, Zustand, Tauri v2, SQLite (tauri-plugin-sql), i18next

---

## 文件结构

| 文件 | 操作 | 职责 |
|---|---|---|
| `apps/desktop/src/services/ws.ts` | 修改 | WsClient 增强：指数退避、心跳、状态事件、发送队列 |
| `apps/desktop/src/components/common/ConnectionBanner.tsx` | 新建 | 连接状态顶部横幅组件 |
| `apps/desktop/src/App.tsx` | 修改 | 集成 ConnectionBanner + 连接状态监听 |
| `apps/desktop/src/services/db.ts` | 修改 | 新增 3 张缓存表建表迁移 |
| `apps/desktop/src/services/cacheService.ts` | 修改 | 新增会话/联系人/频道缓存函数、详细统计、分类清理、自动清理 |
| `apps/desktop/src/stores/chatStore.ts` | 修改 | loadConversations 本地优先 + 增量同步 |
| `apps/desktop/src/stores/contactStore.ts` | 修改 | loadContacts 本地优先 + 增量同步 |
| `apps/desktop/src/stores/channelStore.ts` | 修改 | loadChannels 本地优先 + 增量同步 |
| `apps/desktop/src/stores/settingsStore.ts` | 修改 | 扩展 cacheStats 类型，新增分类清理 action |
| `apps/desktop/src/components/settings/SettingsView.tsx` | 修改 | 存储管理 UI 改为分组展示 |
| `apps/desktop/src/hooks/useWebSocket.ts` | 修改 | 输入框禁用状态与连接状态联动 |
| `apps/desktop/src/locales/zh.json` | 修改 | 新增连接状态和存储管理相关中文翻译 |
| `apps/desktop/src/locales/en.json` | 修改 | 新增连接状态和存储管理相关英文翻译 |

---

### Task 1: WsClient 增强 — 指数退避、心跳、状态事件、发送队列

**Files:**
- Modify: `apps/desktop/src/services/ws.ts`

- [ ] **Step 1: 重写 WsClient**

将 `ws.ts` 整体重写为增强版 WsClient，保留所有既有公开接口（`connect`, `disconnect`, `send`, `on`, `off`, `sendMessage`, `sendRead`），新增：

```ts
// apps/desktop/src/services/ws.ts

type MessageHandler = (data: any) => void;
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

class WsClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private token: string | null = null;

  // 新增：连接状态管理
  private _status: ConnectionStatus = 'disconnected';
  private statusHandlers: ((status: ConnectionStatus) => void)[] = [];

  // 新增：指数退避重连
  private reconnectAttempt = 0;
  private reconnectTimer: number | null = null;
  private readonly MAX_RECONNECT_DELAY = 30000;

  // 新增：心跳检测
  private pingInterval: number | null = null;
  private pongTimeout: number | null = null;
  private readonly PING_INTERVAL = 30000;
  private readonly PONG_TIMEOUT = 10000;

  // 新增：发送队列
  private sendQueue: any[] = [];
  private readonly MAX_QUEUE_SIZE = 100;

  // 新增：连接状态
  private _isConnected = false;

  // 计算重连延迟：1s, 2s, 4s, 8s, 16s, 30s
  private getReconnectDelay(): number {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), this.MAX_RECONNECT_DELAY);
    return delay;
  }

  // 设置连接状态并通知所有监听者
  private setStatus(status: ConnectionStatus) {
    if (this._status === status) return;
    this._status = status;
    this._isConnected = status === 'connected';
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }

  // 新增：监听连接状态
  onStatusChange(handler: (status: ConnectionStatus) => void) {
    this.statusHandlers.push(handler);
  }

  // 新增：取消监听连接状态
  offStatusChange(handler: (status: ConnectionStatus) => void) {
    this.statusHandlers = this.statusHandlers.filter(h => h !== handler);
  }

  // 新增：获取连接状态
  getStatus(): ConnectionStatus {
    return this._status;
  }

  // 新增：获取连接状态（兼容旧代码中检查 ws?.readyState 的场景）
  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(token: string) {
    this.token = token;
    this.doConnect();
  }

  private doConnect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.setStatus('connecting');

    const httpBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
    const wsBase = httpBase.replace(/^http/, "ws");
    this.ws = new WebSocket(`${wsBase}/api/ws`);

    this.ws.onopen = () => {
      this.send({ type: "auth.token", payload: { token: this.token } });
      this.setStatus('connected');
      this.reconnectAttempt = 0;

      // flush 发送队列
      while (this.sendQueue.length > 0) {
        const msg = this.sendQueue.shift();
        this.ws?.send(JSON.stringify(msg));
      }

      // 启动心跳
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // 处理 pong 响应
        if (data.type === 'pong') {
          this.handlePong();
          return;
        }

        const type = data.type;
        const handlers = this.handlers.get(type) || [];
        handlers.forEach((h) => h(data.payload));
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    this.ws.onclose = () => {
      this.stopPing();
      this.setStatus('disconnected');

      if (this.token) {
        const delay = this.getReconnectDelay();
        this.reconnectTimer = window.setTimeout(() => {
          this.reconnectAttempt++;
          this.doConnect();
        }, delay);
      }
    };

    this.ws.onerror = (e) => {
      console.error("WS error:", e);
    };
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = window.setInterval(() => {
      this.ws?.send(JSON.stringify({ type: 'ping' }));
      // 设置 pong 超时
      this.pongTimeout = window.setTimeout(() => {
        // pong 超时，主动断开触发重连
        console.warn('WS pong timeout, closing connection');
        this.ws?.close();
      }, this.PONG_TIMEOUT);
    }, this.PING_INTERVAL);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private handlePong() {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  disconnect() {
    this.token = null;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.sendQueue = [];
    this.ws?.close();
    this.ws = null;
    this.setStatus('disconnected');
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      // 断连时入队
      if (this.sendQueue.length < this.MAX_QUEUE_SIZE) {
        this.sendQueue.push(data);
      }
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

  sendRead(conversationId: string, messageId: string) {
    this.send({
      type: "message.read",
      payload: {
        conversation_id: conversationId,
        message_id: messageId,
      },
    });
  }
}

export const wsClient = new WsClient();
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu && pnpm build 2>&1 | tail -20
```

预期：无 TypeScript 编译错误。

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/services/ws.ts
git commit -m "feat: WsClient 增强 — 指数退避重连、心跳检测、状态事件、发送队列"
```

---

### Task 2: ConnectionBanner 组件 + App.tsx 集成

**Files:**
- Create: `apps/desktop/src/components/common/ConnectionBanner.tsx`
- Modify: `apps/desktop/src/App.tsx`
- Modify: `apps/desktop/src/locales/zh.json`
- Modify: `apps/desktop/src/locales/en.json`

- [ ] **Step 1: 添加 i18n 翻译键**

在 `apps/desktop/src/locales/zh.json` 中添加：

```json
"connection.disconnected": "连接已断开，正在重连...",
"connection.connecting": "正在连接服务器...",
"connection.connected": "已重新连接",
"connection.waiting": "等待连接..."
```

在 `apps/desktop/src/locales/en.json` 中添加：

```json
"connection.disconnected": "Connection lost, reconnecting...",
"connection.connecting": "Connecting to server...",
"connection.connected": "Reconnected",
"connection.waiting": "Waiting for connection..."
```

- [ ] **Step 2: 创建 ConnectionBanner 组件**

```tsx
// apps/desktop/src/components/common/ConnectionBanner.tsx

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { ConnectionStatus } from "../../services/ws";

interface Props {
  status: ConnectionStatus;
}

export function ConnectionBanner({ status }: Props) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (status === "disconnected" || status === "connecting") {
      setVisible(true);
      setShowReconnected(false);
    } else if (status === "connected") {
      if (visible) {
        // 从断开恢复 → 显示"已重新连接" 2 秒后消失
        setShowReconnected(true);
        const timer = setTimeout(() => {
          setVisible(false);
          setShowReconnected(false);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [status]);

  if (!visible) return null;

  const bgClass = showReconnected
    ? "bg-green-500"
    : status === "connecting"
    ? "bg-orange-500"
    : "bg-red-500";

  const text = showReconnected
    ? t("connection.connected")
    : status === "connecting"
    ? t("connection.connecting")
    : t("connection.disconnected");

  return (
    <div
      className={`${bgClass} text-white text-xs text-center py-1.5 z-50 transition-all`}
      style={{ height: 32 }}
    >
      {text}
    </div>
  );
}
```

- [ ] **Step 3: 集成到 App.tsx**

修改 `apps/desktop/src/App.tsx`，在 `App` 组件中：

1. 添加 `import { ConnectionBanner } from "./components/common/ConnectionBanner";`
2. 添加 `import type { ConnectionStatus } from "./services/ws";`
3. 添加状态和 effect：

```tsx
const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connected");

useEffect(() => {
  wsClient.onStatusChange(setConnectionStatus);
  return () => wsClient.offStatusChange(setConnectionStatus);
}, []);
```

4. 修改 JSX 布局：

```tsx
return (
  <div className="flex h-screen w-screen flex-col">
    <ConnectionBanner status={connectionStatus} />
    <div className="flex flex-1 overflow-hidden">
      <NavSidebar activeView={activeView} onViewChange={setActiveView} />
      {activeView === "messages" && (
        <>
          <ConversationList />
          <ChatWindow />
        </>
      )}
      {activeView === "contacts" && <ContactList />}
      {activeView === "channels" && (
        <>
          <ChannelList />
          <ChannelView />
        </>
      )}
      {activeView === "settings" && <SettingsView />}
      <DebugPanel />
    </div>
  </div>
);
```

- [ ] **Step 4: 验证编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu && pnpm build 2>&1 | tail -20
```

- [ ] **Step 5: 提交**

```bash
git add apps/desktop/src/components/common/ConnectionBanner.tsx apps/desktop/src/App.tsx apps/desktop/src/locales/zh.json apps/desktop/src/locales/en.json
git commit -m "feat: 新增 ConnectionBanner 顶部横幅，集成连接状态监听"
```

---

### Task 3: 发送限制 — 断连时禁用输入框

**Files:**
- Modify: `apps/desktop/src/hooks/useWebSocket.ts`
- Modify: `apps/desktop/src/components/chat/MessageInput.tsx`（或等效的输入框组件）

- [ ] **Step 1: 查找输入框组件**

```bash
find /Users/xucong/Documents/projects/feiyu/apps/desktop/src -name "MessageInput*" -o -name "ChatInput*" | head -5
```

确认输入框组件的文件路径和 props 接口。

- [ ] **Step 2: 在 useWebSocket.ts 中导出连接状态 hook**

在 `apps/desktop/src/hooks/useWebSocket.ts` 中添加一个新的 hook，或者修改现有 hook 导出连接状态：

```ts
// 在文件末尾添加
export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connected');

  useEffect(() => {
    wsClient.onStatusChange(setStatus);
    return () => wsClient.offStatusChange(setStatus);
  }, []);

  return status;
}
```

需要在文件顶部添加 `import { useState } from "react";` 和 `import type { ConnectionStatus } from "../services/ws";`。

- [ ] **Step 3: 修改输入框组件**

在输入框组件中：

1. 导入 `useConnectionStatus` 和 `useTranslation`
2. 获取连接状态：`const connectionStatus = useConnectionStatus();`
3. 当 `connectionStatus !== 'connected'` 时：
   - 输入框 `disabled`
   - placeholder 显示 `t("connection.waiting")`
   - 发送按钮 `disabled`

```tsx
// 示例修改（实际修改需根据组件结构调整）
const connectionStatus = useConnectionStatus();
const { t } = useTranslation();
const isDisconnected = connectionStatus !== 'connected';

<input
  disabled={isDisconnected}
  placeholder={isDisconnected ? t("connection.waiting") : /* 原有 placeholder */}
  ...
/>

<button
  disabled={isDisconnected || /* 其他条件 */}
  ...
>
```

- [ ] **Step 4: 验证编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu && pnpm build 2>&1 | tail -20
```

- [ ] **Step 5: 提交**

```bash
git add apps/desktop/src/hooks/useWebSocket.ts <输入框组件路径>
git commit -m "feat: 断连时禁用消息输入框，显示等待连接提示"
```

---

### Task 4: 数据库迁移 — 新增 3 张缓存表

**Files:**
- Modify: `apps/desktop/src/services/db.ts`

- [ ] **Step 1: 在 db.ts 的 getDb() 中追加建表语句**

在 `apps/desktop/src/services/db.ts` 的 `getDb()` 函数中，在 `return db;` 之前追加：

```ts
// 会话列表缓存表
await db.execute(`
  CREATE TABLE IF NOT EXISTS cached_conversations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT,
    owner_id TEXT,
    created_at TEXT,
    last_message_content TEXT,
    last_message_content_type TEXT,
    last_message_at TEXT,
    other_user_id TEXT,
    other_username TEXT,
    other_display_name TEXT,
    other_avatar_url TEXT,
    unread_count INTEGER DEFAULT 0,
    updated_at TEXT
  )
`);

// 联系人缓存表
await db.execute(`
  CREATE TABLE IF NOT EXISTS cached_contacts (
    id TEXT PRIMARY KEY,
    username TEXT,
    display_name TEXT,
    avatar_url TEXT,
    status TEXT DEFAULT 'offline',
    updated_at TEXT
  )
`);

// 频道缓存表
await db.execute(`
  CREATE TABLE IF NOT EXISTS cached_channels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    owner_id TEXT,
    created_at TEXT,
    updated_at TEXT
  )
`);
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu && pnpm build 2>&1 | tail -20
```

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/services/db.ts
git commit -m "feat: 数据库新增会话/联系人/频道缓存表"
```

---

### Task 5: cacheService 扩展 — 会话/联系人/频道缓存函数

**Files:**
- Modify: `apps/desktop/src/services/cacheService.ts`

- [ ] **Step 1: 在 cacheService.ts 中追加会话缓存函数**

在 `apps/desktop/src/services/cacheService.ts` 末尾（`// --- 内部工具函数 ---` 之前）追加：

```ts
// === 会话列表缓存 ===

interface CachedConversation {
  id: string;
  type: string;
  name: string | null;
  owner_id: string | null;
  created_at: string;
  last_message_content: string | null;
  last_message_content_type: string | null;
  last_message_at: string | null;
  other_user_id: string | null;
  other_username: string | null;
  other_display_name: string | null;
  other_avatar_url: string | null;
  unread_count: number;
  updated_at: string;
}

export async function cacheConversations(convs: any[]): Promise<void> {
  const db = await getDb();
  const ids = convs.map(c => c.id);

  // 全量覆盖写入
  for (const conv of convs) {
    await db.execute(
      `INSERT OR REPLACE INTO cached_conversations
       (id, type, name, owner_id, created_at, last_message_content, last_message_content_type,
        last_message_at, other_user_id, other_username, other_display_name, other_avatar_url,
        unread_count, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, datetime('now'))`,
      [
        conv.id,
        conv.type,
        conv.name || null,
        conv.owner_id || null,
        conv.created_at,
        conv.last_message_content ? JSON.stringify(conv.last_message_content) : null,
        conv.last_message_content_type || null,
        conv.last_message_at || null,
        conv.other_user_id || null,
        conv.other_username || null,
        conv.other_display_name || null,
        conv.other_avatar_url || null,
        conv.unread_count || 0,
      ]
    );
  }

  // 删除远端已不存在的记录
  if (ids.length > 0) {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    await db.execute(
      `DELETE FROM cached_conversations WHERE id NOT IN (${placeholders})`,
      ids
    );
  }
}

export async function getCachedConversations(): Promise<any[]> {
  const db = await getDb();
  const rows = await db.select<CachedConversation[]>(
    `SELECT * FROM cached_conversations ORDER BY last_message_at DESC, created_at DESC`
  );
  return rows.map(row => ({
    ...row,
    last_message_content: row.last_message_content ? JSON.parse(row.last_message_content) : null,
  }));
}

// === 联系人缓存 ===

export async function cacheContacts(contacts: any[]): Promise<void> {
  const db = await getDb();
  const ids = contacts.map(c => c.id);

  for (const contact of contacts) {
    await db.execute(
      `INSERT OR REPLACE INTO cached_contacts
       (id, username, display_name, avatar_url, status, updated_at)
       VALUES ($1, $2, $3, $4, $5, datetime('now'))`,
      [
        contact.id,
        contact.username,
        contact.display_name || null,
        contact.avatar_url || null,
        contact.status || 'offline',
      ]
    );
  }

  if (ids.length > 0) {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    await db.execute(
      `DELETE FROM cached_contacts WHERE id NOT IN (${placeholders})`,
      ids
    );
  }
}

export async function getCachedContacts(): Promise<any[]> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT * FROM cached_contacts ORDER BY display_name, username`
  );
}

// === 频道缓存 ===

export async function cacheChannels(channels: any[]): Promise<void> {
  const db = await getDb();
  const ids = channels.map(c => c.id);

  for (const channel of channels) {
    await db.execute(
      `INSERT OR REPLACE INTO cached_channels
       (id, name, description, owner_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, datetime('now'))`,
      [
        channel.id,
        channel.name,
        channel.description || null,
        channel.created_by || channel.owner_id || null,
        channel.created_at,
      ]
    );
  }

  if (ids.length > 0) {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    await db.execute(
      `DELETE FROM cached_channels WHERE id NOT IN (${placeholders})`,
      ids
    );
  }
}

export async function getCachedChannels(): Promise<any[]> {
  const db = await getDb();
  return db.select<any[]>(
    `SELECT * FROM cached_channels ORDER BY name`
  );
}

// === 更新会话最后消息（实时同步用） ===

export async function updateConversationLastMessage(
  conversationId: string,
  content: any,
  contentType: string,
  timestamp: string
): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE cached_conversations
     SET last_message_content = $1,
         last_message_content_type = $2,
         last_message_at = $3,
         updated_at = datetime('now')
     WHERE id = $4`,
    [JSON.stringify(content), contentType, timestamp, conversationId]
  );
}
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu && pnpm build 2>&1 | tail -20
```

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/services/cacheService.ts
git commit -m "feat: cacheService 新增会话/联系人/频道缓存函数"
```

---

### Task 6: cacheService 扩展 — 详细统计、分类清理、自动清理

**Files:**
- Modify: `apps/desktop/src/services/cacheService.ts`

- [ ] **Step 1: 替换 getCacheStats 为 getDetailedCacheStats**

将 `apps/desktop/src/services/cacheService.ts` 中现有的 `getCacheStats` 函数替换为：

```ts
export interface DetailedCacheStats {
  messages: { count: number; sizeBytes: number };
  conversations: { count: number; sizeBytes: number };
  contacts: { count: number; sizeBytes: number };
  channels: { count: number; sizeBytes: number };
  media: { count: number; sizeBytes: number };
  totalSizeBytes: number;
}

export async function getDetailedCacheStats(): Promise<DetailedCacheStats> {
  const db = await getDb();

  const countAndSize = async (table: string, sizeColumns: string[]): Promise<{ count: number; sizeBytes: number }> => {
    const countRows = await db.select<{ count: number }[]>(
      `SELECT COUNT(*) as count FROM ${table}`
    );
    const sizeExpr = sizeColumns.map(c => `COALESCE(LENGTH(${c}), 0)`).join(" + ");
    const sizeRows = await db.select<{ size: number }[]>(
      `SELECT COALESCE(SUM(${sizeExpr}), 0) as size FROM ${table}`
    );
    return { count: countRows[0]?.count || 0, sizeBytes: sizeRows[0]?.size || 0 };
  };

  const [messages, conversations, contacts, channels, media] = await Promise.all([
    countAndSize("cached_messages", ["content"]),
    countAndSize("cached_conversations", ["last_message_content", "name"]),
    countAndSize("cached_contacts", ["username", "display_name"]),
    countAndSize("cached_channels", ["name", "description"]),
    countAndSize("media_cache", []),
  ]);

  // 媒体文件用 size 字段
  const mediaSizeRows = await db.select<{ size: number }[]>(
    `SELECT COALESCE(SUM(size), 0) as size FROM media_cache`
  );
  media.sizeBytes = mediaSizeRows[0]?.size || 0;

  const totalSizeBytes = messages.sizeBytes + conversations.sizeBytes + contacts.sizeBytes + channels.sizeBytes + media.sizeBytes;

  return { messages, conversations, contacts, channels, media, totalSizeBytes };
}

// 保留旧接口兼容
export async function getCacheStats(): Promise<{ messageCount: number; totalSize: number }> {
  const stats = await getDetailedCacheStats();
  return { messageCount: stats.messages.count, totalSize: stats.totalSizeBytes };
}
```

- [ ] **Step 2: 添加分类清理函数**

在 cacheService.ts 中追加：

```ts
export async function clearMessageCache(): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM cached_messages`);
  await db.execute(`DELETE FROM sync_state`);
}

export async function clearMediaCache(): Promise<void> {
  const db = await getDb();
  // 删除本地媒体文件
  try {
    const rows = await db.select<{ local_path: string }[]>(
      `SELECT local_path FROM media_cache`
    );
    for (const row of rows) {
      try {
        const { remove } = await import("@tauri-apps/plugin-fs");
        await remove(row.local_path);
      } catch {
        // 文件可能已被删除，忽略
      }
    }
  } catch {
    // 忽略
  }
  await db.execute(`DELETE FROM media_cache`);
}

export async function clearConversationCache(): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM cached_conversations`);
}

export async function clearContactCache(): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM cached_contacts`);
}

export async function clearChannelCache(): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM cached_channels`);
}

export async function clearAllCache(): Promise<void> {
  await clearMessageCache();
  await clearMediaCache();
  await clearConversationCache();
  await clearContactCache();
  await clearChannelCache();
}
```

- [ ] **Step 3: 添加自动清理逻辑**

在 cacheService.ts 中追加：

```ts
// 每个会话最多保留 500 条消息
export async function autoCleanupMessages(maxPerConversation = 500): Promise<void> {
  const db = await getDb();
  await db.execute(
    `DELETE FROM cached_messages WHERE id IN (
      SELECT id FROM cached_messages
      WHERE (conversation_id, created_at) NOT IN (
        SELECT conversation_id, created_at FROM cached_messages
        ORDER BY created_at DESC
        LIMIT $1
      )
    )`,
    [maxPerConversation]
  );
}

// App 启动时调用：自动清理过期缓存
export async function runAutoCleanup(): Promise<void> {
  try {
    await autoCleanupMessages(500);
    await cleanupMediaCache(500 * 1024 * 1024);
  } catch (e) {
    console.error("Auto cleanup failed:", e);
  }
}
```

- [ ] **Step 4: 验证编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu && pnpm build 2>&1 | tail -20
```

- [ ] **Step 5: 提交**

```bash
git add apps/desktop/src/services/cacheService.ts
git commit -m "feat: cacheService 详细统计、分类清理、自动清理策略"
```

---

### Task 7: Store 改造 — chatStore 本地优先加载 + 实时同步

**Files:**
- Modify: `apps/desktop/src/stores/chatStore.ts`

- [ ] **Step 1: 修改 loadConversations 为本地优先模式**

将 `apps/desktop/src/stores/chatStore.ts` 中的 `loadConversations` 替换为：

```ts
loadConversations: async () => {
  set({ isLoadingConvs: true });
  try {
    // 1. 先读本地缓存，立即展示
    const cached = await cacheService.getCachedConversations();
    if (cached.length > 0) {
      set({ conversations: cached, isLoadingConvs: false });
    }
    // 2. 从服务器拉取最新数据
    const convs = await api.getConversations();
    set({ conversations: convs, isLoadingConvs: false });
    // 3. 写入缓存
    await cacheService.cacheConversations(convs);
  } catch (e) {
    console.error("Failed to load conversations:", e);
    // 网络失败，已有缓存数据则静默降级
    if (get().conversations.length === 0) {
      set({ isLoadingConvs: false });
    }
  }
},
```

- [ ] **Step 2: 在 addIncomingMessage 中同步更新会话缓存**

在 `addIncomingMessage` 方法的末尾（`// 如果是当前活跃会话且开启了已读回执` 之前），追加：

```ts
// 同步更新会话缓存中的最后消息
cacheService.updateConversationLastMessage(
  message.conversation_id,
  message.content,
  message.content_type,
  message.created_at
).catch(e => console.error("Failed to update conversation cache:", e));
```

- [ ] **Step 3: 验证编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu && pnpm build 2>&1 | tail -20
```

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/stores/chatStore.ts
git commit -m "feat: chatStore 会话列表本地优先加载 + 实时同步缓存"
```

---

### Task 8: Store 改造 — contactStore 本地优先加载

**Files:**
- Modify: `apps/desktop/src/stores/contactStore.ts`

- [ ] **Step 1: 修改 loadContacts 为本地优先模式**

在 `apps/desktop/src/stores/contactStore.ts` 顶部添加 `import * as cacheService from "../services/cacheService";`，然后替换 `loadContacts`：

```ts
loadContacts: async () => {
  set({ isLoading: true });
  try {
    // 1. 先读本地缓存
    const cached = await cacheService.getCachedContacts();
    if (cached.length > 0) {
      set({ contacts: cached, isLoading: false });
    }
    // 2. 从服务器拉取最新
    const contacts = await api.getContacts();
    set({ contacts, isLoading: false });
    // 3. 写入缓存
    await cacheService.cacheContacts(contacts);
  } catch (e) {
    console.error("Failed to load contacts:", e);
    if (get().contacts.length === 0) {
      set({ isLoading: false });
    }
  }
},
```

需要在 `create` 的回调参数中添加 `get`：`create<ContactState>((set, get) => ({`

- [ ] **Step 2: 验证编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu && pnpm build 2>&1 | tail -20
```

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/stores/contactStore.ts
git commit -m "feat: contactStore 联系人本地优先加载"
```

---

### Task 9: Store 改造 — channelStore 本地优先加载

**Files:**
- Modify: `apps/desktop/src/stores/channelStore.ts`

- [ ] **Step 1: 修改 loadChannels 为本地优先模式**

在 `apps/desktop/src/stores/channelStore.ts` 顶部添加 `import * as cacheService from "../services/cacheService";`，然后替换 `loadChannels`：

```ts
loadChannels: async () => {
  try {
    // 1. 先读本地缓存
    const cached = await cacheService.getCachedChannels();
    if (cached.length > 0) {
      set({ channels: cached });
    }
    // 2. 从服务器拉取最新
    const channels = await api.getChannels();
    set({ channels });
    // 3. 写入缓存
    await cacheService.cacheChannels(channels);
  } catch (e) {
    console.error("Failed to load channels:", e);
  }
},
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu && pnpm build 2>&1 | tail -20
```

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/stores/channelStore.ts
git commit -m "feat: channelStore 频道列表本地优先加载"
```

---

### Task 10: settingsStore 扩展 — 分类清理 action

**Files:**
- Modify: `apps/desktop/src/stores/settingsStore.ts`

- [ ] **Step 1: 扩展 settingsStore**

修改 `apps/desktop/src/stores/settingsStore.ts`：

1. 导入 `DetailedCacheStats`：

```ts
import { DetailedCacheStats } from "../services/cacheService";
```

（注意：需要从 cacheService 导出该类型）

2. 修改 `SettingsState` 接口，将 `cacheStats` 类型替换为 `DetailedCacheStats`，并添加分类清理 action：

```ts
interface SettingsState {
  settings: Settings;
  isLoading: boolean;
  cacheStats: DetailedCacheStats;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<string | null>;
  loadCacheStats: () => Promise<void>;
  clearMessageCache: () => Promise<void>;
  clearMediaCache: () => Promise<void>;
  clearConversationCache: () => Promise<void>;
  clearContactCache: () => Promise<void>;
  clearChannelCache: () => Promise<void>;
  clearAllCache: () => Promise<void>;
}
```

3. 修改初始值：

```ts
cacheStats: {
  messages: { count: 0, sizeBytes: 0 },
  conversations: { count: 0, sizeBytes: 0 },
  contacts: { count: 0, sizeBytes: 0 },
  channels: { count: 0, sizeBytes: 0 },
  media: { count: 0, sizeBytes: 0 },
  totalSizeBytes: 0,
},
```

4. 修改 `loadCacheStats`：

```ts
loadCacheStats: async () => {
  const stats = await cacheService.getDetailedCacheStats();
  set({ cacheStats: stats });
},
```

5. 添加分类清理 action：

```ts
clearMessageCache: async () => {
  await cacheService.clearMessageCache();
  get().loadCacheStats();
},
clearMediaCache: async () => {
  await cacheService.clearMediaCache();
  get().loadCacheStats();
},
clearConversationCache: async () => {
  await cacheService.clearConversationCache();
  get().loadCacheStats();
},
clearContactCache: async () => {
  await cacheService.clearContactCache();
  get().loadCacheStats();
},
clearChannelCache: async () => {
  await cacheService.clearChannelCache();
  get().loadCacheStats();
},
clearAllCache: async () => {
  await cacheService.clearAllCache();
  get().loadCacheStats();
},
```

- [ ] **Step 2: 验证编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu && pnpm build 2>&1 | tail -20
```

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/stores/settingsStore.ts
git commit -m "feat: settingsStore 扩展分类缓存统计和清理 action"
```

---

### Task 11: 设置页 UI — 存储管理分组展示

**Files:**
- Modify: `apps/desktop/src/components/settings/SettingsView.tsx`
- Modify: `apps/desktop/src/locales/zh.json`
- Modify: `apps/desktop/src/locales/en.json`

- [ ] **Step 1: 添加 i18n 翻译键**

在 `apps/desktop/src/locales/zh.json` 中添加：

```json
"storageSection.messages": "消息缓存",
"storageSection.messagesDesc": "本地缓存的聊天消息",
"storageSection.media": "媒体文件",
"storageSection.mediaDesc": "下载的图片、文件等",
"storageSection.conversations": "会话缓存",
"storageSection.conversationsDesc": "会话列表本地缓存",
"storageSection.contacts": "联系人",
"storageSection.contactsDesc": "联系人列表本地缓存",
"storageSection.channels": "频道",
"storageSection.channelsDesc": "频道列表本地缓存",
"storageSection.total": "总计",
"storageSection.clearAll": "一键清理全部",
"storageSection.clearConfirm": "确定要清理此项缓存吗？",
"storageSection.clearAllConfirm": "确定要清理所有缓存吗？这将删除所有本地数据。",
"storageSection.autoCleanup": "自动清理策略",
"storageSection.autoCleanupMedia": "媒体文件超过 500MB 时自动清理",
"storageSection.autoCleanupStartup": "启动时自动清理过期缓存",
"storageSection.items": "条",
"storageSection.files": "个",
"storageSection.people": "人",
"storageSection.units": "个"
```

在 `apps/desktop/src/locales/en.json` 中添加：

```json
"storageSection.messages": "Message Cache",
"storageSection.messagesDesc": "Locally cached chat messages",
"storageSection.media": "Media Files",
"storageSection.mediaDesc": "Downloaded images and files",
"storageSection.conversations": "Conversation Cache",
"storageSection.conversationsDesc": "Conversation list local cache",
"storageSection.contacts": "Contacts",
"storageSection.contactsDesc": "Contact list local cache",
"storageSection.channels": "Channels",
"storageSection.channelsDesc": "Channel list local cache",
"storageSection.total": "Total",
"storageSection.clearAll": "Clear All",
"storageSection.clearConfirm": "Are you sure you want to clear this cache?",
"storageSection.clearAllConfirm": "Are you sure you want to clear all cache? This will delete all local data.",
"storageSection.autoCleanup": "Auto Cleanup",
"storageSection.autoCleanupMedia": "Auto cleanup when media exceeds 500MB",
"storageSection.autoCleanupStartup": "Auto cleanup expired cache on startup",
"storageSection.items": "items",
"storageSection.files": "files",
"storageSection.people": "people",
"storageSection.units": "items"
```

- [ ] **Step 2: 重写 StorageSection 组件**

替换 `apps/desktop/src/components/settings/SettingsView.tsx` 中的 `StorageSection` 组件：

```tsx
function StorageSection() {
  const { t } = useTranslation();
  const {
    cacheStats,
    loadCacheStats,
    clearMessageCache,
    clearMediaCache,
    clearConversationCache,
    clearContactCache,
    clearChannelCache,
    clearAllCache,
  } = useSettingsStore();
  const [clearedMsg, setClearedMsg] = useState<string | null>(null);

  useEffect(() => {
    loadCacheStats();
  }, [loadCacheStats]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleClear = async (label: string, clearFn: () => Promise<void>) => {
    if (!window.confirm(t("storageSection.clearConfirm"))) return;
    await clearFn();
    setClearedMsg(label);
    setTimeout(() => setClearedMsg(null), 3000);
  };

  const handleClearAll = async () => {
    if (!window.confirm(t("storageSection.clearAllConfirm"))) return;
    await clearAllCache();
    setClearedMsg(t("storageSection.clearAll"));
    setTimeout(() => setClearedMsg(null), 3000);
  };

  const cacheItems = [
    {
      label: t("storageSection.messages"),
      desc: t("storageSection.messagesDesc"),
      count: cacheStats.messages.count,
      unit: t("storageSection.items"),
      size: cacheStats.messages.sizeBytes,
      onClear: () => handleClear(t("storageSection.messages"), clearMessageCache),
    },
    {
      label: t("storageSection.media"),
      desc: t("storageSection.mediaDesc"),
      count: cacheStats.media.count,
      unit: t("storageSection.files"),
      size: cacheStats.media.sizeBytes,
      onClear: () => handleClear(t("storageSection.media"), clearMediaCache),
    },
    {
      label: t("storageSection.conversations"),
      desc: t("storageSection.conversationsDesc"),
      count: cacheStats.conversations.count,
      unit: t("storageSection.items"),
      size: cacheStats.conversations.sizeBytes,
      onClear: () => handleClear(t("storageSection.conversations"), clearConversationCache),
    },
    {
      label: t("storageSection.contacts"),
      desc: t("storageSection.contactsDesc"),
      count: cacheStats.contacts.count,
      unit: t("storageSection.people"),
      size: cacheStats.contacts.sizeBytes,
      onClear: () => handleClear(t("storageSection.contacts"), clearContactCache),
    },
    {
      label: t("storageSection.channels"),
      desc: t("storageSection.channelsDesc"),
      count: cacheStats.channels.count,
      unit: t("storageSection.units"),
      size: cacheStats.channels.sizeBytes,
      onClear: () => handleClear(t("storageSection.channels"), clearChannelCache),
    },
  ];

  return (
    <div>
      <h3 className="text-lg font-bold text-feiyu-text mb-6">{t("settings.storageSection.title")}</h3>
      <div className="space-y-3">
        {cacheItems.map((item) => (
          <div key={item.label} className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-feiyu-text">{item.label}</div>
              <div className="text-xs text-feiyu-text-muted mt-0.5">{item.desc}</div>
              <div className="text-xs text-feiyu-text-secondary mt-1">
                {item.count} {item.unit} · {formatBytes(item.size)}
              </div>
            </div>
            <button
              onClick={item.onClear}
              className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              {t("settings.storageSection.clearCache")}
            </button>
          </div>
        ))}

        {/* 总计 */}
        <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-feiyu-text">{t("storageSection.total")}</div>
            <div className="text-lg font-bold text-feiyu-text">{formatBytes(cacheStats.totalSizeBytes)}</div>
          </div>
          <button
            onClick={handleClearAll}
            className="bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
          >
            {t("storageSection.clearAll")}
          </button>
        </div>

        {/* 自动清理策略 */}
        <div className="pt-4 border-t border-feiyu-border">
          <h4 className="text-sm font-medium text-feiyu-text mb-3">{t("storageSection.autoCleanup")}</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-feiyu-text-secondary">
              <span className="text-green-500">✓</span>
              <span>{t("storageSection.autoCleanupMedia")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-feiyu-text-secondary">
              <span className="text-green-500">✓</span>
              <span>{t("storageSection.autoCleanupStartup")}</span>
            </div>
          </div>
        </div>

        {clearedMsg && (
          <p className="text-sm text-green-600">
            {clearedMsg} {t("settings.storageSection.cacheCleared")}
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 验证编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu && pnpm build 2>&1 | tail -20
```

- [ ] **Step 4: 提交**

```bash
git add apps/desktop/src/components/settings/SettingsView.tsx apps/desktop/src/locales/zh.json apps/desktop/src/locales/en.json
git commit -m "feat: 设置页存储管理改为分组展示，支持分类清理"
```

---

### Task 12: App 启动时自动清理 + 端到端验证

**Files:**
- Modify: `apps/desktop/src/App.tsx`

- [ ] **Step 1: 在 App.tsx 中添加启动时自动清理**

在 `App` 组件的 `useEffect(() => { loadFromStorage(); }, []);` 之后追加：

```ts
// 启动时自动清理过期缓存
useEffect(() => {
  cacheService.runAutoCleanup();
}, []);
```

需要在顶部添加 `import * as cacheService from "./services/cacheService";`。

- [ ] **Step 2: 验证编译通过**

```bash
cd /Users/xucong/Documents/projects/feiyu && pnpm build 2>&1 | tail -20
```

- [ ] **Step 3: 提交**

```bash
git add apps/desktop/src/App.tsx
git commit -m "feat: App 启动时自动清理过期缓存"
```

- [ ] **Step 4: 更新 PROGRESS.md**

将本次完成的任务追加到 `PROGRESS.md` 的已完成列表中：

```markdown
### Phase 10: 断线重连与存储管理（2026-06-15）
- [x] Task 1: WsClient 增强 — 指数退避重连、心跳检测、状态事件、发送队列
- [x] Task 2: ConnectionBanner 顶部横幅组件 + App.tsx 集成
- [x] Task 3: 断连时禁用消息输入框
- [x] Task 4: 数据库新增会话/联系人/频道缓存表
- [x] Task 5: cacheService 新增会话/联系人/频道缓存函数
- [x] Task 6: cacheService 详细统计、分类清理、自动清理策略
- [x] Task 7: chatStore 会话列表本地优先加载 + 实时同步缓存
- [x] Task 8: contactStore 联系人本地优先加载
- [x] Task 9: channelStore 频道列表本地优先加载
- [x] Task 10: settingsStore 扩展分类缓存统计和清理
- [x] Task 11: 设置页存储管理 UI 改为分组展示
- [x] Task 12: App 启动自动清理 + 端到端验证
```

---

## 执行顺序

Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8 → Task 9 → Task 10 → Task 11 → Task 12

- Task 1-3：WS 增强 + UI（互相独立，可并行）
- Task 4-6：数据库 + cacheService（依赖顺序执行）
- Task 7-9：Store 改造（依赖 Task 4-5，三者互相独立可并行）
- Task 10-11：设置页（依赖 Task 6）
- Task 12：启动清理 + 验收（依赖所有前置任务）
