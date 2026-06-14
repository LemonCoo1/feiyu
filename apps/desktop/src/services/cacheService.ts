import { getDb } from "./db";
import { api } from "./api";
import { convertFileSrc } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, writeFile } from "@tauri-apps/plugin-fs";

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

export async function getCacheStats(): Promise<{ messageCount: number; totalSize: number }> {
  const db = await getDb();
  const rows = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count FROM cached_messages`
  );
  return { messageCount: rows[0]?.count || 0, totalSize: 0 };
}

export async function clearConversationCache(conversationId: string): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM cached_messages WHERE conversation_id = $1`, [conversationId]);
  await db.execute(`DELETE FROM sync_state WHERE conversation_id = $1`, [conversationId]);
}

export async function clearAllCache(): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM cached_messages`);
  await db.execute(`DELETE FROM sync_state`);
  await db.execute(`DELETE FROM media_cache`);
}

// === 媒体文件缓存 ===

async function getMediaDir(): Promise<string> {
  const appData = await appDataDir();
  return await join(appData, "media");
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
    const mediaDir = await getMediaDir();
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
