import { useState } from "react";
import { useChannelStore } from "../../stores/channelStore";

export function ChannelList() {
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
    <div className="w-[280px] bg-white border-r border-feiyu-border flex flex-col">
      <div className="px-4 py-3 border-b border-feiyu-border flex justify-between items-center">
        <h2 className="font-medium text-feiyu-text">频道</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="text-feiyu-primary text-sm hover:underline"
        >
          + 创建
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {channels.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-feiyu-text-muted text-sm">
            <span>暂无频道</span>
          </div>
        ) : (
          channels.map((ch) => (
            <button
              key={ch.id}
              onClick={() => setActive(ch.id)}
              className={`w-full px-4 py-2.5 flex items-center gap-3 transition-colors text-left ${
                activeId === ch.id
                  ? "bg-feiyu-primary/10 border-l-2 border-feiyu-primary"
                  : "hover:bg-gray-50 border-l-2 border-transparent"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-purple-500 text-white flex items-center justify-center font-bold text-sm flex-shrink-0">
                #
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-feiyu-text truncate">{ch.name}</div>
                <div className="text-xs text-feiyu-text-muted">{ch.member_count} 成员</div>
              </div>
            </button>
          ))
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-[360px] p-6">
            <h3 className="font-medium text-feiyu-text mb-4">创建频道</h3>
            <input
              type="text"
              placeholder="频道名称"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full border border-feiyu-border rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-feiyu-primary"
              autoFocus
            />
            <textarea
              placeholder="频道描述（可选）"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="w-full border border-feiyu-border rounded-lg px-3 py-2 text-sm mb-4 resize-none focus:outline-none focus:border-feiyu-primary"
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm text-feiyu-text-muted hover:text-feiyu-text"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newName.trim()}
                className="px-4 py-2 text-sm bg-feiyu-primary text-white rounded-lg hover:bg-feiyu-primary-hover disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
