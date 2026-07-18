import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { List, SearchBar, Empty, Dialog, Toast } from "antd-mobile";
import { useTranslation } from "react-i18next";
import { useContactStore } from "../stores/contactStore";
import { useAuthStore } from "../stores/authStore";
import { Avatar } from "../components/common/Avatar";
import { api } from "../services/api";

export function ContactsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const contacts = useContactStore((s) => s.contacts);
  const loadContacts = useContactStore((s) => s.loadContacts);
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await api.searchUsers(query);
      setSearchResults(results.filter((u: any) => u.id !== currentUserId));
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddContact = async (userId: string) => {
    try {
      await api.addContact(userId);
      await loadContacts();
      Toast.show({ content: t("contact.addSuccess"), position: "center" });
      setSearchQuery("");
      setSearchResults([]);
    } catch (error: any) {
      Toast.show({
        content: error.message || t("contact.addFailed"),
        position: "center",
      });
    }
  };

  const displayList = searchQuery.trim() ? searchResults : contacts;

  return (
    <div>
      <div
        style={{
          padding: "16px",
          fontSize: "24px",
          fontWeight: "bold",
          color: "var(--feiyu-text)",
        }}
      >
        {t("tab.contacts")}
      </div>
      <div style={{ padding: "0 16px 12px" }}>
        <SearchBar
          placeholder={t("contact.searchPlaceholder")}
          value={searchQuery}
          onChange={handleSearch}
          style={{
            "--background": "var(--feiyu-bg-secondary)",
            borderRadius: "8px",
          }}
        />
      </div>

      {displayList.length === 0 && !isSearching && (
        <Empty
          description={
            searchQuery.trim()
              ? t("contact.noResults")
              : t("contact.empty")
          }
        />
      )}

      <List style={{ "--border-top": "none", "--border-bottom": "none" }}>
        {displayList.map((user: any) => (
          <List.Item
            key={user.id}
            onClick={() => {
              if (searchQuery.trim()) {
                Dialog.confirm({
                  content: t("contact.addConfirm", {
                    name: user.display_name || user.username,
                  }),
                  onConfirm: () => handleAddContact(user.id),
                });
              } else {
                navigate(`/contacts/${user.id}`);
              }
            }}
            style={{ padding: "12px 16px" }}
            prefix={
              <Avatar
                name={user.display_name || user.username}
                size={44}
                online={user.is_online}
              />
            }
            description={
              user.is_online ? (
                <span style={{ color: "var(--feiyu-success)", fontSize: "12px" }}>
                  {t("status.online")}
                </span>
              ) : undefined
            }
          >
            <span style={{ fontWeight: 500 }}>
              {user.display_name || user.username}
            </span>
          </List.Item>
        ))}
      </List>
    </div>
  );
}
