import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { NavBar, Input, Button, Image } from "antd-mobile";
import { SendOutline } from "antd-mobile-icons";
import { useTranslation } from "react-i18next";
import { useChannelStore } from "../stores/channelStore";
import { useAuthStore } from "../stores/authStore";
import { Avatar } from "../components/common/Avatar";
import { getServerUrl } from "../services/serverConfig";

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

export function ChannelChatPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState("");

  const channels = useChannelStore((s) => s.channels);
  const messagesMap = useChannelStore((s) => s.messages);
  const loadMessages = useChannelStore((s) => s.loadMessages);
  const sendMessage = useChannelStore((s) => s.sendMessage);
  const setActiveChannel = useChannelStore((s) => s.setActiveChannel);
  const currentUserId = useAuthStore((s) => s.user?.id);

  const channel = channels.find((c) => c.id === id);
  const messages: any[] = id ? messagesMap.get(id) || [] : [];
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) {
      setActiveChannel(id);
      loadMessages(id);
    }
    return () => setActiveChannel(null);
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !id) return;
    sendMessage(id, inputValue.trim());
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
        {channel?.name || t("channel.detail")}
      </NavBar>

      <div className="chat-messages">
        {messages.map((msg: any, index: number) => {
          const isMine = msg.sender_id === currentUserId;
          const showAvatar =
            index === 0 || messages[index - 1]?.sender_id !== msg.sender_id;

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
                {showAvatar && !isMine && (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--feiyu-text-muted)",
                      marginBottom: "4px",
                    }}
                  >
                    {msg.sender?.display_name || msg.sender?.username}
                  </div>
                )}
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
