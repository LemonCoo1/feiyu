import { create } from "zustand";
import { api } from "../services/api";
import { wsClient } from "../services/ws";
import { useSettingsStore } from "./settingsStore";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content_type: string;
  content: any;
  created_at: string;
  recalled?: boolean;
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
  members?: Array<{
    user_id: string;
    user?: {
      display_name?: string;
      username?: string;
    };
  }>;
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
  lastReadMessageIds: Map<string, string>;
  groupReadReceipts: Map<string, Map<string, string[]>>;

  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  loadMembers: (conversationId: string) => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  sendMessage: (conversationId: string, content: string) => void;
  sendFile: (conversationId: string, file: File) => Promise<void>;
  sendSticker: (conversationId: string, sticker: { url: string; name: string }) => void;
  sendGif: (conversationId: string, gif: { url: string; name: string }) => void;
  addIncomingMessage: (message: Message) => void;
  updateLastRead: (conversationId: string, messageId: string, userId?: string) => void;
  createGroup: (name: string, memberIds: string[]) => Promise<void>;
  searchMessages: (query: string) => Promise<void>;
  clearSearch: () => void;
  togglePin: (conversationId: string) => void;
  updateConversation: (conversationId: string, data: { name?: string }) => void;
  addConversation: (conv: Conversation) => void;
  reset: () => void;
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
  groupReadReceipts: new Map(),

  loadConversations: async () => {
    set({ isLoadingConvs: true });
    try {
      const convs = await api.getConversations();
      set({ conversations: convs, isLoadingConvs: false });
    } catch (e) {
      console.error("Failed to load conversations:", e);
      set({ isLoadingConvs: false });
    }
  },

  loadMessages: async (conversationId) => {
    set({ isLoadingMsgs: true });
    try {
      const msgs = await api.getMessages(conversationId);
      const reversed = msgs.reverse();
      set((state) => {
        const newMessages = new Map(state.messages);
        newMessages.set(conversationId, reversed);
        return { messages: newMessages, isLoadingMsgs: false };
      });
      if (reversed.length > 0) {
        wsClient.sendRead(conversationId, reversed[reversed.length - 1].id);
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
    try {
      let uploadFile = file;
      if (file.type.startsWith("image/") && file.type !== "image/gif" && file.type !== "image/svg+xml") {
        const { compressImage } = await import("../utils/compressImage");
        uploadFile = await compressImage(file);
      }

      const result = await api.uploadFile(uploadFile);
      const url = result.url;

      let isGif = file.type === "image/gif" || /\.gif$/i.test(file.name);
      if (!isGif && file.size >= 6) {
        const head = await file.slice(0, 6).text();
        isGif = head === "GIF87a" || head === "GIF89a";
      }

      const isImage = !isGif && (file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|svg|bmp)$/i.test(file.name));

      if (isGif) {
        wsClient.sendMessage(conversationId, "gif", { url, filename: file.name, name: file.name });
      } else if (isImage) {
        wsClient.sendMessage(conversationId, "image", { url, filename: file.name, type: "image" });
      } else {
        wsClient.sendMessage(conversationId, "file", { url, filename: file.name, type: "file" });
      }
    } catch (e) {
      console.error("Failed to send file:", e);
    }
  },

  sendSticker: (conversationId, sticker) => {
    wsClient.sendMessage(conversationId, "sticker", sticker);
  },

  sendGif: (conversationId, gif) => {
    wsClient.sendMessage(conversationId, "gif", gif);
  },

  addIncomingMessage: (message) => {
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
          unread_count: isActive ? 0 : (c.unread_count || 0) + 1,
        };
      });

      return { messages: newMessages, conversations: convs };
    });

    const state = get();
    if (state.activeConversationId === message.conversation_id) {
      const settings = useSettingsStore.getState().settings;
      if (settings.privacy_read_receipt) {
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

  addConversation: (conv) => {
    set((state) => ({
      conversations: [conv, ...state.conversations],
    }));
  },

  reset: () => {
    set({
      conversations: [],
      messages: new Map(),
      conversationMembers: new Map(),
      activeConversationId: null,
      typingUsers: new Map(),
      searchResults: [],
      isSearching: false,
      isLoadingConvs: false,
      isLoadingMsgs: false,
      pinnedConversations: new Set(),
      lastReadMessageIds: new Map(),
      groupReadReceipts: new Map(),
    });
  },
}));
