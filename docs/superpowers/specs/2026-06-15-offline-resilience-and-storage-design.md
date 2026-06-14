# 断线重连与存储管理 设计文档

日期：2026-06-15

## 背景

飞鱼桌面端当前存在两个核心问题：

1. **断网/服务器不可达时 UI 为空**：WebSocket 有基础的 3 秒固定间隔重连，但连接状态未暴露给 UI，无心跳检测；会话列表、联系人、频道列表未缓存，断网后界面空白
2. **存储管理粗糙**：设置页仅有消息缓存统计和一键清理，缺少分类管理和自动清理策略

## 方案：增量增强（方案 A）

在现有 WsClient + cacheService 基础上增强，复用已有代码，改动集中可控。

---

## 模块一：WebSocket 连接管理增强

### 改动范围

`apps/desktop/src/services/ws.ts`

### 设计

1. **连接状态枚举**：`connecting | connected | disconnected`
2. **指数退避重连**：1s → 2s → 4s → 8s → 16s → 30s（上限），重连成功后重置 attempt 计数
3. **心跳检测**：每 30 秒发送 `{ type: "ping" }`，10 秒内未收到 `pong` 则主动断开触发重连
4. **状态事件**：新增 `onStatusChange(handler)` / `offStatusChange(handler)` 方法，UI 层监听连接状态变化
5. **发送队列**：断连期间 `send()` 的消息放入队列（上限 100 条），重连认证成功后自动 flush

### 接口

```ts
type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

class WsClient {
  private status: ConnectionStatus = 'disconnected';
  private statusHandlers: ((status: ConnectionStatus) => void)[];
  private reconnectAttempt: number;
  private pingInterval: number | null;
  private pongTimeout: number | null;
  private sendQueue: any[];

  connect(token: string): void;
  disconnect(): void;
  send(data: any): void;  // 断连时入队，连上后 flush
  getStatus(): ConnectionStatus;
  onStatusChange(handler: (status: ConnectionStatus) => void): void;
  offStatusChange(handler: (status: ConnectionStatus) => void): void;
  // 既有方法不变
  on(type: string, handler: MessageHandler): void;
  off(type: string, handler: MessageHandler): void;
  sendMessage(...): void;
  sendRead(...): void;
}
```

### 重连流程

```
onclose →
  if token exists:
    status = 'disconnected'
    notify status handlers
    schedule reconnect after delay (2^attempt, max 30s)
    reconnectAttempt++

doConnect →
  status = 'connecting'
  notify status handlers

onopen →
  send auth.token
  // 当前服务端认证成功后无专门 ack 消息，onopen 即视为连接成功
  // 若后续服务端增加 auth.ack，可在此处改为等待 ack
  status = 'connected'
  reconnectAttempt = 0
  flush sendQueue
  start ping interval (30s)
  notify status handlers

ping timeout (10s no pong) →
  ws.close()  // 触发 onclose → 重连
```

---

## 模块二：连接状态 UI — 顶部横幅

### 改动范围

- `apps/desktop/src/components/common/ConnectionBanner.tsx`（新建）
- `apps/desktop/src/App.tsx`（集成）

### 行为

| 状态 | 背景色 | 文案 | 自动消失 |
|---|---|---|---|
| `disconnected` | `bg-red-500` | "连接已断开，正在重连..." | 否 |
| `connecting` | `bg-orange-500` | "正在连接服务器..." | 否 |
| `connected`（从断开恢复） | `bg-green-500` | "已重新连接" | 2 秒后自动消失 |

### 布局

- 固定在窗口最顶部，`z-50`，高度 32px
- 使用 `transform: translateY()` 动画展开/收起，不影响下方布局
- 文案通过 i18n 支持多语言

### 发送限制

断连时：
- 输入框 `disabled`，placeholder 显示"等待连接..."
- 发送按钮置灰

### App.tsx 集成

```tsx
const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connected');

useEffect(() => {
  wsClient.onStatusChange(setConnectionStatus);
  return () => wsClient.offStatusChange(setConnectionStatus);
}, []);

return (
  <div className="flex h-screen w-screen flex-col">
    <ConnectionBanner status={connectionStatus} />
    <div className="flex flex-1 overflow-hidden">
      {/* 原有布局 */}
    </div>
  </div>
);
```

---

## 模块三：会话/联系人/频道离线缓存

### 改动范围

- `apps/desktop/src/services/db.ts`（新增建表迁移）
- `apps/desktop/src/services/cacheService.ts`（新增缓存函数）
- `apps/desktop/src/stores/chatStore.ts`（改造 loadConversations）
- `apps/desktop/src/stores/contactStore.ts`（改造 loadContacts）
- `apps/desktop/src/stores/channelStore.ts`（改造 loadChannels）

### 新增 SQLite 表

```sql
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
);

CREATE TABLE IF NOT EXISTS cached_contacts (
  id TEXT PRIMARY KEY,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'offline',
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS cached_channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  owner_id TEXT,
  created_at TEXT,
  updated_at TEXT
);
```

### cacheService 新增函数

```ts
// 会话
cacheConversations(convs: Conversation[]): Promise<void>;
getCachedConversations(): Promise<Conversation[]>;

// 联系人
cacheContacts(contacts: Contact[]): Promise<void>;
getCachedContacts(): Promise<Contact[]>;

// 频道
cacheChannels(channels: Channel[]): Promise<void>;
getCachedChannels(): Promise<Channel[]>;
```

写入策略：全量覆盖（`INSERT OR REPLACE`），删除远端已不存在的记录。

### Store 改造模式

以 chatStore 为例，contactStore / channelStore 同理：

```ts
loadConversations: async () => {
  set({ isLoadingConvs: true });
  try {
    // 1. 先读本地缓存，立即展示
    const cached = await cacheService.getCachedConversations();
    if (cached.length > 0) {
      set({ conversations: cached, isLoadingConvs: false });
    }
    // 2. 从服务器拉取最新
    const convs = await api.getConversations();
    set({ conversations: convs, isLoadingConvs: false });
    // 3. 写入缓存
    await cacheService.cacheConversations(convs);
  } catch (e) {
    // 网络失败，已有缓存数据则静默降级
    if (get().conversations.length === 0) {
      set({ isLoadingConvs: false });
    }
  }
}
```

### 实时同步

WS 收到新消息时，同步更新 `cached_conversations` 中对应会话的 `last_message_*` 字段（在 `addIncomingMessage` 中追加写入）。

---

## 模块四：存储管理完善

### 改动范围

- `apps/desktop/src/services/cacheService.ts`（新增统计和分类清理函数）
- `apps/desktop/src/stores/settingsStore.ts`（扩展 cacheStats 类型）
- `apps/desktop/src/components/settings/SettingsView.tsx`（改造存储管理 UI）

### 缓存统计增强

```ts
interface DetailedCacheStats {
  messages: { count: number; sizeBytes: number };
  conversations: { count: number; sizeBytes: number };
  contacts: { count: number; sizeBytes: number };
  channels: { count: number; sizeBytes: number };
  media: { count: number; sizeBytes: number };
  totalSizeBytes: number;
}

getDetailedCacheStats(): Promise<DetailedCacheStats>;
```

实现：逐表 `SELECT COUNT(*)` + `COALESCE(SUM(LENGTH(...)), 0)` 计算。

### 分类清理函数

```ts
clearMessageCache(): Promise<void>;       // DELETE FROM cached_messages + sync_state
clearMediaCache(): Promise<void>;         // DELETE FROM media_cache + 删除本地文件
clearConversationCache(): Promise<void>;  // DELETE FROM cached_conversations
clearContactCache(): Promise<void>;       // DELETE FROM cached_contacts
clearChannelCache(): Promise<void>;       // DELETE FROM cached_channels
clearAllCache(): Promise<void>;           // 以上全部
```

### 自动清理策略

- **媒体文件**：App 启动时调用 `cleanupMediaCache(500MB)`，保留现有逻辑
- **消息缓存**：每类会话只保留最近 500 条，超出的按 `created_at ASC` 删除
- **触发时机**：App 启动时 + 每次 `cacheMessage` 后检查是否超阈值

### 设置页 UI

分组展示各类缓存，每类独立大小显示和清理按钮：

```
┌─────────────────────────────────┐
│ 存储管理                         │
│                                  │
│ 消息缓存    1,234 条  12.3 MB   │
│ [清理]                            │
│                                  │
│ 媒体文件    456 个    234.5 MB   │
│ [清理]                            │
│                                  │
│ 会话缓存    23 条     0.1 MB     │
│ [清理]                            │
│                                  │
│ 联系人      15 人     0.01 MB    │
│ [清理]                            │
│                                  │
│ 频道        5 个      0.01 MB    │
│ [清理]                            │
│                                  │
│ 总计                  246.9 MB   │
│ [一键清理全部]                    │
│                                  │
│ 自动清理策略                      │
│ [✓] 媒体文件超过 500MB 时自动清理 │
│ [✓] 启动时自动清理过期缓存        │
└─────────────────────────────────┘
```

清理前弹出确认对话框，防止误操作。

---

## 文件变更清单

| 文件 | 操作 | 说明 |
|---|---|---|
| `apps/desktop/src/services/ws.ts` | 修改 | 指数退避、心跳、状态事件、发送队列 |
| `apps/desktop/src/components/common/ConnectionBanner.tsx` | 新建 | 连接状态横幅组件 |
| `apps/desktop/src/App.tsx` | 修改 | 集成 ConnectionBanner，连接状态监听 |
| `apps/desktop/src/services/db.ts` | 修改 | 新增 3 张缓存表的建表迁移 |
| `apps/desktop/src/services/cacheService.ts` | 修改 | 新增会话/联系人/频道缓存函数、详细统计、分类清理、自动清理 |
| `apps/desktop/src/stores/chatStore.ts` | 修改 | loadConversations 本地优先+增量同步 |
| `apps/desktop/src/stores/contactStore.ts` | 修改 | loadContacts 本地优先+增量同步 |
| `apps/desktop/src/stores/channelStore.ts` | 修改 | loadChannels 本地优先+增量同步 |
| `apps/desktop/src/stores/settingsStore.ts` | 修改 | 扩展 cacheStats 类型，新增分类清理 action |
| `apps/desktop/src/components/settings/SettingsView.tsx` | 修改 | 存储管理 UI 改为分组展示 |
| `apps/desktop/src/hooks/useWebSocket.ts` | 修改 | 输入框禁用状态与连接状态联动 |

## 不做的事

- 不引入新的依赖库
- 不新建独立的 ConnectionManager 类（在 WsClient 内增强）
- 不实现 API 请求拦截/重试层（仅 WS 消息队列）
- 不缓存消息搜索结果（搜索仍依赖服务端）
