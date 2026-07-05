import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useChannelStore } from "../../stores/channelStore";
import { useAuthStore } from "../../stores/authStore";
import { MessageBubble } from "../chat/MessageBubble";

export function ChannelView() {
  const { t } = useTranslation();
  const activeId = useChannelStore((s) => s.activeChannelId);
  const channels = useChannelStore((s) => s.channels);
  const messages = useChannelStore((s) => s.messages);
  const sendMessage = useChannelStore((s) => s.sendMessage);
  const user = useAuthStore((s) => s.user);
  const [text, setText] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const channel = channels.find((c) => c.id === activeId);
  const msgs = activeId ? messages.get(activeId) || [] : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  if (!activeId || !channel) {
    return (
      <div className="flex-1 bg-feiyu-surface flex items-center justify-center">
        <span className="text-feiyu-text-muted text-sm">{t("channel.selectChannel")}</span>
      </div>
    );
  }

  const handleSend = () => {
    if (!text.trim() || !activeId) return;
    sendMessage(activeId, text.trim());
    setText("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex-1 bg-feiyu-surface flex flex-col">
      <div className="px-5 py-3 border-b border-feiyu-border bg-feiyu-surface">
        <div className="flex items-center gap-2">
          <span className="text-feiyu-info font-bold">#</span>
          <span className="font-medium text-feiyu-text">{channel.name}</span>
          <span className="text-xs text-feiyu-text-muted">{t("channel.memberCount", { count: channel.member_count })}</span>
        </div>
        {channel.description && (
          <p className="text-xs text-feiyu-text-muted mt-1">{channel.description}</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
        {msgs.map((msg) => {
          const content = typeof msg.content === "object" && msg.content.text
            ? msg.content.text
            : JSON.stringify(msg.content);
          return (
            <MessageBubble
              key={msg.id}
              content={content}
              contentType={msg.content_type}
              rawContent={msg.content}
              time={new Date(msg.created_at).toLocaleTimeString(localStorage.getItem("feiyu_language") || "zh-CN", { hour: "2-digit", minute: "2-digit" })}
              isOwn={msg.sender_id === user?.id}
              senderName={msg.sender_id === user?.id ? t("search.me") : t("search.other")}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-feiyu-border px-5 py-3 bg-feiyu-surface">
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("channel.sendPlaceholder", { name: channel.name })}
            rows={1}
            className="flex-1 bg-feiyu-surface-dim border border-feiyu-border rounded-feiyu-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-feiyu-primary focus:ring-2 focus:ring-feiyu-primary/15"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="bg-feiyu-primary text-white rounded-feiyu-md px-4 py-2 text-sm font-medium hover:bg-feiyu-primary-hover disabled:opacity-50"
          >
            {t("channel.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
