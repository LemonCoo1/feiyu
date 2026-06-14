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

  return db;
}
