import { Avatar } from "../common/Avatar";

interface MessageBubbleProps {
  content: string;
  contentType?: string;
  rawContent?: any;
  time: string;
  isOwn: boolean;
  senderName: string;
  showSender?: boolean;
  senderId?: string;
}

export function MessageBubble({ content, contentType, rawContent, time, isOwn, senderName, showSender }: MessageBubbleProps) {
  const isImage = contentType === "image" || (rawContent?.type === "image");
  const isFile = contentType === "file" || (rawContent?.type === "file");

  return (
    <div className={`flex gap-2 max-w-[70%] ${isOwn ? "ml-auto flex-row-reverse" : ""}`}>
      <Avatar name={senderName} size="sm" />
      <div>
        {showSender && (
          <div className="text-[11px] text-feiyu-text-secondary mb-0.5">{senderName}</div>
        )}
        <div
          className={`px-3 py-2 rounded-lg text-sm leading-relaxed ${
            isOwn
              ? "bg-feiyu-bubble-own text-white"
              : "bg-feiyu-bubble-other text-feiyu-text shadow-feiyu-sm"
          }`}
        >
          {isImage && rawContent?.url ? (
            <div>
              <img
                src={rawContent.url}
                alt={rawContent.filename || "图片"}
                className="max-w-[240px] max-h-[240px] rounded-md object-cover cursor-pointer"
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
              <span>{rawContent.filename || "文件"}</span>
            </a>
          ) : (
            content
          )}
        </div>
        <div className={`text-[11px] text-feiyu-text-muted mt-0.5 ${isOwn ? "text-right" : ""}`}>
          {time}
        </div>
      </div>
    </div>
  );
}
