import { useState, useRef, ClipboardEvent, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Smile, Paperclip, Image, File, Film } from "lucide-react";
import { useChatStore } from "../../stores/chatStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useConnectionStatus } from "../../hooks/useWebSocket";
import { EmojiPicker } from "./EmojiPicker";

export function MessageInput({ height }: { height: number }) {
  const { t } = useTranslation();
  const connectionStatus = useConnectionStatus();
  const isDisconnected = connectionStatus !== 'connected';
  const [text, setText] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeId = useChatStore((s) => s.activeConversationId);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const sendFile = useChatStore((s) => s.sendFile);
  const sendSticker = useChatStore((s) => s.sendSticker);
  const chatSendKey = useSettingsStore((s) => s.settings.chat_send_key);

  const handleEmojiSelect = (emoji: string) => {
    setText((prev) => prev + emoji);
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  const handleStickerSelect = (sticker: { id: string; name: string; src: string }) => {
    if (!activeId) return;
    sendSticker(activeId, { url: sticker.src, name: sticker.name });
    setShowEmoji(false);
  };

  const handleSend = () => {
    if (!activeId) return;
    if (pendingFile) {
      sendFile(activeId, pendingFile);
      setPendingFile(null);
      return;
    }
    if (!text.trim()) return;
    sendMessage(activeId, text.trim());
    setText("");
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (chatSendKey === "ctrl+enter") {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
    } else {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items || !activeId) return;

    for (const item of items) {
      if (item.kind === "file") {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setPendingFile(file);
        }
        return;
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeId) return;
    setPendingFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleCancelFile = () => {
    setPendingFile(null);
  };

  if (!activeId) return null;

  const isGif = pendingFile && (pendingFile.type === "image/gif" || /\.gif$/i.test(pendingFile.name));
  const isImage = !isGif && pendingFile && /\.(jpg|jpeg|png|webp|svg|bmp)$/i.test(pendingFile.name);
  const fileSize = pendingFile
    ? pendingFile.size < 1024
      ? `${pendingFile.size} B`
      : pendingFile.size < 1024 * 1024
        ? `${(pendingFile.size / 1024).toFixed(1)} KB`
        : `${(pendingFile.size / (1024 * 1024)).toFixed(1)} MB`
    : "";

  return (
    <div
      className="border-t border-feiyu-border px-5 py-3 bg-feiyu-surface flex flex-col"
      style={{ height }}
    >
      <div className="flex items-center gap-2 mb-2 text-feiyu-text-muted relative flex-shrink-0">
        <button className="hover:text-feiyu-text transition-colors" title={t("chat.emojiAndSticker")} onClick={() => setShowEmoji(!showEmoji)}>
          <Smile size={20} />
        </button>
        {showEmoji && (
          <EmojiPicker onSelect={handleEmojiSelect} onStickerSelect={handleStickerSelect} onClose={() => setShowEmoji(false)} />
        )}
        <button
          className="hover:text-feiyu-text transition-colors"
          title={t("chat.attachment")}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip size={20} />
        </button>
        <button
          className="hover:text-feiyu-text transition-colors"
          title={t("chat.image")}
          onClick={() => imageInputRef.current?.click()}
        >
          <Image size={20} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt,.7z,.tar,.gz,.csv,.ppt,.pptx,.gif"
        />
        <input
          ref={imageInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
        />
      </div>

      {/* File preview */}
      {pendingFile && (
        <div className="mb-2 flex items-center gap-2 bg-feiyu-surface-dim border border-feiyu-border rounded-feiyu-md px-3 py-2 flex-shrink-0">
          {isGif ? <Film size={18} className="text-feiyu-text-muted" /> : isImage ? <Image size={18} className="text-feiyu-text-muted" /> : <File size={18} className="text-feiyu-text-muted" />}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-feiyu-text truncate">{pendingFile.name}</div>
            <div className="text-xs text-feiyu-text-muted">{fileSize}</div>
          </div>
          <button
            onClick={handleCancelFile}
            className="text-feiyu-text-muted hover:text-feiyu-text text-sm ml-2"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex gap-2 items-stretch flex-1 min-h-0">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={isDisconnected ? t("connection.waiting") : t("chat.inputPlaceholder")}
          disabled={isDisconnected}
          rows={1}
          className="flex-1 bg-feiyu-surface-dim border border-feiyu-border rounded-feiyu-lg px-3 py-2.5 text-sm text-feiyu-text resize-none focus:outline-none focus:border-feiyu-primary focus:ring-2 focus:ring-feiyu-primary/15 overflow-y-auto placeholder:text-feiyu-text-muted scrollbar-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSend}
          disabled={isDisconnected || (!text.trim() && !pendingFile)}
          className="bg-feiyu-primary text-white rounded-feiyu-md px-4 py-2 text-sm font-medium hover:bg-feiyu-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          {t("chat.send")}
        </button>
      </div>
      <div className="mt-1 text-caption text-feiyu-text-muted select-none flex-shrink-0">
        {chatSendKey === "ctrl+enter"
          ? t("chat.hintCtrlEnter")
          : t("chat.hintEnter")
        }
      </div>
    </div>
  );
}
