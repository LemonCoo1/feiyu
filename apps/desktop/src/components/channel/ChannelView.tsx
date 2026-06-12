import { useState, useEffect, useRef } from "react";
import { useChannelStore } from "../../stores/channelStore";
import { useAuthStore } from "../../stores/authStore";
import { MessageBubble } from "../chat/MessageBubble";

export function ChannelView() {
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
      <div className="flex-1 bg-feiyu-bg flex items-center justify-center">
        <span className="text-feiyu-text-muted text-sm">选择一个频道</span>
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
    <div className="flex-1 bg-feiyu-bg flex flex-col">
      <div className="px-5 py-3 border-b border-feiyu-border bg-white">
        <div className="flex items-center gap-2">
          <span className="text-purple-500 font-bold">#</span>
          <span className="font-medium text-feiyu-text">{channel.name}</span>
          <span className="text-xs text-feiyu-text-muted">{channel.member_count} 成员</span>
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
              time={new Date(msg.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
              isOwn={msg.sender_id === user?.id}
              senderName={msg.sender_id === user?.id ? "我" : "他人"}
            />
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-feiyu-border px-5 py-3">
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`在 #${channel.name} 中发送消息...`}
            rows={1}
            className="flex-1 bg-gray-50 border border-feiyu-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-feiyu-primary"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim()}
            className="bg-feiyu-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-feiyu-primary-hover disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
