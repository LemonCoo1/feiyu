import { useEffect, useRef, useState, useCallback } from "react";
import { MessageBubble } from "./MessageBubble";
import { useChatStore } from "../../stores/chatStore";
import { useAuthStore } from "../../stores/authStore";

function shouldShowTimeSeparator(prev: string, curr: string): boolean {
  const diff = new Date(curr).getTime() - new Date(prev).getTime();
  return diff > 5 * 60 * 1000;
}

export function MessageList() {
  const activeId = useChatStore((s) => s.activeConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const messages = useChatStore((s) => s.messages);
  const user = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const msgs = activeId ? messages.get(activeId) || [] : [];
  const conv = conversations.find((c) => c.id === activeId);
  const isGroup = conv?.type === "group";

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [msgs.length, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 150);
  }, []);

  if (!activeId) {
    return (
      <div className="flex-1 flex items-center justify-center text-feiyu-text-muted text-sm">
        选择一个会话开始聊天
      </div>
    );
  }

  const formatDateSeparator = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return "今天";
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return "昨天";
    }
    return d.toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (iso: string) => {
    return new Date(iso).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex-1 overflow-hidden relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-5 py-4 flex flex-col"
      >
        {msgs.map((msg, idx) => {
          const content = msg.content;
          const text =
            typeof content === "object" && content.text
              ? content.text
              : JSON.stringify(content);
          const isOwn = msg.sender_id === user?.id;

          const showSeparator =
            idx === 0 ||
            (idx > 0 && shouldShowTimeSeparator(msgs[idx - 1].created_at, msg.created_at));

          return (
            <div key={msg.id}>
              {showSeparator && (
                <div className="flex items-center justify-center my-3">
                  <span className="text-[11px] text-feiyu-text-muted bg-feiyu-bg px-3 py-0.5 rounded-full">
                    {formatDateSeparator(msg.created_at)}
                  </span>
                </div>
              )}
              <div className="py-0.5">
                <MessageBubble
                  content={text}
                  contentType={msg.content_type}
                  rawContent={content}
                  time={formatTime(msg.created_at)}
                  isOwn={isOwn}
                  senderName={isOwn ? "我" : "对方"}
                  showSender={isGroup && !isOwn}
                  senderId={msg.sender_id}
                />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-4 right-6 w-8 h-8 bg-white shadow-feiyu rounded-full flex items-center justify-center text-feiyu-text-muted hover:text-feiyu-text hover:shadow-feiyu-md transition-all"
          title="回到底部"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 3v10M8 13l4-4M8 13L4 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
