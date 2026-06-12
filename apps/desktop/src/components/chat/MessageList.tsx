import { useEffect, useRef } from "react";
import { MessageBubble } from "./MessageBubble";
import { useChatStore } from "../../stores/chatStore";
import { useAuthStore } from "../../stores/authStore";

export function MessageList() {
  const activeId = useChatStore((s) => s.activeConversationId);
  const messages = useChatStore((s) => s.messages);
  const user = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);

  const msgs = activeId ? messages.get(activeId) || [] : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  if (!activeId) {
    return (
      <div className="flex-1 flex items-center justify-center text-feiyu-text-muted">
        选择一个会话开始聊天
      </div>
    );
  }

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
      {msgs.map((msg) => {
        const content = msg.content;
        const text = typeof content === "object" && content.text ? content.text : JSON.stringify(content);
        return (
          <MessageBubble
            key={msg.id}
            content={text}
            contentType={msg.content_type}
            rawContent={content}
            time={formatTime(msg.created_at)}
            isOwn={msg.sender_id === user?.id}
            senderName={msg.sender_id === user?.id ? "我" : "对方"}
          />
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
