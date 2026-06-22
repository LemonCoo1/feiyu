import { create } from "zustand";
import { api } from "../services/api";
import { wsClient } from "../services/ws";
import * as cacheService from "../services/cacheService";

interface Channel {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  member_count: number;
}

interface ChannelMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content_type: string;
  content: any;
  parent_message_id: string | null;
  created_at: string;
}

interface ChannelState {
  channels: Channel[];
  messages: Map<string, ChannelMessage[]>;
  activeChannelId: string | null;

  loadChannels: () => Promise<void>;
  loadMessages: (channelId: string) => Promise<void>;
  setActiveChannel: (id: string | null) => void;
  sendMessage: (channelId: string, content: string) => void;
  addIncomingMessage: (message: ChannelMessage) => void;
  createChannel: (name: string, description?: string) => Promise<void>;
}

export const useChannelStore = create<ChannelState>((set, get) => ({
  channels: [],
  messages: new Map(),
  activeChannelId: null,

  loadChannels: async () => {
    // 1. 先读本地缓存
    try {
      const cached = await cacheService.getCachedChannels();
      if (cached.length > 0) {
        set({ channels: cached });
      }
    } catch (e) {
      console.error("频道缓存读取失败:", e);
    }
    // 2. 从服务器拉取最新
    try {
      const channels = await api.getChannels();
      set({ channels });
      // 3. 写入缓存
      await cacheService.cacheChannels(channels);
    } catch (e) {
      console.error("Failed to load channels:", e);
    }
  },

  loadMessages: async (channelId) => {
    try {
      const msgs = await api.getChannelMessages(channelId);
      set((state) => {
        const newMessages = new Map(state.messages);
        newMessages.set(channelId, msgs.reverse());
        return { messages: newMessages };
      });
    } catch (e) {
      console.error("Failed to load channel messages:", e);
    }
  },

  setActiveChannel: (id) => {
    set({ activeChannelId: id });
    if (id) get().loadMessages(id);
  },

  sendMessage: (channelId, content) => {
    wsClient.send({
      type: "channel.message.send",
      payload: {
        channel_id: channelId,
        content_type: "text",
        content: { text: content },
        parent_message_id: null,
        client_msg_id: crypto.randomUUID(),
      },
    });
  },

  addIncomingMessage: (message) => {
    set((state) => {
      const newMessages = new Map(state.messages);
      const channelMsgs = newMessages.get(message.channel_id) || [];
      newMessages.set(message.channel_id, [...channelMsgs, message]);
      return { messages: newMessages };
    });
  },

  createChannel: async (name, description) => {
    try {
      await api.createChannel(name, description);
    } catch (e) {
      console.error("Failed to create channel:", e);
    }
  },
}));
