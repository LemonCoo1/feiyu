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
  isSearching: boolean;
  isAdding: boolean;
  addError: string | null;

  loadContacts: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  addContact: (contactId: string) => Promise<void>;
  removeContact: (contactId: string) => Promise<void>;
  clearSearch: () => void;
  updatePresence: (userId: string, status: string) => void;
}

// 搜索请求序号，用于丢弃过期响应，防止快速输入时旧响应覆盖新响应
let searchSeq = 0;

export const useContactStore = create<ContactState>((set, get) => {
  // 统一"拉取最新联系人 + 更新状态 + 写回缓存"，保证本地缓存与服务端一致
  const refreshContacts = async () => {
    const contacts = await api.getContacts();
    set({ contacts });
    await cacheService.cacheContacts(contacts);
  };

  return {
    contacts: [],
    searchResults: [],
    isLoading: false,
    isSearching: false,
    isAdding: false,
    addError: null,

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
      // 2. 从服务器拉取最新并写缓存
      try {
        await refreshContacts();
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
        set({ searchResults: [], isSearching: false });
        return;
      }
      const seq = ++searchSeq;
      set({ isSearching: true });
      try {
        const results = await api.searchUsers(query);
        // 仅接受最新一次请求的结果，丢弃过期响应
        if (seq !== searchSeq) return;
        set({ searchResults: results, isSearching: false });
      } catch (e) {
        if (seq !== searchSeq) return;
        console.error("Search failed:", e);
        set({ isSearching: false });
      }
    },

    addContact: async (contactId) => {
      set({ isAdding: true, addError: null });
      try {
        await api.addContact(contactId);
        // 拉取最新列表并写回缓存，保证本地缓存与服务端一致
        await refreshContacts();
        // 不清空 searchResults：保留结果，靠 contactIds.has 自动将按钮切换为"已添加"
      } catch (e) {
        const msg = e instanceof Error ? e.message : "添加失败";
        set({ addError: msg });
        throw e;
      } finally {
        set({ isAdding: false });
      }
    },

    removeContact: async (contactId) => {
      try {
        await api.removeContact(contactId);
        await refreshContacts();
      } catch (e) {
        console.error("Remove contact failed:", e);
        throw e;
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
  };
});
