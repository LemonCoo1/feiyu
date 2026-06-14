import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { GroupInfoPanel } from "./GroupInfoPanel";
import { useChatStore } from "../../stores/chatStore";

export function ChatWindow() {
  const { t } = useTranslation();
  const activeId = useChatStore((s) => s.activeConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const pinnedConversations = useChatStore((s) => s.pinnedConversations);
  const togglePin = useChatStore((s) => s.togglePin);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchMessages = useChatStore((s) => s.searchMessages);
  const clearSearch = useChatStore((s) => s.clearSearch);

  const conv = conversations.find((c) => c.id === activeId);
  const isGroup = conv?.type === "group";
  const isPinned = activeId ? pinnedConversations.has(activeId) : false;
  const title = conv
    ? isGroup
      ? (conv.name || t("chat.groupChat"))
      : (conv.other_display_name || conv.other_username || conv.name || t("conversation.unknown"))
    : "";

  const handleSearch = (q: string) => {
    setSearchQuery(q);
    if (q.trim()) {
      searchMessages(q);
    } else {
      clearSearch();
    }
  };

  const handleCloseSearch = () => {
    setShowSearch(false);
    setSearchQuery("");
    clearSearch();
  };

  if (!activeId) {
    return (
      <div className="flex-1 bg-feiyu-bg flex items-center justify-center">
        <span className="text-feiyu-text-muted text-sm">{t("chat.selectConversation")}</span>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-feiyu-bg flex flex-col">
      {/* Header */}
      <div className="px-5 py-3 border-b border-feiyu-border bg-feiyu-card flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          {isGroup && <span className="text-blue-500 text-xs">{t("conversation.groupBadge")}</span>}
          <span className="font-medium text-feiyu-text">{title}</span>
          {isPinned && <span className="text-feiyu-text-muted text-xs">📌</span>}
        </div>
        <div className="flex items-center gap-1">
          {/* Search */}
          <button
            onClick={() => { showSearch ? handleCloseSearch() : setShowSearch(true); }}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${
              showSearch ? "bg-feiyu-primary/10 text-feiyu-primary" : "text-feiyu-text-muted hover:bg-gray-100 hover:text-feiyu-text"
            }`}
            title={t("chat.searchMessages")}
          >
            🔍
          </button>
          {/* Pin */}
          <button
            onClick={() => activeId && togglePin(activeId)}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${
              isPinned ? "bg-feiyu-primary/10 text-feiyu-primary" : "text-feiyu-text-muted hover:bg-gray-100 hover:text-feiyu-text"
            }`}
            title={isPinned ? t("chat.unpin") : t("chat.pin")}
          >
            📌
          </button>
          {/* Group info */}
          {isGroup && (
            <button
              onClick={() => setShowGroupInfo(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm text-feiyu-text-muted hover:bg-gray-100 hover:text-feiyu-text transition-colors"
              title={t("chat.groupInfo")}
            >
              👥
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-5 py-2 bg-feiyu-card border-b border-feiyu-border flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t("chat.searchCurrentChat")}
            className="flex-1 bg-gray-50 border border-feiyu-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-feiyu-primary"
            autoFocus
          />
          <button onClick={handleCloseSearch} className="text-xs text-feiyu-text-muted hover:text-feiyu-text">
            {t("chat.cancel")}
          </button>
        </div>
      )}

      {/* Messages */}
      <MessageList />
      {/* Input */}
      <MessageInput />

      {/* Group info panel */}
      {showGroupInfo && conv && (
        <GroupInfoPanel
          conversationId={conv.id}
          conversationName={conv.name || t("chat.groupChat")}
          ownerId={conv.owner_id}
          onClose={() => setShowGroupInfo(false)}
        />
      )}
    </div>
  );
}
