import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ContactItem } from "./ContactItem";
import { AddContact } from "./AddContact";
import { useContactStore } from "../../stores/contactStore";
import { useChatStore } from "../../stores/chatStore";
import { useAuthStore } from "../../stores/authStore";
import { api } from "../../services/api";

interface ContactListProps {
  onOpenConversation: () => void;
}

export function ContactList({ onOpenConversation }: ContactListProps) {
  const { t } = useTranslation();
  const [showAdd, setShowAdd] = useState(false);
  const contacts = useContactStore((s) => s.contacts);
  const removeContact = useContactStore((s) => s.removeContact);
  const user = useAuthStore((s) => s.user);

  const handleStartChat = async (contactId: string) => {
    if (!user) return;
    try {
      const conv = await api.createDirectConversation(user.id, contactId);
      // 刷新会话列表，确保新会话进入列表并带上 other_user 元数据
      await useChatStore.getState().loadConversations();
      useChatStore.getState().setActiveConversation(conv.id);
      // 切换到消息视图
      onOpenConversation();
    } catch (e) {
      console.error("Failed to create conversation:", e);
    }
  };

  const handleRemove = async (contactId: string, name: string) => {
    if (!window.confirm(t("contact.confirmRemove", { name }))) return;
    try {
      await removeContact(contactId);
    } catch (e) {
      console.error("Failed to remove contact:", e);
    }
  };

  return (
    <div className="w-[280px] bg-feiyu-card border-r border-feiyu-border flex flex-col">
      <div className="px-4 py-3 border-b border-feiyu-border flex justify-between items-center">
        <h2 className="font-medium text-feiyu-text">{t("contact.title")}</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="text-feiyu-primary text-sm hover:underline"
        >
          {t("contact.add")}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-feiyu-text-muted text-sm">
            <span>{t("contact.noContacts")}</span>
            <button
              onClick={() => setShowAdd(true)}
              className="text-feiyu-primary text-xs mt-1 hover:underline"
            >
              {t("contact.addFirst")}
            </button>
          </div>
        ) : (
          contacts.map((c) => (
            <ContactItem
              key={c.id}
              name={c.display_name || c.username}
              username={c.username}
              online={c.status === "online"}
              onClick={() => handleStartChat(c.id)}
              action={
                <button
                  onClick={() => handleRemove(c.id, c.display_name || c.username)}
                  title={t("contact.remove")}
                  className="opacity-0 group-hover:opacity-100 text-feiyu-text-muted hover:text-feiyu-danger text-xs px-1 transition-opacity"
                >
                  ✕
                </button>
              }
            />
          ))
        )}
      </div>
      {showAdd && <AddContact onClose={() => setShowAdd(false)} />}
    </div>
  );
}
