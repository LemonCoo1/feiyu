import { useNavigate } from "react-router-dom";
import { List, Empty } from "antd-mobile";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../stores/chatStore";
import { Avatar } from "../components/common/Avatar";

interface Conversation {
  id: string;
  type: string;
  name: string | null;
  last_message_at?: string;
  last_message_content?: any;
  last_message_content_type?: string;
  unread_count?: number;
  other_user_id?: string;
  other_username?: string;
  other_display_name?: string;
}

export function ConversationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const conversationsRaw = useChatStore((s) => s.conversations);
  const conversations = conversationsRaw as unknown as Conversation[];

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return t("time.yesterday");
    } else if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const getConversationName = (conv: any) => {
    if (conv.type === "group") {
      return conv.name || t("conversation.group");
    }
    // direct 私聊：服务端已带 other_username/other_display_name
    return conv.other_display_name || conv.other_username || conv.name || t("conversation.unknown");
  };

  const getLastMessage = (conv: Conversation) => {
    if (!conv.last_message_content) return "";
    if (conv.last_message_content_type === "image") return t("message.image");
    if (conv.last_message_content_type === "file") return t("message.file");
    const content = conv.last_message_content;
    return typeof content === "object" && content.text ? content.text : String(content);
  };

  if (conversations.length === 0) {
    return (
      <div style={{ padding: "40px 20px" }}>
        <Empty description={t("conversation.empty")} />
      </div>
    );
  }

  return (
    <div>
      <div
        style={{
          padding: "16px",
          fontSize: "24px",
          fontWeight: "bold",
          color: "var(--feiyu-text)",
        }}
      >
        {t("tab.messages")}
      </div>
      <List style={{ "--border-top": "none", "--border-bottom": "none" }}>
        {conversations.map((conv) => (
          <List.Item
            key={conv.id}
            onClick={() => navigate(`/chat/${conv.id}`)}
            style={{ padding: "12px 16px" }}
            prefix={
              <Avatar
                name={getConversationName(conv)}
                size={48}
              />
            }
            description={
              <span style={{ color: "var(--feiyu-text-muted)", fontSize: "13px" }}>
                {getLastMessage(conv)}
              </span>
            }
            extra={
              <span style={{ color: "var(--feiyu-text-muted)", fontSize: "12px" }}>
                {conv.last_message_at ? formatTime(conv.last_message_at) : ""}
              </span>
            }
          >
            <span style={{ fontWeight: 500 }}>{getConversationName(conv)}</span>
          </List.Item>
        ))}
      </List>
    </div>
  );
}
