import Database from "@tauri-apps/plugin-sql";
import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir } from "@tauri-apps/plugin-fs";
import { debugLog } from "../utils/debugLog";

// 每个账号一个独立的 SQLite 连接，按 userId 缓存，实现账号级数据隔离。
// plugin-sql 的 Database.load("sqlite:xxx") 会将 xxx 拼接到 app_config_dir()，
// 不支持绝对路径，因此使用 sqlite:<userId>.db 形式，每个账号一个 .db 文件。
const dbPool = new Map<string, Database>();
let currentUserId: string | null = null;

async function getAccountMediaDir(userId: string): Promise<string> {
  const appData = await appDataDir();
  return await join(appData, "accounts", userId, "media");
}

async function createTables(instance: Database) {
  // 消息本地缓存表
  await instance.execute(`
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

  await instance.execute(`
    CREATE INDEX IF NOT EXISTS idx_cached_messages_conv_time
      ON cached_messages(conversation_id, created_at)
  `);

  // 同步状态表
  await instance.execute(`
    CREATE TABLE IF NOT EXISTS sync_state (
      conversation_id TEXT PRIMARY KEY,
      last_sync_at TEXT NOT NULL,
      last_message_id TEXT,
      synced_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 媒体缓存索引表
  await instance.execute(`
    CREATE TABLE IF NOT EXISTS media_cache (
      url TEXT PRIMARY KEY,
      local_path TEXT NOT NULL,
      size INTEGER NOT NULL DEFAULT 0,
      cached_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // 会话列表缓存表
  await instance.execute(`
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
  await instance.execute(`
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
  await instance.execute(`
    CREATE TABLE IF NOT EXISTS cached_channels (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      owner_id TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);
}

// 初始化指定账号的数据库连接（首次会建表），并设为当前账号。
// 使用 sqlite:<userId>.db 格式，由 plugin-sql 解析到 app_config_dir() 下。
export async function initDbForUser(userId: string): Promise<Database> {
  const existing = dbPool.get(userId);
  if (existing) {
    debugLog(`[DB] 复用已有连接: userId=${userId}`);
    currentUserId = userId;
    return existing;
  }

  const dbConnStr = `sqlite:${userId}.db`;
  debugLog(`[DB] 初始化数据库: ${dbConnStr}`);
  const instance = await Database.load(dbConnStr);
  await createTables(instance);
  dbPool.set(userId, instance);
  currentUserId = userId;
  debugLog(`[DB] 数据库就绪: userId=${userId}`);
  return instance;
}

// 关闭指定账号的数据库连接（保留数据，仅释放连接池）。
export async function closeDb(userId: string): Promise<void> {
  const instance = dbPool.get(userId);
  if (instance) {
    try {
      await instance.close();
    } catch (e) {
      console.error("Failed to close db:", e);
    }
    dbPool.delete(userId);
  }
  if (currentUserId === userId) {
    currentUserId = null;
  }
}

export async function closeAllDb(): Promise<void> {
  for (const userId of [...dbPool.keys()]) {
    await closeDb(userId);
  }
}

export async function getDb(): Promise<Database> {
  if (!currentUserId) {
    throw new Error("Database not initialized: no current user. Call initDbForUser first.");
  }
  const instance = dbPool.get(currentUserId);
  if (!instance) {
    throw new Error(`Database not initialized for user ${currentUserId}.`);
  }
  return instance;
}

export function getCurrentUserId(): string | null {
  return currentUserId;
}

// 当前账号的媒体目录（账号隔离，使用 appDataDir）
export async function getMediaDir(): Promise<string> {
  if (!currentUserId) {
    throw new Error("No current user: cannot resolve media dir.");
  }
  const dir = await getAccountMediaDir(currentUserId);
  const dirExists = await exists(dir);
  if (!dirExists) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}
