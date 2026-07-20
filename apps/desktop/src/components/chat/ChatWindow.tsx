import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Pin, Users } from "lucide-react";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { GroupInfoPanel } from "./GroupInfoPanel";
import { ResizeHandle } from "../common/ResizeHandle";
import { useChatStore } from "../../stores/chatStore";
import { useResizable } from "../../hooks/useResizable";

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
  const sendFile = useChatStore((s) => s.sendFile);
  const [dragOver, setDragOver] = useState(false);

  const inputResize = useResizable({
    storageKey: "feiyu_chat_input_height",
    defaultSize: 128,
    min: 80,
    max: 400,
    direction: "vertical",
    invert: true,
  });

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

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0 || !activeId) return;

    for (const file of files) {
      try {
        await sendFile(activeId, file);
      } catch (err) {
        console.error("拖拽上传失败:", err);
      }
    }
  }, [activeId, sendFile]);

  const handleCloseSearch = () => {
    setShowSearch(false);
    setSearchQuery("");
    clearSearch();
  };

  if (!activeId) {
    return (
      <div className="flex-1 bg-feiyu-surface flex items-center justify-center">
        <span className="text-feiyu-text-muted text-sm">{t("chat.selectConversation")}</span>
      </div>
    );
  }

  return (
    <div
      className="flex-1 bg-feiyu-surface flex flex-col relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* 拖拽 overlay */}
      {dragOver && (
        <div className="absolute inset-0 bg-feiyu-primary/10 border-2 border-dashed border-feiyu-primary rounded-feiyu-lg flex items-center justify-center z-30 pointer-events-none">
          <div className="text-feiyu-primary text-lg font-medium">
            {t("chat.dropToSend")}
          </div>
        </div>
      )}
      {/* Header */}
      <div className="px-5 py-3 border-b border-feiyu-border bg-feiyu-surface flex justify-between items-center">
        <div className="flex items-center gap-1.5">
          {isGroup && <span className="text-feiyu-info text-xs">{t("conversation.groupBadge")}</span>}
          <span className="font-medium text-feiyu-text">{title}</span>
          {isPinned && <Pin size={12} className="text-feiyu-text-muted" />}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { showSearch ? handleCloseSearch() : setShowSearch(true); }}
            className={`w-8 h-8 rounded-feiyu-md flex items-center justify-center text-sm transition-colors ${
              showSearch ? "bg-feiyu-primary-light text-feiyu-primary" : "text-feiyu-text-muted hover:bg-feiyu-surface-container-high hover:text-feiyu-text"
            }`}
            title={t("chat.searchMessages")}
          >
            <Search size={16} />
          </button>
          <button
            onClick={() => activeId && togglePin(activeId)}
            className={`w-8 h-8 rounded-feiyu-md flex items-center justify-center text-sm transition-colors ${
              isPinned ? "bg-feiyu-primary-light text-feiyu-primary" : "text-feiyu-text-muted hover:bg-feiyu-surface-container-high hover:text-feiyu-text"
            }`}
            title={isPinned ? t("chat.unpin") : t("chat.pin")}
          >
            <Pin size={16} />
          </button>
          {isGroup && (
            <button
              onClick={() => setShowGroupInfo(true)}
              className="w-8 h-8 rounded-feiyu-md flex items-center justify-center text-sm text-feiyu-text-muted hover:bg-feiyu-surface-container-high hover:text-feiyu-text transition-colors"
              title={t("chat.groupInfo")}
            >
              <Users size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-5 py-2 bg-feiyu-surface border-b border-feiyu-border flex items-center gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t("chat.searchCurrentChat")}
            className="flex-1 bg-feiyu-surface-dim border border-feiyu-border rounded-feiyu-md px-3 py-1.5 text-sm focus:outline-none focus:border-feiyu-primary focus:ring-2 focus:ring-feiyu-primary/15"
            autoFocus
          />
          <button onClick={handleCloseSearch} className="text-xs text-feiyu-text-muted hover:text-feiyu-text">
            {t("chat.cancel")}
          </button>
        </div>
      )}

      <MessageList />
      <ResizeHandle
        direction="vertical"
        onMouseDown={inputResize.onMouseDown}
      />
      <MessageInput height={inputResize.size} />

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
