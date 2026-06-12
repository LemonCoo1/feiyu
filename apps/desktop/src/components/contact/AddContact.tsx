import { useState } from "react";
import { useContactStore } from "../../stores/contactStore";
import { ContactItem } from "./ContactItem";

export function AddContact({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const contacts = useContactStore((s) => s.contacts);
  const searchResults = useContactStore((s) => s.searchResults);
  const searchUsers = useContactStore((s) => s.searchUsers);
  const addContact = useContactStore((s) => s.addContact);
  const clearSearch = useContactStore((s) => s.clearSearch);

  const handleSearch = (q: string) => {
    setQuery(q);
    searchUsers(q);
  };

  const contactIds = new Set(contacts.map((c) => c.id));

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-[400px] max-h-[500px] flex flex-col">
        <div className="px-4 py-3 border-b border-feiyu-border flex justify-between items-center">
          <h3 className="font-medium text-feiyu-text">添加联系人</h3>
          <button onClick={() => { clearSearch(); onClose(); }} className="text-feiyu-text-muted hover:text-feiyu-text">✕</button>
        </div>
        <div className="px-4 py-2">
          <input
            type="text"
            placeholder="搜索用户名或邮箱..."
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
                  <span className="text-xs text-feiyu-text-muted">已添加</span>
                ) : (
                  <button
                    onClick={() => addContact(u.id)}
                    className="text-xs bg-feiyu-primary text-white px-3 py-1 rounded-md hover:bg-feiyu-primary-hover"
                  >
                    添加
                  </button>
                )
              }
            />
          ))}
          {query && searchResults.length === 0 && (
            <div className="text-center py-8 text-feiyu-text-muted text-sm">未找到用户</div>
          )}
        </div>
      </div>
    </div>
  );
}
