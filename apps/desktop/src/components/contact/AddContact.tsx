import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useContactStore } from "../../stores/contactStore";
import { ContactItem } from "./ContactItem";

export function AddContact({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
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
                    onClick={() => addContact(u.id)}
                    className="text-xs bg-feiyu-primary text-white px-3 py-1 rounded-md hover:bg-feiyu-primary-hover"
                  >
                    {t("contact.addBtn")}
                  </button>
                )
              }
            />
          ))}
          {query && searchResults.length === 0 && (
            <div className="text-center py-8 text-feiyu-text-muted text-sm">{t("contact.notFound")}</div>
          )}
        </div>
      </div>
    </div>
  );
}
