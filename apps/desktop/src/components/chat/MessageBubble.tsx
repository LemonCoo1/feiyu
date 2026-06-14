import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { useSettingsStore } from "../../stores/settingsStore";
import { getCachedMediaUrl } from "../../services/cacheService";

interface MessageBubbleProps {
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

export function MessageBubble({ content, contentType, rawContent, time, isOwn, isRead, senderName, showSender, avatarUrl }: MessageBubbleProps) {
  const { t } = useTranslation();
  const fontSize = useSettingsStore((s) => s.settings.chat_font_size);
  const isImage = contentType === "image" || (rawContent?.type === "image");
  const isFile = contentType === "file" || (rawContent?.type === "file");
  const isSticker = contentType === "sticker";
  const isGif = contentType === "gif";

  const textSizeClass = fontSize === "small" ? "text-xs" : fontSize === "large" ? "text-base" : "text-sm";

  const cachedStickerUrl = useCachedUrl(rawContent?.url);
  const cachedImageUrl = useCachedUrl(rawContent?.url);

  // 贴纸和 GIF 不使用气泡样式
  if (isSticker || isGif) {
    return (
      <div className={`flex gap-2 max-w-[70%] ${isOwn ? "ml-auto flex-row-reverse" : ""}`}>
        <Avatar name={senderName} url={avatarUrl} size="sm" />
        <div>
          {showSender && (
            <div className="text-[11px] text-feiyu-text-secondary mb-0.5">{senderName}</div>
          )}
          <div className="relative group">
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
    </div>
  );
}
