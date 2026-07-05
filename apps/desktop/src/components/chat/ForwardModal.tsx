import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../../stores/chatStore";
import { wsClient } from "../../services/ws";

interface ForwardModalProps {
  messageId?: string;
  conversationId: string;
  content: any;
  content_type: string;
  onClose: () => void;
}

export function ForwardModal({ conversationId, content, content_type, onClose }: ForwardModalProps) {
  const { t } = useTranslation();
  const conversations = useChatStore((s) => s.conversations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleForward = async () => {
    if (!selectedId || sent) return;
    setSent(true);
    wsClient.sendMessage(selectedId, "forward", {
      original_content: content,
      original_content_type: content_type,
    });
    onClose();
  };

  const targetConvs = conversations.filter((c) => c.id !== conversationId);

  return (
    <div className="fixed inset-0 bg-feiyu-overlay-heavy flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-feiyu-surface rounded-feiyu-xl shadow-feiyu-5 w-[360px] max-h-[480px] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-feiyu-border flex justify-between items-center">
          <span className="font-semibold text-feiyu-text">{t("chat.forward")}</span>
          <button onClick={onClose} className="text-feiyu-text-muted hover:text-feiyu-text">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {targetConvs.length === 0 ? (
            <p className="text-feiyu-text-muted text-sm text-center py-8">{t("chat.noConversations")}</p>
          ) : (
            targetConvs.map((conv) => {
              const isGroup = conv.type === "group";
              const name = isGroup ? (conv.name || t("chat.groupChat")) : (conv.other_display_name || conv.other_username || conv.name || t("conversation.unknown"));
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-feiyu-md text-sm flex items-center gap-2 transition-colors ${
                    selectedId === conv.id ? "bg-feiyu-primary-light text-feiyu-primary" : "hover:bg-feiyu-surface-container-high text-feiyu-text"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${isGroup ? "bg-feiyu-info" : "bg-feiyu-primary"}`}>
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate">{name}</span>
                </button>
              );
            })
          )}
        </div>
        <div className="px-4 py-3 border-t border-feiyu-border flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-1.5 text-sm rounded-feiyu-md border border-feiyu-border hover:bg-feiyu-surface-container-high">{t("conversation.cancel")}</button>
          <button
            onClick={handleForward}
            disabled={!selectedId || sent}
            className="px-4 py-1.5 text-sm rounded-feiyu-md bg-feiyu-primary text-white hover:bg-feiyu-primary-hover disabled:opacity-50"
          >
            {t("chat.send")}
          </button>
        </div>
      </div>
    </div>
  );
}
