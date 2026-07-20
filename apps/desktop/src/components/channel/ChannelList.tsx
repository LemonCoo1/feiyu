import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useChannelStore } from "../../stores/channelStore";

export function ChannelList() {
  const { t } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const channels = useChannelStore((s) => s.channels);
  const activeId = useChannelStore((s) => s.activeChannelId);
  const setActive = useChannelStore((s) => s.setActiveChannel);
  const createChannel = useChannelStore((s) => s.createChannel);
  const loadChannels = useChannelStore((s) => s.loadChannels);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createChannel(newName, newDesc || undefined);
    setNewName("");
    setNewDesc("");
    setShowCreate(false);
    loadChannels();
  };

  return (
    <div className="w-full h-full bg-feiyu-surface-container border-r border-feiyu-border flex flex-col">
      <div className="px-4 py-3 border-b border-feiyu-border flex justify-between items-center">
        <h2 className="font-medium text-feiyu-text">{t("channel.title")}</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="text-feiyu-primary text-sm hover:underline"
        >
          {t("channel.create")}
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-feiyu-text-muted text-sm">
            <span>{t("channel.noChannels")}</span>
          </div>
        ) : (
          channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActive(ch.id)}
              className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors text-left ${
                activeId === ch.id
                  ? "bg-feiyu-primary-light border-l-2 border-feiyu-primary"
                  : "hover:bg-feiyu-surface-container-high border-l-2 border-transparent"
              }`}
            >
              <div className="w-10 h-10 rounded-feiyu-lg bg-feiyu-info text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                #
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-feiyu-text truncate">{ch.name}</div>
                <div className="text-xs text-feiyu-text-muted">{ch.member_count} {t("channel.members")}</div>
              </div>
            </button>
          ))
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-feiyu-overlay flex items-center justify-center z-50">
          <div className="bg-feiyu-surface rounded-feiyu-xl shadow-feiyu-5 w-[360px] p-6">
            <h3 className="font-semibold text-feiyu-text mb-4">{t("channel.createChannel")}</h3>
            <input
              type="text"
              placeholder={t("channel.channelName")}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-feiyu-border rounded-feiyu-md px-3 py-2 text-sm mb-3 focus:outline-none focus:border-feiyu-primary focus:ring-2 focus:ring-feiyu-primary/15"
              autoFocus
            />
            <textarea
              placeholder={t("channel.channelDesc")}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full border border-feiyu-border rounded-feiyu-md px-3 py-2 text-sm mb-4 resize-none focus:outline-none focus:border-feiyu-primary focus:ring-2 focus:ring-feiyu-primary/15"
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-feiyu-text-muted hover:text-feiyu-text"
              >
                {t("channel.cancel")}
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-4 py-2 text-sm bg-feiyu-primary text-white rounded-feiyu-md hover:bg-feiyu-primary-hover disabled:opacity-50"
              >
                {t("channel.createBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
