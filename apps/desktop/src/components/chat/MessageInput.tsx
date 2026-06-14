import { useState, useRef, useCallback, useEffect, ClipboardEvent, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../../stores/chatStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { EmojiPicker } from "./EmojiPicker";

export function MessageInput() {
  const { t } = useTranslation();
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

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [text, adjustHeight]);

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
      // Enter 换行（默认行为）
    } else {
      // enter 模式
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
  const fileIcon = pendingFile
    ? isGif ? "🎞️" : isImage ? "🖼️" : "📄"
    : null;
  const fileSize = pendingFile
    ? pendingFile.size < 1024
      ? `${pendingFile.size} B`
      : pendingFile.size < 1024 * 1024
        ? `${(pendingFile.size / 1024).toFixed(1)} KB`
        : `${(pendingFile.size / (1024 * 1024)).toFixed(1)} MB`
    : "";

  return (
    <div className="border-t border-feiyu-border px-5 py-3 bg-feiyu-card">
      <div className="flex items-center gap-2 mb-2 text-feiyu-text-muted relative">
        <button className="hover:text-feiyu-text transition-colors text-lg" title={t("chat.emojiAndSticker")} onClick={() => setShowEmoji(!showEmoji)}>😊</button>
        {showEmoji && (
          <EmojiPicker onSelect={handleEmojiSelect} onStickerSelect={handleStickerSelect} onClose={() => setShowEmoji(false)} />
        )}
        <button
          className="hover:text-feiyu-text transition-colors text-lg"
          title={t("chat.attachment")}
          onClick={() => fileInputRef.current?.click()}
        >
          📎
        </button>
        <button
          className="hover:text-feiyu-text transition-colors text-lg"
          title={t("chat.image")}
          onClick={() => imageInputRef.current?.click()}
        >
          📷
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
        <div className="mb-2 flex items-center gap-2 bg-gray-50 border border-feiyu-border rounded-lg px-3 py-2">
          <span className="text-lg">{fileIcon}</span>
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

      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={t("chat.inputPlaceholder")}
          rows={1}
          className="flex-1 bg-gray-50 border border-feiyu-border rounded-xl px-3 py-2.5 text-sm text-feiyu-text resize-none focus:outline-none focus:border-feiyu-primary focus:ring-1 focus:ring-feiyu-primary/20 overflow-y-auto placeholder:text-gray-400 scrollbar-none"
          style={{ maxHeight: "200px" }}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() && !pendingFile}
          className="bg-feiyu-primary text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-feiyu-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          {t("chat.send")}
        </button>
      </div>
      <div className="mt-1 text-[11px] text-gray-400 select-none">
        {chatSendKey === "ctrl+enter"
          ? t("chat.hintCtrlEnter")
          : t("chat.hintEnter")
        }
      </div>
    </div>
  );
}
