import { useState } from "react";
import { ContactItem } from "./ContactItem";
import { AddContact } from "./AddContact";
import { useContactStore } from "../../stores/contactStore";
import { useAuthStore } from "../../stores/authStore";
import { api } from "../../services/api";

export function ContactList() {
  const [showAdd, setShowAdd] = useState(false);
  const contacts = useContactStore((s) => s.contacts);
  const user = useAuthStore((s) => s.user);

  const handleStartChat = async (contactId: string) => {
    if (!user) return;
    try {
      await api.createDirectConversation(user.id, contactId);
      // Parent will navigate to messages view
    } catch (e) {
      console.error("Failed to create conversation:", e);
    }
  };

  return (
    <div className="w-[280px] bg-white border-r border-feiyu-border flex flex-col">
      <div className="px-4 py-3 border-b border-feiyu-border flex justify-between items-center">
        <h2 className="font-medium text-feiyu-text">通讯录</h2>
        <button
          onClick={() => setShowAdd(true)}
          className="text-feiyu-primary text-sm hover:underline"
        >
          + 添加
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-feiyu-text-muted text-sm">
            <span>暂无联系人</span>
            <button
              onClick={() => setShowAdd(true)}
              className="text-feiyu-primary text-xs mt-1 hover:underline"
            >
              添加第一个联系人
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
            />
          ))
        )}
      </div>
      {showAdd && <AddContact onClose={() => setShowAdd(false)} />}
    </div>
  );
}
