import { SearchBar } from "./SearchBar";
import { ConversationItem } from "./ConversationItem";
import { useChatStore } from "../../stores/chatStore";

export function ConversationList() {
  const conversations = useChatStore((s) => s.conversations);
  const activeId = useChatStore((s) => s.activeConversationId);
  const setActive = useChatStore((s) => s.setActiveConversation);

  const formatTime = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  const getLastMessage = (conv: any) => {
    if (!conv.last_message_content) return "暂无消息";
    const content = conv.last_message_content;
    if (content.text) return content.text;
    if (typeof content === "string") return content;
    return JSON.stringify(content);
  };

  return (
    <div className="w-[280px] bg-white border-r border-feiyu-border flex flex-col">
      <SearchBar />
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-feiyu-text-muted text-sm">
            暂无会话
          </div>
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              name={conv.other_display_name || conv.other_username || conv.name || "未知"}
              lastMessage={getLastMessage(conv)}
              time={formatTime(conv.last_message_at)}
              active={activeId === conv.id}
              onClick={() => setActive(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
