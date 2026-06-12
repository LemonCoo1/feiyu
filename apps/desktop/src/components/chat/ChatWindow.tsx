import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { useChatStore } from "../../stores/chatStore";

export function ChatWindow() {
  const activeId = useChatStore((s) => s.activeConversationId);
  const conversations = useChatStore((s) => s.conversations);

  const conv = conversations.find((c) => c.id === activeId);
  const title = conv
    ? conv.other_display_name || conv.other_username || conv.name || "未知"
    : "";

  if (!activeId) {
    return (
      <div className="flex-1 bg-feiyu-bg flex items-center justify-center">
        <span className="text-feiyu-text-muted text-sm">选择一个会话开始聊天</span>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-feiyu-bg flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-feiyu-border bg-white flex justify-between items-center">
        <div>
          <span className="font-medium text-feiyu-text">{title}</span>
        </div>
      </div>
      {/* Messages */}
      <MessageList />
      {/* Input */}
      <MessageInput />
    </div>
  );
}
