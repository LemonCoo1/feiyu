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

  loadConversations: () => Promise<void>;
  loadMessages: (conversationId: string) => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  sendMessage: (conversationId: string, content: string) => void;
  addIncomingMessage: (message: Message) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  messages: new Map(),
  activeConversationId: null,
  typingUsers: new Map(),

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
}));
