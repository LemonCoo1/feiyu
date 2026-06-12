import { Avatar } from "../common/Avatar";

interface MessageBubbleProps {
  content: string;
  time: string;
  isOwn: boolean;
  senderName: string;
}

export function MessageBubble({ content, time, isOwn, senderName }: MessageBubbleProps) {
  return (
    <div className={`flex gap-2 max-w-[70%] ${isOwn ? "ml-auto flex-row-reverse" : ""}`}>
      <Avatar name={senderName} size="sm" />
      <div>
        <div
          className={`px-3 py-2 rounded-lg text-sm leading-relaxed ${
            isOwn
              ? "bg-feiyu-primary text-white"
              : "bg-gray-100 text-feiyu-text"
          }`}
        >
          {content}
        </div>
        <div className={`text-[11px] text-feiyu-text-muted mt-1 ${isOwn ? "text-right" : ""}`}>
          {time}
        </div>
      </div>
    </div>
  );
}
