import { useState } from "react";
import { SearchBar } from "./SearchBar";
import { ConversationItem } from "./ConversationItem";
import { useChatStore } from "../../stores/chatStore";
import { useContactStore } from "../../stores/contactStore";

export function ConversationList() {
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const conversations = useChatStore((s) => s.conversations);
  const isLoadingConvs = useChatStore((s) => s.isLoadingConvs);
  const activeId = useChatStore((s) => s.activeConversationId);
  const setActive = useChatStore((s) => s.setActiveConversation);
  const createGroup = useChatStore((s) => s.createGroup);
  const contacts = useContactStore((s) => s.contacts);

  const formatTime = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
  };

  const getLastMessage = (conv: any) => {
    if (!conv.last_message_content) return "暂无消息";
    const content = conv.last_message_content;
    if (content.text) return content.text;
    if (typeof content === "string") return content;
    return JSON.stringify(content);
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0) return;
    await createGroup(groupName, selectedMembers);
    setGroupName("");
    setSelectedMembers([]);
    setShowCreateGroup(false);
  };

  return (
    <div className="w-[280px] bg-white border-r border-feiyu-border flex flex-col">
      <div className="border-b border-feiyu-border flex items-center">
        <div className="flex-1">
          <SearchBar />
        </div>
        <button
          onClick={() => setShowCreateGroup(true)}
          className="text-feiyu-primary text-xs hover:underline mr-3 flex-shrink-0"
        >
          创建群聊
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoadingConvs ? (
          <div className="space-y-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-3 py-2 flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-gray-200 skeleton-pulse flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="h-3.5 w-24 bg-gray-200 rounded skeleton-pulse mb-1.5" />
                  <div className="h-3 w-36 bg-gray-200 rounded skeleton-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-feiyu-text-muted text-sm">
            暂无会话
          </div>
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              name={conv.type === "group" ? (conv.name || "群聊") : (conv.other_display_name || conv.other_username || conv.name || "未知")}
              lastMessage={getLastMessage(conv)}
              time={formatTime(conv.last_message_at)}
              active={activeId === conv.id}
              isGroup={conv.type === "group"}
              onClick={() => setActive(conv.id)}
            />
          ))
        )}
      </div>

      {showCreateGroup && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[360px] p-6">
            <h3 className="font-medium text-feiyu-text mb-4">创建群聊</h3>
            <input
              type="text"
              placeholder="群聊名称"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="w-full border border-feiyu-border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-feiyu-primary"
              autoFocus
            />
            <div className="mb-3">
              <p className="text-xs text-feiyu-text-muted mb-2">选择成员：</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {contacts.length === 0 ? (
                  <p className="text-xs text-feiyu-text-muted">暂无联系人</p>
                ) : (
                  contacts.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => toggleMember(c.id)}
                      className={`w-full px-3 py-1.5 text-sm text-left rounded-lg transition-colors ${
                        selectedMembers.includes(c.id)
                          ? "bg-feiyu-primary/10 text-feiyu-primary"
                          : "hover:bg-gray-50 text-feiyu-text"
                      }`}
                    >
                      {c.display_name || c.username}
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowCreateGroup(false); setSelectedMembers([]); setGroupName(""); }}
                className="px-4 py-2 text-sm text-feiyu-text-muted hover:text-feiyu-text"
              >
                取消
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={!groupName.trim() || selectedMembers.length === 0}
                className="px-4 py-2 text-sm bg-feiyu-primary text-white rounded-lg hover:bg-feiyu-primary-hover disabled:opacity-50"
              >
                创建 ({selectedMembers.length} 人)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
