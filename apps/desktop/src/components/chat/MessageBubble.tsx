import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { useSettingsStore } from "../../stores/settingsStore";
import { getCachedMediaUrl } from "../../services/cacheService";
import { ForwardModal } from "./ForwardModal";

interface MessageBubbleProps {
  conversationId?: string;
  content: string;
  contentType?: string;
  rawContent?: any;
  time: string;
  isOwn: boolean;
  isRead?: boolean;
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

export function MessageBubble({ conversationId, content, contentType, rawContent, time, isOwn, isRead, senderName, showSender, avatarUrl }: MessageBubbleProps) {
  const { t } = useTranslation();
  const fontSize = useSettingsStore((s) => s.settings.chat_font_size);
  const isImage = contentType === "image" || (rawContent?.type === "image");
  const isFile = contentType === "file" || (rawContent?.type === "file");
  const isSticker = contentType === "sticker";
  const isGif = contentType === "gif";
  const isForward = contentType === "forward";

  const [showMenu, setShowMenu] = useState(false);
  const [menuPos, setMenuPos] = useState({ x: 0, y: 0 });
  const [showForward, setShowForward] = useState(false);

  const textSizeClass = fontSize === "small" ? "text-xs" : fontSize === "large" ? "text-base" : "text-sm";

  const cachedStickerUrl = useCachedUrl(rawContent?.url);
  const cachedImageUrl = useCachedUrl(rawContent?.url);

  // 点击其他地方关闭右键菜单
  const handleDocClick = useCallback(() => setShowMenu(false), []);
  useEffect(() => {
    if (showMenu) {
      document.addEventListener("click", handleDocClick);
      return () => document.removeEventListener("click", handleDocClick);
    }
  }, [showMenu, handleDocClick]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPos({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  }, []);

  const handleForwardClick = useCallback(() => {
    setShowMenu(false);
    setShowForward(true);
  }, []);

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
            <div className="text-[11px] text-feiyu-text-secondary mb-0.5">{senderName}</div>
          )}
          <div
            onContextMenu={handleContextMenu}
            className={`px-3 py-2 rounded-lg text-sm leading-relaxed select-text ${
              isOwn
                ? "bg-feiyu-bubble-own text-white"
                : "bg-feiyu-bubble-other text-feiyu-text shadow-feiyu-sm"
            }`}
          >
            <div className="text-[10px] opacity-70 mb-0.5">{t("chat.forwarded")}</div>
            {forwardedText}
          </div>
          <div className={`text-[11px] text-feiyu-text-muted mt-0.5 ${isOwn ? "text-right" : ""}`}>
            {time}
            {isOwn && isRead && <span className="ml-1 text-feiyu-primary">{t("chat.read")}</span>}
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
            <div className="text-[11px] text-feiyu-text-secondary mb-0.5">{senderName}</div>
          )}
          <div className="relative group" onContextMenu={handleContextMenu}>
            <img
              src={cachedStickerUrl}
              alt={rawContent?.name || (isSticker ? t("chat.sticker") : t("chat.gif"))}
              className={`${isSticker ? "w-28 h-28" : "max-w-[200px] max-h-[200px]"} object-contain cursor-pointer rounded-lg hover:opacity-90 transition-opacity`}
              onClick={() => rawContent?.url && window.open(rawContent.url, "_blank")}
            />
            <div className="absolute bottom-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] bg-black/50 text-white px-1.5 py-0.5 rounded-md">
                {isSticker ? t("chat.sticker") : t("chat.gif")}
              </span>
            </div>
          </div>
          <div className={`text-[11px] text-feiyu-text-muted mt-0.5 ${isOwn ? "text-right" : ""}`}>
            {time}
            {isOwn && isRead && <span className="ml-1 text-feiyu-primary">{t("chat.read")}</span>}
          </div>
        </div>
        {showMenu && (
          <div
            className="fixed bg-feiyu-card rounded-lg shadow-lg border border-feiyu-border py-1 z-40"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            <button
              onClick={handleForwardClick}
              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-feiyu-text"
            >
              {t("chat.forward")}
            </button>
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
          <div className="text-[11px] text-feiyu-text-secondary mb-0.5">{senderName}</div>
        )}
        <div
          onContextMenu={handleContextMenu}
          className={`px-3 py-2 rounded-lg ${textSizeClass} leading-relaxed ${
            isOwn
              ? "bg-feiyu-bubble-own text-white"
              : "bg-feiyu-bubble-other text-feiyu-text shadow-feiyu-sm"
          } ${isImage || isFile ? "select-none" : "select-text"}`}
        >
          {isImage && rawContent?.url ? (
            <div>
              <img
                src={cachedImageUrl}
                alt={rawContent.filename || t("chat.image")}
                className="max-w-[240px] max-h-[240px] rounded-md object-contain cursor-pointer"
                onClick={() => window.open(rawContent.url, "_blank")}
              />
              {rawContent.filename && (
                <div className={`text-xs mt-1 ${isOwn ? "text-white/70" : "text-feiyu-text-muted"}`}>
                  {rawContent.filename}
                </div>
              )}
            </div>
          ) : isFile && rawContent?.url ? (
            <a
              href={rawContent.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 underline ${isOwn ? "text-white" : "text-feiyu-primary"}`}
            >
              <span>📄</span>
              <span>{rawContent.filename || t("chat.file")}</span>
            </a>
          ) : (
            content
          )}
        </div>
        <div className={`text-[11px] text-feiyu-text-muted mt-0.5 ${isOwn ? "text-right" : ""}`}>
          {time}
          {isOwn && isRead && <span className="ml-1 text-feiyu-primary">{t("chat.read")}</span>}
        </div>
      </div>
      {showMenu && (
        <div
          className="fixed bg-feiyu-card rounded-lg shadow-lg border border-feiyu-border py-1 z-40"
          style={{ left: menuPos.x, top: menuPos.y }}
        >
          <button
            onClick={handleForwardClick}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 text-feiyu-text"
          >
            {t("chat.forward")}
          </button>
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
