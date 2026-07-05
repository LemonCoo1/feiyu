import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../../stores/chatStore";
import { useAuthStore } from "../../stores/authStore";

export function SearchBar() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchMessages = useChatStore((s) => s.searchMessages);
  const clearSearch = useChatStore((s) => s.clearSearch);
  const searchResults = useChatStore((s) => s.searchResults);
  const isSearching = useChatStore((s) => s.isSearching);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const user = useAuthStore((s) => s.user);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!value.trim()) {
      clearSearch();
      setShowResults(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      searchMessages(value);
      setShowResults(true);
    }, 300);
  };

  const handleResultClick = (conversationId: string) => {
    setActiveConversation(conversationId);
    setShowResults(false);
    setQuery("");
    clearSearch();
  };

  const formatContent = (content: any) => {
    if (!content) return "";
    if (typeof content === "object" && content.text) return content.text;
    if (typeof content === "string") return content;
    return JSON.stringify(content);
  };

  return (
    <div ref={containerRef} className="relative px-3 py-2">
      <input
        type="text"
        placeholder={t("search.placeholder")}
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
        className="w-full bg-feiyu-surface-dim border border-feiyu-border rounded-feiyu-md px-3 py-2 text-sm text-feiyu-text placeholder:text-feiyu-text-muted focus:outline-none focus:border-feiyu-primary focus:ring-2 focus:ring-feiyu-primary/15"
      />
      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-feiyu-surface border border-feiyu-border rounded-feiyu-lg shadow-feiyu-4 z-50 max-h-80 overflow-y-auto">
          {isSearching ? (
            <div className="px-3 py-4 text-sm text-feiyu-text-muted text-center">{t("search.searching")}</div>
          ) : searchResults.length === 0 ? (
            <div className="px-3 py-4 text-sm text-feiyu-text-muted text-center">{t("search.noResults")}</div>
          ) : (
            searchResults.map((msg) => {
              const content = formatContent(msg.content);
              const isOwn = msg.sender_id === user?.id;
              return (
                <button
                  key={msg.id}
                  onClick={() => handleResultClick(msg.conversation_id)}
                  className="w-full px-3 py-2 text-left hover:bg-feiyu-surface-container-high border-b border-feiyu-border-light last:border-b-0 transition-colors"
                >
                  <div className="text-xs text-feiyu-text-muted mb-0.5">
                    {isOwn ? t("search.me") : t("search.other")} · {new Date(msg.created_at).toLocaleString(localStorage.getItem("feiyu_language") || "zh-CN")}
                  </div>
                  <div className="text-sm text-feiyu-text truncate">{content}</div>
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
