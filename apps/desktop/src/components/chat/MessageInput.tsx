import { useState, useRef, KeyboardEvent } from "react";
import { useChatStore } from "../../stores/chatStore";

export function MessageInput() {
  const [text, setText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeId = useChatStore((s) => s.activeConversationId);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const sendFile = useChatStore((s) => s.sendFile);

  const handleSend = () => {
    if (!text.trim() || !activeId) return;
    sendMessage(activeId, text.trim());
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeId) return;
    await sendFile(activeId, file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  if (!activeId) return null;

  return (
    <div className="border-t border-feiyu-border px-5 py-3">
      <div className="flex items-center gap-2 mb-2 text-feiyu-text-muted">
        <button className="hover:text-feiyu-text transition-colors text-lg" title="表情">😊</button>
        <button
          className="hover:text-feiyu-text transition-colors text-lg"
          title="附件"
          onClick={() => fileInputRef.current?.click()}
        >
          📎
        </button>
        <button
          className="hover:text-feiyu-text transition-colors text-lg"
          title="图片"
          onClick={() => fileInputRef.current?.click()}
        >
          📷
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"
        />
      </div>
      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入消息..."
          rows={1}
          className="flex-1 bg-gray-50 border border-feiyu-border rounded-lg px-3 py-2 text-sm text-feiyu-text resize-none focus:outline-none focus:border-feiyu-primary"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim()}
          className="bg-feiyu-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-feiyu-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          发送
        </button>
      </div>
    </div>
  );
}
