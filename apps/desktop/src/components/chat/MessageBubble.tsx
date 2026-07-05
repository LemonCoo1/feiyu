import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { File } from "lucide-react";
import { Avatar } from "../common/Avatar";
import { useSettingsStore } from "../../stores/settingsStore";
import { getCachedMediaUrl } from "../../services/cacheService";
import { ForwardModal } from "./ForwardModal";
import { wsClient } from "../../services/ws";
import { getServerUrl } from "../../services/serverConfig";
import { useAuthStore } from "../../stores/authStore";

interface MessageBubbleProps {
  messageId?: string;
  conversationId?: string;
  content: string;
  contentType?: string;
  rawContent?: any;
  recalled?: boolean;
  time: string;
  isOwn: boolean;
  isRead?: boolean;
  groupReadBy?: string[];
  totalMemberCount?: number;
  senderName: string;
  showSender?: boolean;
  senderId?: string;
  avatarUrl?: string | null;
}

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

interface ReactionItem {
  emoji: string;
  count: number;
  user_ids: string[];
}

/** 将相对路径（如 /api/files/xxx）拼接为完整 URL */
function resolveFileUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("blob:") || url.startsWith("data:")) {
    return url;
  }
  return `${getServerUrl()}${url}`;
}

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥", "🎉", "👏"];

/** 已读状态指示器（群聊显示已读人数，私聊显示已读文字） */
function ReadIndicator({ isRead, groupReadBy, totalMemberCount }: {
  isRead?: boolean;
  groupReadBy?: string[];
  totalMemberCount?: number;
}) {
  const { t } = useTranslation();
  const readCount = groupReadBy?.length || 0;
  const otherMemberCount = (totalMemberCount || 1) - 1;
  const isGroup = totalMemberCount !== undefined && totalMemberCount > 0;

  if (isGroup) {
    const isAllRead = otherMemberCount > 0 && readCount >= otherMemberCount;
    return (
      <span className={`ml-1 ${readCount > 0 ? "text-feiyu-primary" : "text-feiyu-text-muted"}`}>
        {isAllRead ? t("chat.allRead") : readCount > 0 ? `${t("chat.read")} ${readCount}` : t("chat.unread")}
      </span>
    );
  }

  // 私聊
  if (isRead) {
    return <span className="ml-1 text-feiyu-primary">{t("chat.read")}</span>;
  }
  return <span className="ml-1 text-feiyu-text-muted">{t("chat.unread")}</span>;
}

export function MessageBubble({ messageId, conversationId, content, contentType, rawContent, recalled, time, isOwn, isRead, groupReadBy, totalMemberCount, senderName, showSender, avatarUrl }: MessageBubbleProps) {
  const { t } = useTranslation();
  const fontSize = useSettingsStore((s) => s.settings.chat_font_size);
  const user = useAuthStore((s) => s.user);
  const isImage = contentType === "image" || (rawContent?.type === "image");
  const isFile = contentType === "file" || (rawContent?.type === "file");
  const isSticker = contentType === "sticker";
  const isGif = contentType === "gif";
  const isForward = contentType === "forward";
  const isRecalled = recalled || rawContent?.recalled;

  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [showForward, setShowForward] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactions, setReactions] = useState<ReactionItem[]>([]);

  const textSizeClass = fontSize === "small" ? "text-xs" : fontSize === "large" ? "text-base" : "text-sm";

  const fileUrl = resolveFileUrl(rawContent?.url);
  const cachedStickerUrl = useCachedUrl(fileUrl);
  const cachedImageUrl = useCachedUrl(fileUrl);

  useEffect(() => {
    if (!messageId) return;
    const url = `${getServerUrl()}/api/messages/${messageId}/reactions`;
    fetch(url, {
      headers: { "Authorization": `Bearer ${localStorage.getItem("token")}` }
    })
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => setReactions(data))
      .catch(() => {});
  }, [messageId]);

  useEffect(() => {
    if (!messageId) return;
    const handler = (payload: { message_id: string; user_id: string; emoji: string; action: string }) => {
      if (payload.message_id !== messageId) return;
      setReactions(prev => {
        if (payload.action === "add") {
          const existing = prev.find(r => r.emoji === payload.emoji);
          if (existing) {
            if (existing.user_ids.includes(payload.user_id)) return prev;
            return prev.map(r => r.emoji === payload.emoji
              ? { ...r, count: r.count + 1, user_ids: [...r.user_ids, payload.user_id] }
              : r);
          }
          return [...prev, { emoji: payload.emoji, count: 1, user_ids: [payload.user_id] }];
        } else {
          return prev.map(r => r.emoji === payload.emoji
            ? { ...r, count: r.count - 1, user_ids: r.user_ids.filter(id => id !== payload.user_id) }
            : r).filter(r => r.count > 0);
        }
      });
    };
    wsClient.on("reaction.update", handler);
    return () => wsClient.off("reaction.update", handler);
  }, [messageId]);

  const handleDocClick = useCallback(() => {
    setShowMenu(false);
    setShowEmojiPicker(false);
  }, []);
  useEffect(() => {
    if (showMenu || showEmojiPicker) {
      document.addEventListener("click", handleDocClick);
      return () => document.removeEventListener("click", handleDocClick);
    }
  }, [showMenu, showEmojiPicker, handleDocClick]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
    setShowEmojiPicker(false);
  }, []);

  const handleForwardClick = useCallback(() => {
    setShowMenu(false);
    setShowForward(true);
  }, []);

  const handleRecall = useCallback(() => {
    setShowMenu(false);
    if (!messageId) return;
    wsClient.send({
      type: "message.recall",
      payload: { message_id: messageId }
    });
  }, [messageId]);

  const handleToggleReaction = useCallback((emoji: string) => {
    setShowEmojiPicker(false);
    setShowMenu(false);
    if (!messageId) return;
    const hasMyReaction = reactions.find(r => r.emoji === emoji)?.user_ids.includes(user?.id || "");
    if (hasMyReaction) {
      wsClient.send({
        type: "reaction.remove",
        payload: { message_id: messageId, emoji }
      });
    } else {
      wsClient.send({
        type: "reaction.add",
        payload: { message_id: messageId, emoji }
      });
    }
  }, [messageId, reactions, user]);

  // 已撤回消息显示
  if (isRecalled) {
    return (
      <div className={`flex gap-2 max-w-[70%] ${isOwn ? "ml-auto flex-row-reverse" : ""}`}>
        <Avatar name={senderName} url={avatarUrl} size="sm" />
        <div>
          {showSender && (
            <div className="text-caption text-feiyu-text-muted mb-0.5">{senderName}</div>
          )}
          <div className="bg-feiyu-surface-container border border-feiyu-border rounded-feiyu-lg px-4 py-2.5 text-feiyu-text-muted text-sm italic">
            {t("chat.recalled")}
          </div>
          <div className={`text-caption text-feiyu-text-muted mt-0.5 ${isOwn ? "text-right" : ""}`}>
            {time}
          </div>
        </div>
      </div>
    );
  }

  // 转发消息渲染
  if (isForward) {
    const original = rawContent?.original_content;
    const originalType = rawContent?.original_content_type;
    let forwardedText = "[转发]";
    if (original) {
      if (originalType === "text") {
        forwardedText = original.text || "[转发]";
      } else if (originalType === "image") {
        forwardedText = "[图片]";
      } else if (originalType === "file") {
        forwardedText = `[文件] ${original.filename || ""}`;
      } else if (originalType === "sticker") {
        forwardedText = "[贴纸]";
      } else if (originalType === "gif") {
        forwardedText = "[GIF]";
      } else {
        forwardedText = "[转发]";
      }
    }

    return (
      <div className={`flex gap-2 max-w-[70%] ${isOwn ? "ml-auto flex-row-reverse" : ""}`}>
        <Avatar name={senderName} url={avatarUrl} size="sm" />
        <div>
          {showSender && (
            <div className="text-caption text-feiyu-text-muted mb-0.5">{senderName}</div>
          )}
          <div
            onContextMenu={handleContextMenu}
            className={`px-3 py-2 rounded-feiyu-lg text-sm leading-relaxed select-text ${
              isOwn
                ? "bg-feiyu-bubble-own text-white"
                : "bg-feiyu-bubble-other text-feiyu-text shadow-feiyu-1"
            }`}
          >
            <div className="text-eyebrow opacity-70 mb-0.5">{t("chat.forwarded")}</div>
            {forwardedText}
          </div>
          <div className={`text-caption text-feiyu-text-muted mt-0.5 ${isOwn ? "text-right" : ""}`}>
            {time}
            {isOwn && <ReadIndicator isRead={isRead} groupReadBy={groupReadBy} totalMemberCount={totalMemberCount} />}
          </div>
        </div>
        {showForward && conversationId && (
          <ForwardModal
            conversationId={conversationId}
            content={rawContent}
            content_type={contentType || "text"}
            onClose={() => setShowForward(false)}
          />
        )}
      </div>
    );
  }

  // 贴纸和 GIF 不使用气泡样式
  if (isSticker || isGif) {
    return (
      <div className={`flex gap-2 max-w-[70%] ${isOwn ? "ml-auto flex-row-reverse" : ""}`}>
        <Avatar name={senderName} url={avatarUrl} size="sm" />
        <div>
          {showSender && (
            <div className="text-caption text-feiyu-text-muted mb-0.5">{senderName}</div>
          )}
          <div className="relative group" onContextMenu={handleContextMenu}>
            <img
              src={cachedStickerUrl}
              alt={rawContent?.name || (isSticker ? t("chat.sticker") : t("chat.gif"))}
              className={`${isSticker ? "w-28 h-28" : "max-w-[200px] max-h-[200px]"} object-contain cursor-pointer rounded-feiyu-lg hover:opacity-90 transition-opacity`}
              onClick={() => fileUrl && window.open(fileUrl, "_blank")}
            />
            <div className="absolute bottom-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-eyebrow bg-feiyu-overlay-heavy text-white px-1.5 py-0.5 rounded-feiyu-md">
                {isSticker ? t("chat.sticker") : t("chat.gif")}
              </span>
            </div>
          </div>
          <div className={`text-caption text-feiyu-text-muted mt-0.5 ${isOwn ? "text-right" : ""}`}>
            {time}
            {isOwn && <ReadIndicator isRead={isRead} groupReadBy={groupReadBy} totalMemberCount={totalMemberCount} />}
          </div>
        </div>
        {showMenu && (
          <div
            className="fixed bg-feiyu-card rounded-feiyu-lg shadow-feiyu-4 border border-feiyu-border py-1 z-40"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            <button
              onClick={() => { setShowMenu(false); setShowEmojiPicker(true); }}
              className="w-full text-left px-4 py-2 text-sm hover:bg-feiyu-surface-container-high text-feiyu-text"
            >
              {t("chat.react")}
            </button>
            <button
              onClick={handleForwardClick}
              className="w-full text-left px-4 py-2 text-sm hover:bg-feiyu-surface-container-high text-feiyu-text"
            >
              {t("chat.forward")}
            </button>
            {isOwn && (
              <button
                onClick={handleRecall}
                className="w-full text-left px-4 py-2 text-sm hover:bg-feiyu-surface-container-high text-feiyu-text"
              >
                {t("chat.recall")}
              </button>
            )}
          </div>
        )}
        {showEmojiPicker && (
          <div
            className="fixed bg-feiyu-card rounded-feiyu-lg shadow-feiyu-4 border border-feiyu-border p-2 z-40"
            style={{ left: menuPos.x, top: menuPos.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex gap-1">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleToggleReaction(emoji)}
                  className="w-8 h-8 flex items-center justify-center rounded-feiyu-sm hover:bg-feiyu-surface-container-high text-lg"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
        {showForward && conversationId && (
          <ForwardModal
            conversationId={conversationId}
            content={rawContent}
            content_type={contentType || "text"}
            onClose={() => setShowForward(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className={`flex gap-2 max-w-[70%] ${isOwn ? "ml-auto flex-row-reverse" : ""}`}>
      <Avatar name={senderName} url={avatarUrl} size="sm" />
      <div>
        {showSender && (
          <div className="text-caption text-feiyu-text-muted mb-0.5">{senderName}</div>
        )}
        <div
          onContextMenu={handleContextMenu}
          className={`px-3 py-2 rounded-feiyu-lg ${textSizeClass} leading-relaxed ${
            isOwn
              ? "bg-feiyu-bubble-own text-white"
              : "bg-feiyu-bubble-other text-feiyu-text shadow-feiyu-1"
          } ${isImage || isFile ? "select-none" : "select-text"}`}
        >
          {isImage && rawContent?.url ? (
            <div>
              <img
                src={cachedImageUrl}
                alt={rawContent.filename || t("chat.image")}
                className="max-w-[240px] max-h-[240px] rounded-feiyu-md object-contain cursor-pointer"
                onClick={() => fileUrl && window.open(fileUrl, "_blank")}
              />
              {rawContent.filename && (
                <div className={`text-xs mt-1 ${isOwn ? "text-white/70" : "text-feiyu-text-muted"}`}>
                  {rawContent.filename}
                </div>
              )}
            </div>
          ) : isFile && rawContent?.url ? (
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 underline ${isOwn ? "text-white" : "text-feiyu-primary"}`}
            >
              <File size={14} className="flex-shrink-0" />
              <span>{rawContent.filename || t("chat.file")}</span>
            </a>
          ) : (
            content
          )}
        </div>
        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            {reactions.map((r) => {
              const hasMyReaction = user && r.user_ids.includes(user.id);
              return (
                <button
                  key={r.emoji}
                  onClick={() => handleToggleReaction(r.emoji)}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-feiyu-pill text-xs border transition-colors ${
                    hasMyReaction
                      ? "border-feiyu-primary bg-feiyu-primary-light text-feiyu-primary"
                      : "border-feiyu-border bg-feiyu-card text-feiyu-text-muted hover:bg-feiyu-surface-container-high"
                  }`}
                >
                  <span>{r.emoji}</span>
                  <span>{r.count}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className={`text-caption text-feiyu-text-muted mt-0.5 ${isOwn ? "text-right" : ""}`}>
          {time}
          {isOwn && <ReadIndicator isRead={isRead} groupReadBy={groupReadBy} totalMemberCount={totalMemberCount} />}
        </div>
      </div>
      {showMenu && (
        <div
          className="fixed bg-feiyu-card rounded-feiyu-lg shadow-feiyu-4 border border-feiyu-border py-1 z-40"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <button
            onClick={() => { setShowMenu(false); setShowEmojiPicker(true); }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-feiyu-surface-container-high text-feiyu-text"
          >
            {t("chat.react")}
          </button>
          <button
            onClick={handleForwardClick}
            className="w-full text-left px-4 py-2 text-sm hover:bg-feiyu-surface-container-high text-feiyu-text"
          >
            {t("chat.forward")}
          </button>
          {isOwn && (
            <button
              onClick={handleRecall}
              className="w-full text-left px-4 py-2 text-sm hover:bg-feiyu-surface-container-high text-feiyu-text"
            >
              {t("chat.recall")}
            </button>
          )}
        </div>
      )}
      {showEmojiPicker && (
        <div
          className="fixed bg-feiyu-card rounded-feiyu-lg shadow-feiyu-4 border border-feiyu-border p-2 z-40"
          style={{ left: menuPos.x, top: menuPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex gap-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleToggleReaction(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded-feiyu-sm hover:bg-feiyu-surface-container-high text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}
      {showForward && conversationId && (
        <ForwardModal
          conversationId={conversationId}
          content={rawContent}
          content_type={contentType || "text"}
          onClose={() => setShowForward(false)}
        />
      )}
    </div>
  );
}
