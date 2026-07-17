import { getDb, getMediaDir } from "./db";
import { api } from "./api";
import { convertFileSrc } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { exists, mkdir, remove, writeFile } from "@tauri-apps/plugin-fs";

interface CachedMessage {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content_type: string;
  content: string;
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

  return rows.map(rowToMessage).reverse();
}

export async function getLastSyncAt(conversationId: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ last_sync_at: string }[]>(
    `SELECT last_sync_at FROM sync_state WHERE conversation_id = $1`,
    [conversationId]
  );
  return rows.length > 0 ? rows[0].last_sync_at : null;
}

export async function syncNewMessages(conversationId: string): Promise<Message[]> {
  const lastSync = await getLastSyncAt(conversationId);

  const newMsgs = await api.getMessages(conversationId, 100, undefined, lastSync || undefined);

  if (newMsgs.length === 0) {
    return [];
  }

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
    const sizeQuery = sizeExpr
      ? `SELECT COALESCE(SUM(${sizeExpr}), 0) as size FROM ${table}`
      : `SELECT 0 as size FROM ${table}`;
    const sizeRows = await db.select<{ size: number }[]>(
      sizeQuery
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

export async function clearMessageCache(): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM cached_messages`);
  await db.execute(`DELETE FROM sync_state`);
}

export async function clearMediaCache(): Promise<void> {
  const db = await getDb();
  try {
    const rows = await db.select<{ local_path: string }[]>(
      `SELECT local_path FROM media_cache`
    );
    for (const row of rows) {
      try {
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

export async function autoCleanupMessages(maxPerConversation = 500): Promise<void> {
  const db = await getDb();
  // 获取所有会话 ID
  const convs = await db.select<{ conversation_id: string }[]>(
    `SELECT DISTINCT conversation_id FROM cached_messages`
  );
  for (const conv of convs) {
    await db.execute(
      `DELETE FROM cached_messages WHERE conversation_id = $1 AND id NOT IN (
        SELECT id FROM cached_messages WHERE conversation_id = $1
        ORDER BY created_at DESC LIMIT $2
      )`,
      [conv.conversation_id, maxPerConversation]
    );
  }
}

export async function runAutoCleanup(): Promise<void> {
  try {
    await autoCleanupMessages(500);
    await cleanupMediaCache(500 * 1024 * 1024);
  } catch (e) {
    console.error("Auto cleanup failed:", e);
  }
}

// === 媒体文件缓存 ===

async function getMediaDirScoped(): Promise<string> {
  // 媒体目录按账号隔离，路径由 db 模块统一管理
  return await getMediaDir();
}

function urlToFilename(url: string): string {
  const ext = url.split(".").pop()?.split("?")[0] || "bin";
  let hash = 0;
  for (let i = 0; i < url.length; i++) {
    hash = ((hash << 5) - hash + url.charCodeAt(i)) | 0;
  }
  return `${Math.abs(hash).toString(36)}.${ext}`;
}

export async function getCachedMediaUrl(url: string): Promise<string> {
  if (!url || url.startsWith("blob:") || url.startsWith("data:")) return url;

  const db = await getDb();
  const rows = await db.select<{ local_path: string }[]>(
    `SELECT local_path FROM media_cache WHERE url = $1`,
    [url]
  );
  if (rows.length > 0) {
    return convertFileSrc(rows[0].local_path);
  }

  try {
    const mediaDir = await getMediaDirScoped();
    const filename = urlToFilename(url);
    const localPath = await join(mediaDir, filename);

    const dirExists = await exists(mediaDir);
    if (!dirExists) {
      await mkdir(mediaDir, { recursive: true });
    }

    const fileExists = await exists(localPath);
    if (!fileExists) {
      const response = await fetch(url);
      const buffer = await response.arrayBuffer();
      await writeFile(localPath, new Uint8Array(buffer));

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
    return url;
  }
}

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

  if (ids.length > 0) {
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    await db.execute(
      `DELETE FROM cached_conversations WHERE id NOT IN (${placeholders})`,
      ids
    );
  } else {
    // 列表为空时清空全表，避免残留已删除的幽灵数据
    await db.execute(`DELETE FROM cached_conversations`);
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
  } else {
    // 联系人为空时清空全表，避免残留已删除的幽灵数据
    await db.execute(`DELETE FROM cached_contacts`);
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
  } else {
    // 频道为空时清空全表，避免残留已删除的幽灵数据
    await db.execute(`DELETE FROM cached_channels`);
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
