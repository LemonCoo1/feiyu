import { create } from "zustand";
import { api } from "../services/api";
import { wsClient } from "../services/ws";
import { debugLog } from "../utils/debugLog";
import { compressImage } from "../utils/compressImage";
import { useSettingsStore } from "./settingsStore";
import * as cacheService from "../services/cacheService";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content_type: string;
  content: any;
  created_at: string;
}

interface Conversation {
  id: string;
  type: string;
  name: string | null;
  owner_id?: string;
  created_at: string;
  last_message_content?: any;
  last_message_content_type?: string;
  last_message_at?: string;
  other_user_id?: string;
  other_username?: string;
  other_display_name?: string;
  unread_count?: number;
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

const loadPinned = (): Set<string> => {
  try {
    const stored = localStorage.getItem("pinnedConversations");
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch {
    return new Set();
  }
};

const savePinned = (pinned: Set<string>) => {
  localStorage.setItem("pinnedConversations", JSON.stringify([...pinned]));
};

interface ChatState {
  conversations: Conversation[];
  messages: Map<string, Message[]>;
  conversationMembers: Map<string, Member[]>;
  activeConversationId: string | null;
  typingUsers: Map<string, Set<string>>;
  searchResults: Message[];
  isSearching: boolean;
  isLoadingConvs: boolean;
  isLoadingMsgs: boolean;
  pinnedConversations: Set<string>;
  lastReadMessageIds: Map<string, string>; // conversationId -> last read message id

  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  loadMembers: (conversationId: string) => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  sendMessage: (conversationId: string, content: string) => void;
  sendFile: (conversationId: string, file: File) => Promise<void>;
  sendSticker: (conversationId: string, sticker: { url: string; name: string }) => void;
  sendGif: (conversationId: string, gif: { url: string; name: string }) => void;
  addIncomingMessage: (message: Message) => void;
  updateLastRead: (conversationId: string, messageId: string) => void;
  createGroup: (name: string, memberIds: string[]) => Promise<void>;
  searchMessages: (query: string) => Promise<void>;
  clearSearch: () => void;
  togglePin: (conversationId: string) => void;
  updateConversation: (conversationId: string, data: { name?: string }) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: new Map(),
  conversationMembers: new Map(),
  activeConversationId: null,
  typingUsers: new Map(),
  searchResults: [],
  isSearching: false,
  isLoadingConvs: false,
  isLoadingMsgs: false,
  pinnedConversations: loadPinned(),
  lastReadMessageIds: new Map(),

  loadConversations: async () => {
    set({ isLoadingConvs: true });
    try {
      // 1. 先读本地缓存，立即展示
      console.log("[loadConversations] 读取本地缓存...");
      const cached = await cacheService.getCachedConversations();
      console.log("[loadConversations] 缓存返回:", cached.length, "条");
      if (cached.length > 0) {
        set({ conversations: cached, isLoadingConvs: false });
      }
      // 2. 从服务器拉取最新数据
      console.log("[loadConversations] 从服务器拉取...");
      const convs = await api.getConversations();
      console.log("[loadConversations] 服务器返回:", convs.length, "条");
      set({ conversations: convs, isLoadingConvs: false });
      // 3. 写入缓存
      await cacheService.cacheConversations(convs);
    } catch (e) {
      console.error("[loadConversations] 失败:", e);
      // 网络失败，已有缓存数据则静默降级
      if (get().conversations.length === 0) {
        set({ isLoadingConvs: false });
      }
    }
  },

  loadMessages: async (conversationId) => {
    set({ isLoadingMsgs: true });
    try {
      // 1. 先从本地缓存读取，立即展示
      const localMsgs = await cacheService.getLocalMessages(conversationId);
      if (localMsgs.length > 0) {
        set((state) => {
          const newMessages = new Map(state.messages);
          newMessages.set(conversationId, localMsgs);
          return { messages: newMessages, isLoadingMsgs: false };
        });
      }

      // 2. 增量同步：拉取 since 之后的新消息
      const newMsgs = await cacheService.syncNewMessages(conversationId);

      // 3. 合并更新
      if (newMsgs.length > 0) {
        set((state) => {
          const newMessages = new Map(state.messages);
          const existing = newMessages.get(conversationId) || localMsgs;
          const existingIds = new Set(existing.map((m) => m.id));
          const merged = [...existing, ...newMsgs.filter((m) => !existingIds.has(m.id))];
          merged.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
          newMessages.set(conversationId, merged);
          return { messages: newMessages, isLoadingMsgs: false };
        });
      } else if (localMsgs.length === 0) {
        // 本地无数据且增量无新数据 → 全量拉取
        const msgs = await api.getMessages(conversationId);
        const reversed = msgs.reverse();
        for (const msg of reversed) {
          await cacheService.cacheMessage(msg);
        }
        set((state) => {
          const newMessages = new Map(state.messages);
          newMessages.set(conversationId, reversed);
          return { messages: newMessages, isLoadingMsgs: false };
        });
      }

      // 标记已读
      const state = get();
      const msgs = state.messages.get(conversationId) || [];
      if (msgs.length > 0) {
        wsClient.sendRead(conversationId, msgs[msgs.length - 1].id);
      }
    } catch (e) {
      console.error("Failed to load messages:", e);
      set({ isLoadingMsgs: false });
    }
  },

  loadMembers: async (conversationId) => {
    try {
      const members = await api.getConversationMembers(conversationId);
      set((state) => {
        const newMembers = new Map(state.conversationMembers);
        newMembers.set(conversationId, members);
        return { conversationMembers: newMembers };
      });
    } catch (e) {
      console.error("Failed to load members:", e);
    }
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
    if (id) {
      get().loadMessages(id);
      get().loadMembers(id);
      // 清除未读数
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, unread_count: 0 } : c
        ),
      }));
    }
  },

  sendMessage: (conversationId, content) => {
    wsClient.sendMessage(conversationId, "text", { text: content });
  },

  sendFile: async (conversationId, file) => {
    debugLog(`[sendFile] 调用: name=${file.name}, type=${file.type}, size=${file.size}, conv=${conversationId}`);
    try {
      // 图片文件先压缩再上传
      let uploadFile = file;
      if (file.type.startsWith("image/") && file.type !== "image/gif" && file.type !== "image/svg+xml") {
        debugLog(`[sendFile] 图片压缩中...`);
        const originalSize = file.size;
        uploadFile = await compressImage(file);
        if (uploadFile !== file) {
          debugLog(`[sendFile] 压缩完成: ${originalSize} → ${uploadFile.size} (${((1 - uploadFile.size / originalSize) * 100).toFixed(0)}% 减少)`);
        }
      }

      debugLog(`[sendFile] 开始上传 ${uploadFile.name}...`);
      const result = await api.uploadFile(uploadFile);
      debugLog(`[sendFile] 上传返回: url=${result.url}, filename=${result.filename}`);
      const url = result.url;

      // 用原始文件判断类型（压缩后可能变成 webp）
      let isGif = file.type === "image/gif" || /\.gif$/i.test(file.name);
      if (!isGif && file.size >= 6) {
        const head = await file.slice(0, 6).text();
        isGif = head === "GIF87a" || head === "GIF89a";
        debugLog(`[sendFile] magic bytes: "${head}" → isGif=${isGif}`);
      }

      const isImage = !isGif && (file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|svg|bmp)$/i.test(file.name));
      debugLog(`[sendFile] 判定: isGif=${isGif}, isImage=${isImage}, final=${isGif ? "gif" : isImage ? "image" : "file"}`);

      if (isGif) {
        debugLog(`[sendFile] >>> 发送 WS gif 消息`);
        wsClient.sendMessage(conversationId, "gif", { url, filename: file.name, name: file.name });
        debugLog(`[sendFile] <<< WS gif 消息已发送`);
      } else if (isImage) {
        wsClient.sendMessage(conversationId, "image", { url, filename: file.name, type: "image" });
      } else {
        wsClient.sendMessage(conversationId, "file", { url, filename: file.name, type: "file" });
      }
    } catch (e) {
      debugLog(`[sendFile] !!! 异常: ${e}`, "error");
    }
  },

  sendSticker: (conversationId, sticker) => {
    wsClient.sendMessage(conversationId, "sticker", sticker);
  },

  sendGif: (conversationId, gif) => {
    wsClient.sendMessage(conversationId, "gif", gif);
  },

  addIncomingMessage: (message) => {
    // 写入本地缓存
    cacheService.cacheMessage(message).catch((e) =>
      console.error("Failed to cache incoming message:", e)
    );

    console.log("[chatStore] addIncomingMessage", { id: message.id, content_type: message.content_type, content: message.content, conversation_id: message.conversation_id });
    set((state) => {
      const newMessages = new Map(state.messages);
      const convMsgs = newMessages.get(message.conversation_id) || [];
      newMessages.set(message.conversation_id, [...convMsgs, message]);

      const isActive = state.activeConversationId === message.conversation_id;
      const convs = state.conversations.map((c) => {
        if (c.id !== message.conversation_id) return c;
        return {
          ...c,
          last_message_content: message.content,
          last_message_content_type: message.content_type,
          last_message_at: message.created_at,
          // 非活跃会话增加未读数，活跃会话保持0
          unread_count: isActive ? 0 : (c.unread_count || 0) + 1,
        };
      });

      return { messages: newMessages, conversations: convs };
    });

    // 同步更新会话缓存中的最后消息
    cacheService.updateConversationLastMessage(
      message.conversation_id,
      message.content,
      message.content_type,
      message.created_at
    ).catch(e => console.error("Failed to update conversation cache:", e));

    // 如果是当前活跃会话且开启了已读回执，自动发送已读回执
    const state = get();
    if (state.activeConversationId === message.conversation_id) {
      const readReceipt = useSettingsStore.getState().settings.privacy_read_receipt;
      if (readReceipt) {
        wsClient.sendRead(message.conversation_id, message.id);
      }
    }
  },

  createGroup: async (name, memberIds) => {
    try {
      const conv = await api.createGroupConversation(name, memberIds);
      await get().loadConversations();
      get().setActiveConversation(conv.id);
    } catch (e) {
      console.error("Failed to create group:", e);
    }
  },

  searchMessages: async (query) => {
    if (!query.trim()) {
      set({ searchResults: [], isSearching: false });
      return;
    }
    set({ isSearching: true });
    try {
      const results = await api.searchMessages(query);
      set({ searchResults: results, isSearching: false });
    } catch (e) {
      console.error("Search failed:", e);
      set({ isSearching: false });
    }
  },

  clearSearch: () => set({ searchResults: [], isSearching: false }),

  updateLastRead: (conversationId, messageId) => {
    set((state) => {
      const newMap = new Map(state.lastReadMessageIds);
      newMap.set(conversationId, messageId);
      return { lastReadMessageIds: newMap };
    });
  },

  togglePin: (conversationId) => {
    set((state) => {
      const newPinned = new Set(state.pinnedConversations);
      if (newPinned.has(conversationId)) {
        newPinned.delete(conversationId);
      } else {
        newPinned.add(conversationId);
      }
      savePinned(newPinned);
      return { pinnedConversations: newPinned };
    });
  },

  updateConversation: (conversationId, data) => {
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, ...data } : c
      ),
    }));
  },
}));
