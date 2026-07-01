import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useContactStore } from "../../stores/contactStore";
import { ContactItem } from "./ContactItem";

export function AddContact({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const contacts = useContactStore((s) => s.contacts);
  const searchResults = useContactStore((s) => s.searchResults);
  const isSearching = useContactStore((s) => s.isSearching);
  const isAdding = useContactStore((s) => s.isAdding);
  const addError = useContactStore((s) => s.addError);
  const searchUsers = useContactStore((s) => s.searchUsers);
  const addContact = useContactStore((s) => s.addContact);
  const clearSearch = useContactStore((s) => s.clearSearch);

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearch = (q: string) => {
    setQuery(q);
    // 防抖：避免逐字符发请求，减少不必要的搜索调用与输入抖动
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      searchUsers(q);
    }, 250);
  };

  // 卸载时清理计时器，避免弹窗关闭后仍触发搜索
  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const handleAdd = async (contactId: string) => {
    try {
      await addContact(contactId);
    } catch {
      // 错误已记录到 store.addError，在此吞掉避免未处理的 Promise 拒绝
    }
  };

  const contactIds = new Set(contacts.map((c) => c.id));

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-feiyu-card rounded-xl shadow-xl w-[400px] max-h-[500px] flex flex-col">
        <div className="px-4 py-3 border-b border-feiyu-border flex justify-between items-center">
          <h3 className="font-medium text-feiyu-text">{t("contact.addContact")}</h3>
          <button onClick={() => { clearSearch(); onClose(); }} className="text-feiyu-text-muted hover:text-feiyu-text">✕</button>
        </div>
        <div className="px-4 py-2">
          <input
            type="text"
            placeholder={t("contact.searchPlaceholder")}
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full border border-feiyu-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-feiyu-primary"
            autoFocus
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {searchResults.map((u) => (
            <ContactItem
              key={u.id}
              name={u.display_name || u.username}
              username={u.username}
              action={
                contactIds.has(u.id) ? (
                  <span className="text-xs text-feiyu-text-muted">{t("contact.added")}</span>
                ) : (
                  <button
                    onClick={() => handleAdd(u.id)}
                    disabled={isAdding}
                    className="text-xs bg-feiyu-primary text-white px-3 py-1 rounded-md hover:bg-feiyu-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t("contact.addBtn")}
                  </button>
                )
              }
            />
          ))}
          {query && !isSearching && searchResults.length === 0 && (
            <div className="text-center py-8 text-feiyu-text-muted text-sm">{t("contact.notFound")}</div>
          )}
          {addError && (
            <div className="text-center py-2 text-xs text-feiyu-danger">{addError}</div>
          )}
        </div>
      </div>
    </div>
  );
}
