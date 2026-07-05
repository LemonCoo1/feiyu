import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { api } from "../../services/api";
import { getServerUrl } from "../../services/serverConfig";
import { useChatStore } from "../../stores/chatStore";
import { useAuthStore } from "../../stores/authStore";

interface GroupInfoPanelProps {
  conversationId: string;
  conversationName: string;
  ownerId?: string;
  onClose: () => void;
}

interface Member {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  role: string;
  joined_at: string;
}

const roleLabels: Record<string, string> = {
  owner: "groupInfo.owner",
  admin: "groupInfo.admin",
};

export function GroupInfoPanel({ conversationId, conversationName, ownerId: _ownerId, onClose }: GroupInfoPanelProps) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [editName, setEditName] = useState(false);
  const [newName, setNewName] = useState(conversationName);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const updateConversation = useChatStore((s) => s.updateConversation);
  const currentUser = useAuthStore((s) => s.user);

  const myMember = members.find((m) => m.user_id === currentUser?.id);
  const myRole = myMember?.role || "member";
  const isOwner = myRole === "owner";
  const isAdmin = myRole === "admin" || isOwner;

  const [announcements, setAnnouncements] = useState<any[]>([]);
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [annContent, setAnnContent] = useState("");

  useEffect(() => {
    loadMembers();
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    const token = localStorage.getItem("token");
    fetch(`${getServerUrl()}/api/conversations/${conversationId}/announcements`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then(setAnnouncements)
      .catch(() => {});
  }, [conversationId]);

  const loadMembers = async () => {
    try {
      const data = await api.getConversationMembers(conversationId);
      setMembers(data);
    } catch (e) {
      console.error("Failed to load members:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRename = async () => {
    if (!newName.trim() || newName === conversationName) {
      setEditName(false);
      return;
    }
    try {
      await api.updateConversation(conversationId, { name: newName });
      updateConversation(conversationId, { name: newName });
      setEditName(false);
    } catch (e) {
      console.error("Failed to rename:", e);
    }
  };

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    try {
      const results = await api.searchUsers(query);
      const memberIds = new Set(members.map((m) => m.user_id));
      setSearchResults(results.filter((u: any) => !memberIds.has(u.id)));
    } catch (e) {
      console.error("Search failed:", e);
    }
  };

  const handleAddMember = async (userId: string) => {
    try {
      await api.addConversationMember(conversationId, userId);
      await loadMembers();
      setShowAddMember(false);
      setSearchQuery("");
      setSearchResults([]);
    } catch (e) {
      console.error("Failed to add member:", e);
    }
  };

  const handleRemoveMember = async (userId: string, displayName: string) => {
    if (!confirm(t("groupInfo.confirmRemove", { name: displayName }))) return;
    try {
      await api.removeConversationMember(conversationId, userId);
      await loadMembers();
    } catch (e) {
      console.error("Failed to remove member:", e);
    }
  };

  const handleAssignAdmin = async (userId: string) => {
    try {
      await api.assignAdmin(conversationId, userId);
      await loadMembers();
    } catch (e) {
      console.error("Failed to assign admin:", e);
    }
  };

  const handleLeave = async () => {
    if (!confirm(t("groupInfo.confirmLeave"))) return;
    try {
      await api.removeConversationMember(conversationId, currentUser!.id);
      onClose();
    } catch (e) {
      console.error("Failed to leave:", e);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!annContent.trim()) return;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${getServerUrl()}/api/conversations/${conversationId}/announcements`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content: annContent }),
      });
      if (res.ok) {
        const ann = await res.json();
        setAnnouncements((prev) => [ann, ...prev]);
        setAnnContent("");
        setShowAnnForm(false);
      }
    } catch (e) {
      console.error("Failed to create announcement:", e);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    try {
      const token = localStorage.getItem("token");
      await fetch(`${getServerUrl()}/api/announcements/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnnouncements((prev) => prev.filter((a) => a.id !== id));
    } catch (e) {
      console.error("Failed to delete announcement:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-feiyu-overlay-light" onClick={onClose} />
      <div className="relative w-[320px] bg-feiyu-surface shadow-feiyu-5 flex flex-col">
        {/* Header */}
        <div className="px-4 py-3 border-b border-feiyu-border flex items-center justify-between">
          <h3 className="font-semibold text-feiyu-text">{t("groupInfo.title")}</h3>
          <button onClick={onClose} className="text-feiyu-text-muted hover:text-feiyu-text text-lg">
            ✕
          </button>
        </div>

        {/* Group name */}
        <div className="px-4 py-3 border-b border-feiyu-border">
          <div className="text-xs text-feiyu-text-muted mb-1">{t("groupInfo.groupName")}</div>
          {editName ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 border border-feiyu-border rounded-feiyu-sm px-2 py-1 text-sm focus:outline-none focus:border-feiyu-primary"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
              />
              <button onClick={handleRename} className="text-xs text-feiyu-primary">{t("groupInfo.save")}</button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-sm text-feiyu-text">{conversationName}</span>
              {isAdmin && (
                <button onClick={() => setEditName(true)} className="text-xs text-feiyu-primary">{t("groupInfo.edit")}</button>
              )}
            </div>
          )}
        </div>

        {/* Add member button */}
        {isAdmin && (
          <div className="px-4 py-2 border-b border-feiyu-border">
            {showAddMember ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchUsers(e.target.value)}
                  placeholder={t("groupInfo.searchUsername")}
                  className="w-full border border-feiyu-border rounded-feiyu-sm px-2 py-1.5 text-sm focus:outline-none focus:border-feiyu-primary"
                  autoFocus
                />
                {searchResults.length > 0 && (
                  <div className="max-h-[200px] overflow-y-auto border border-feiyu-border rounded-feiyu-md">
                    {searchResults.map((u: any) => (
                      <button
                        key={u.id}
                        onClick={() => handleAddMember(u.id)}
                        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-feiyu-surface-container-high text-left"
                      >
                        <Avatar name={u.display_name || u.username} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-feiyu-text truncate">{u.display_name || u.username}</div>
                          <div className="text-xs text-feiyu-text-muted truncate">@{u.username}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <button onClick={() => { setShowAddMember(false); setSearchQuery(""); setSearchResults([]); }} className="text-xs text-feiyu-text-muted">{t("groupInfo.cancel")}</button>
              </div>
            ) : (
              <button
                onClick={() => setShowAddMember(true)}
                className="w-full text-sm text-feiyu-primary hover:bg-feiyu-surface-container-high py-1.5 rounded-feiyu-md transition-colors"
              >
                {t("groupInfo.addMember")}
              </button>
            )}
          </div>
        )}

        {/* Members list */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-4 py-2 text-xs text-feiyu-text-muted border-b border-feiyu-border">
            {t("groupInfo.memberCount", { count: members.length })}
          </div>
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-feiyu-text-muted">{t("groupInfo.loading")}</div>
          ) : (
            members.map((m) => (
              <div key={m.user_id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-feiyu-surface-container-high group">
                <Avatar name={m.display_name || m.username} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm text-feiyu-text truncate">
                      {m.display_name || m.username}
                    </span>
                    {m.role !== "member" && (
                      <span className={`text-eyebrow px-1.5 py-0.5 rounded-feiyu-sm ${
                        m.role === "owner"
                          ? "bg-feiyu-warning/15 text-feiyu-warning"
                          : "bg-feiyu-info/15 text-feiyu-info"
                      }`}>
                        {t(roleLabels[m.role]) || m.role}
                      </span>
                    )}
                  </div>
                  {m.display_name && (
                    <div className="text-xs text-feiyu-text-muted truncate">@{m.username}</div>
                  )}
                </div>
                {/* Action buttons */}
                {m.user_id !== currentUser?.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {isOwner && m.role === "member" && (
                      <button
                        onClick={() => handleAssignAdmin(m.user_id)}
                        className="text-eyebrow px-1.5 py-0.5 rounded-feiyu-sm bg-feiyu-info/10 text-feiyu-info hover:bg-feiyu-info/20"
                        title={t("groupInfo.setAdmin")}
                      >
                        {t("groupInfo.setAdmin")}
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => handleRemoveMember(m.user_id, m.display_name || m.username)}
                        className="text-eyebrow px-1.5 py-0.5 rounded-feiyu-sm bg-feiyu-danger/10 text-feiyu-danger hover:bg-feiyu-danger/20"
                        title={t("groupInfo.remove")}
                      >
                        {t("groupInfo.remove")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* 群公告 */}
        <div className="border-t border-feiyu-border px-4 py-3">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs font-medium text-feiyu-text-muted">{t("groupInfo.announcements")}</h4>
            {isAdmin && (
              <button
                onClick={() => setShowAnnForm(!showAnnForm)}
                className="text-xs text-feiyu-primary hover:underline"
              >
                {t("groupInfo.addAnnouncement")}
              </button>
            )}
          </div>
          {showAnnForm && (
            <div className="mb-2 space-y-2">
              <textarea
                value={annContent}
                onChange={(e) => setAnnContent(e.target.value)}
                placeholder={t("groupInfo.announcementPlaceholder")}
                className="w-full border border-feiyu-border rounded-feiyu-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-feiyu-primary focus:ring-2 focus:ring-feiyu-primary/15"
                rows={3}
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAnnForm(false)} className="text-xs px-3 py-1 border border-feiyu-border rounded-feiyu-sm">{t("groupInfo.cancel")}</button>
                <button onClick={handleCreateAnnouncement} className="text-xs px-3 py-1 bg-feiyu-primary text-white rounded-feiyu-sm">{t("groupInfo.publish")}</button>
              </div>
            </div>
          )}
          {announcements.length === 0 ? (
            <p className="text-xs text-feiyu-text-muted">{t("groupInfo.noAnnouncements")}</p>
          ) : (
            <div className="space-y-2">
              {announcements.map((ann) => (
                <div key={ann.id} className="bg-feiyu-surface-dim rounded-feiyu-lg p-2.5">
                  <p className="text-sm text-feiyu-text">{ann.content}</p>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-feiyu-text-muted">{new Date(ann.created_at).toLocaleString()}</span>
                    {isAdmin && (
                      <button onClick={() => handleDeleteAnnouncement(ann.id)} className="text-xs text-feiyu-danger hover:text-feiyu-danger">{t("groupInfo.deleteAnnouncement")}</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Leave button */}
        {!isOwner && (
          <div className="px-4 py-3 border-t border-feiyu-border">
            <button
              onClick={handleLeave}
              className="w-full text-sm text-feiyu-danger hover:text-feiyu-danger hover:bg-feiyu-surface-container-high py-2 rounded-feiyu-md transition-colors"
            >
              {t("groupInfo.leaveGroup")}
            </button>
          </div>
        )}
        {isOwner && (
          <div className="px-4 py-3 border-t border-feiyu-border">
            <p className="text-xs text-feiyu-text-muted text-center">{t("groupInfo.ownerLeaveHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
