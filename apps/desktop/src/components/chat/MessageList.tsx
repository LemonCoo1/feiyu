import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { MessageBubble } from "./MessageBubble";
import { useChatStore } from "../../stores/chatStore";
import { useAuthStore } from "../../stores/authStore";

function shouldShowTimeSeparator(prev: string, curr: string): boolean {
  const diff = new Date(curr).getTime() - new Date(prev).getTime();
  return diff > 5 * 60 * 1000;
}

export function MessageList() {
  const { t } = useTranslation();
  const activeId = useChatStore((s) => s.activeConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const messages = useChatStore((s) => s.messages);
  const conversationMembers = useChatStore((s) => s.conversationMembers);
  const lastReadMessageIds = useChatStore((s) => s.lastReadMessageIds);
  const user = useAuthStore((s) => s.user);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const prevActiveIdRef = useRef<string | null>(null);
  const isSwitchingRef = useRef(false);

  // Mark switching state when activeId changes
  if (prevActiveIdRef.current !== activeId) {
    prevActiveIdRef.current = activeId;
    isSwitchingRef.current = true;
  }

  const msgs = activeId ? messages.get(activeId) || [] : [];
  const conv = conversations.find((c) => c.id === activeId);
  const isGroup = conv?.type === "group";
  const members = activeId ? conversationMembers.get(activeId) || [] : [];
  const memberMap = new Map(members.map((m: any) => [m.user_id, m]));
  const lastReadId = activeId ? lastReadMessageIds.get(activeId) : undefined;
  const lastReadIdx = lastReadId ? msgs.findIndex((m) => m.id === lastReadId) : -1;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (behavior === "instant") {
      containerRef.current?.scrollTo({ top: containerRef.current.scrollHeight });
    } else {
      bottomRef.current?.scrollIntoView({ behavior });
    }
  }, []);

  useEffect(() => {
    if (isSwitchingRef.current) {
      isSwitchingRef.current = false;
      scrollToBottom("instant");
    } else {
      scrollToBottom("smooth");
    }
  }, [msgs.length, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 150);
  }, []);

  if (!activeId) {
    return (
      <div className="flex-1 flex items-center justify-center text-feiyu-text-muted text-sm">
        {t("chat.selectConversation")}
      </div>
    );
  }

  const formatDateSeparator = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const lang = localStorage.getItem("feiyu_language") || "zh-CN";
    if (d.toDateString() === now.toDateString()) {
      return t("chat.today");
    }
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return t("chat.yesterday");
    }
    return d.toLocaleDateString(lang, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (iso: string) => {
    const lang = localStorage.getItem("feiyu_language") || "zh-CN";
    return new Date(iso).toLocaleTimeString(lang, {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex-1 overflow-hidden relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        onContextMenu={(e) => e.preventDefault()}
        className="h-full overflow-y-auto px-5 py-4 flex flex-col"
      >
        {msgs.map((msg, idx) => {
          const content = msg.content;
          const text =
            typeof content === "object" && content.text
              ? content.text
              : JSON.stringify(content);
          const isOwn = msg.sender_id === user?.id;
          const sender = memberMap.get(msg.sender_id);
          const senderName = isOwn
            ? (user?.display_name || user?.username || t("search.me"))
            : (sender?.display_name || sender?.username || t("unknownUser"));
          const avatarUrl = isOwn ? user?.avatar_url : sender?.avatar_url;

          const showSeparator =
            idx === 0 ||
            (idx > 0 && shouldShowTimeSeparator(msgs[idx - 1].created_at, msg.created_at));

          return (
            <div key={msg.id}>
              {showSeparator && (
                <div className="flex items-center justify-center my-3">
                  <span className="text-[11px] text-feiyu-text-muted bg-feiyu-bg px-3 py-0.5 rounded-full">
                    {formatDateSeparator(msg.created_at)}
                  </span>
                </div>
              )}
              <div className="py-0.5">
                <MessageBubble
                  messageId={msg.id}
                  conversationId={activeId}
                  content={text}
                  contentType={msg.content_type}
                  rawContent={content}
                  time={formatTime(msg.created_at)}
                  isOwn={isOwn}
                  isRead={isOwn && lastReadIdx >= 0 && idx <= lastReadIdx}
                  senderName={senderName}
                  showSender={isGroup && !isOwn}
                  senderId={msg.sender_id}
                  avatarUrl={avatarUrl}
                />
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {showScrollBtn && (
        <button
          onClick={() => scrollToBottom()}
          className="absolute bottom-4 right-6 w-8 h-8 bg-feiyu-card shadow-feiyu rounded-full flex items-center justify-center text-feiyu-text-muted hover:text-feiyu-text hover:shadow-feiyu-md transition-all"
          title={t("chat.scrollToBottom")}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path
              d="M8 3v10M8 13l4-4M8 13L4 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
}
