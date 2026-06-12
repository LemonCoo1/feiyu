import { create } from "zustand";
import { api } from "../services/api";
import { wsClient } from "../services/ws";

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
  created_at: string;
  last_message_content?: any;
  last_message_at?: string;
  other_user_id?: string;
  other_username?: string;
  other_display_name?: string;
}

interface ChatState {
  conversations: Conversation[];
  messages: Map<string, Message[]>;
  activeConversationId: string | null;
  typingUsers: Map<string, Set<string>>;
  searchResults: Message[];
  isSearching: boolean;

  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  sendMessage: (conversationId: string, content: string) => void;
  sendFile: (conversationId: string, file: File) => Promise<void>;
  addIncomingMessage: (message: Message) => void;
  createGroup: (name: string, memberIds: string[]) => Promise<void>;
  searchMessages: (query: string) => Promise<void>;
  clearSearch: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: new Map(),
  activeConversationId: null,
  typingUsers: new Map(),
  searchResults: [],
  isSearching: false,

  loadConversations: async () => {
    try {
      const convs = await api.getConversations();
      set({ conversations: convs });
    } catch (e) {
      console.error("Failed to load conversations:", e);
    }
  },

  loadMessages: async (conversationId) => {
    try {
      const msgs = await api.getMessages(conversationId);
      set((state) => {
        const newMessages = new Map(state.messages);
        newMessages.set(conversationId, msgs.reverse());
        return { messages: newMessages };
      });
    } catch (e) {
      console.error("Failed to load messages:", e);
    }
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
    if (id) {
      get().loadMessages(id);
    }
  },

  sendMessage: (conversationId, content) => {
    wsClient.sendMessage(conversationId, "text", { text: content });
  },

  sendFile: async (conversationId, file) => {
    try {
      const result = await api.uploadFile(file);
      const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
      const content = isImage
        ? { url: `${window.location.protocol}//${window.location.hostname}:3000${result.url}`, filename: file.name, type: "image" }
        : { url: `${window.location.protocol}//${window.location.hostname}:3000${result.url}`, filename: file.name, type: "file" };
      wsClient.sendMessage(conversationId, isImage ? "image" : "file", content);
    } catch (e) {
      console.error("Failed to upload file:", e);
    }
  },

  addIncomingMessage: (message) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      const convMsgs = newMessages.get(message.conversation_id) || [];
      newMessages.set(message.conversation_id, [...convMsgs, message]);

      const convs = state.conversations.map((c) =>
        c.id === message.conversation_id
          ? { ...c, last_message_content: message.content, last_message_at: message.created_at }
          : c
      );

      return { messages: newMessages, conversations: convs };
    });
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
}));
