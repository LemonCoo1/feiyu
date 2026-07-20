import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { NavBar, Input, Button, Image } from "antd-mobile";
import { SendOutline } from "antd-mobile-icons";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../stores/chatStore";
import { useAuthStore } from "../stores/authStore";
import { Avatar } from "../components/common/Avatar";
import { getServerUrl } from "../services/serverConfig";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content_type: string;
  content: any;
  created_at: string;
  recalled?: boolean;
  sender?: {
    display_name?: string;
    username?: string;
  };
}

/** 将相对路径补全为完整 URL */
function resolveFileUrl(url: string | undefined): string | undefined {
  if (!url) return url;
  if (/^(https?:|blob:|data:)/.test(url)) return url;
  return `${getServerUrl()}${url}`;
}

/** 从消息 content 提取可渲染文本（content 可能是对象） */
function extractText(content: any): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (typeof content === "object") {
    if (typeof content.text === "string") return content.text;
    if (typeof content.filename === "string") return content.filename;
  }
  try {
    return JSON.stringify(content);
  } catch {
    return "";
  }
}

interface Conversation {
  id: string;
  type: string;
  name: string | null;
  other_user_id?: string;
  other_username?: string;
  other_display_name?: string;
}

export function ChatPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");

  const conversations = useChatStore((s) => s.conversations) as unknown as Conversation[];
  const messagesMap = useChatStore((s) => s.messages);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);

  const conversation = conversations.find((c) => c.id === id);
  const convMessages: Message[] = id ? messagesMap.get(id) || [] : [];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      setActiveConversation(id);
      loadMessages(id);
    }
    return () => setActiveConversation(null);
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convMessages]);

  const getConversationName = () => {
    if (!conversation) return "";
    if (conversation.type === "group") {
      return conversation.name || t("conversation.group");
    }
    // direct 私聊：服务端已带 other_username/other_display_name
    return conversation.other_display_name || conversation.other_username || conversation.name || t("conversation.unknown");
  };

  const handleSend = async () => {
    if (!inputValue.trim() || !id) return;
    await sendMessage(id, inputValue.trim());
    setInputValue("");
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="chat-page">
      <NavBar
        onBack={() => navigate(-1)}
        style={{
          backgroundColor: "var(--feiyu-card)",
          borderBottom: "1px solid var(--feiyu-border)",
        }}
      >
        {getConversationName()}
      </NavBar>

      <div className="chat-messages">
        {convMessages.map((msg: any, index: number) => {
          const isMine = msg.sender_id === currentUserId;
          const showAvatar =
            index === 0 ||
            convMessages[index - 1]?.sender_id !== msg.sender_id;

          return (
            <div
              key={msg.id}
              style={{
                display: "flex",
                flexDirection: isMine ? "row-reverse" : "row",
                alignItems: "flex-end",
                maxWidth: "75%",
                marginBottom: showAvatar ? "12px" : "4px",
                gap: "8px",
                marginLeft: isMine ? "auto" : undefined,
              }}
            >
              {showAvatar && !isMine && (
                <Avatar
                  name={msg.sender?.display_name || msg.sender?.username || "?"}
                  size={36}
                />
              )}
              {!showAvatar && !isMine && <div style={{ width: 36, flexShrink: 0 }} />}
              <div style={{ minWidth: 0 }}>
                {msg.recalled ? (
                  <div className="message-bubble message-bubble-other" style={{ fontStyle: "italic", opacity: 0.6 }}>
                    {t("chat.recalled")}
                  </div>
                ) : msg.content_type === "image" ? (
                  <Image
                    src={resolveFileUrl(msg.content?.url)}
                    style={{
                      maxWidth: "200px",
                      borderRadius: "12px",
                    }}
                    fit="cover"
                  />
                ) : msg.content_type === "gif" || msg.content_type === "sticker" ? (
                  <Image
                    src={resolveFileUrl(msg.content?.url)}
                    style={{
                      maxWidth: msg.content_type === "sticker" ? "112px" : "200px",
                      maxHeight: "200px",
                      borderRadius: "12px",
                    }}
                    fit="contain"
                  />
                ) : msg.content_type === "file" ? (
                  <a
                    href={resolveFileUrl(msg.content?.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="message-bubble"
                    style={{
                      textDecoration: "none",
                      color: isMine ? "white" : "var(--feiyu-primary)",
                    }}
                  >
                    {t("chat.file")}: {msg.content?.filename || extractText(msg.content)}
                  </a>
                ) : (
                  <div
                    className={`message-bubble ${
                      isMine ? "message-bubble-mine" : "message-bubble-other"
                    }`}
                  >
                    {extractText(msg.content)}
                  </div>
                )}
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--feiyu-text-muted)",
                    marginTop: "2px",
                    textAlign: isMine ? "right" : "left",
                  }}
                >
                  {formatTime(msg.created_at)}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-area">
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <Input
            placeholder={t("chat.inputPlaceholder")}
            value={inputValue}
            onChange={setInputValue}
            onEnterPress={handleSend}
            style={{
              flex: 1,
              "--font-size": "16px",
              padding: "8px 12px",
              background: "var(--feiyu-bg)",
              borderRadius: "20px",
            }}
          />
          <Button
            color="primary"
            size="small"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            style={{
              borderRadius: "20px",
              padding: "8px 16px",
            }}
          >
            <SendOutline />
          </Button>
        </div>
      </div>
    </div>
  );
}
