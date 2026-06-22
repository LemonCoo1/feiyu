import { create } from "zustand";
import { api } from "../services/api";
import * as cacheService from "../services/cacheService";

interface User {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
}

interface ContactState {
  contacts: User[];
  searchResults: User[];
  isLoading: boolean;

  loadContacts: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  addContact: (contactId: string) => Promise<void>;
  clearSearch: () => void;
  updatePresence: (userId: string, status: string) => void;
}

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  searchResults: [],
  isLoading: false,

  loadContacts: async () => {
    set({ isLoading: true });
    // 1. 先读本地缓存
    try {
      const cached = await cacheService.getCachedContacts();
      if (cached.length > 0) {
        set({ contacts: cached });
      }
    } catch (e) {
      console.error("缓存读取失败:", e);
    }
    // 2. 从服务器拉取最新
    try {
      const contacts = await api.getContacts();
      set({ contacts });
      // 3. 写入缓存
      await cacheService.cacheContacts(contacts);
    } catch (e) {
      console.error("Failed to load contacts:", e);
      if (get().contacts.length === 0) {
        set({ contacts: [] });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  searchUsers: async (query) => {
    if (!query.trim()) {
      set({ searchResults: [] });
      return;
    }
    try {
      const results = await api.searchUsers(query);
      set({ searchResults: results });
    } catch (e) {
      console.error("Search failed:", e);
    }
  },

  addContact: async (contactId) => {
    try {
      await api.addContact(contactId);
      const contacts = await api.getContacts();
      set({ contacts, searchResults: [] });
    } catch (e) {
      console.error("Add contact failed:", e);
    }
  },

  clearSearch: () => set({ searchResults: [] }),

  updatePresence: (userId, status) => {
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.id === userId ? { ...c, status } : c
      ),
    }));
  },
}));
