import { create } from "zustand";
import { api } from "../services/api";

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
  reset: () => void;
}

let searchSeq = 0;

export const useContactStore = create<ContactState>((set, get) => ({
  contacts: [],
  searchResults: [],
  isLoading: false,
  isSearching: false,
  isAdding: false,
  addError: null,

  loadContacts: async () => {
    set({ isLoading: true });
    try {
      const contacts = await api.getContacts();
      set({ contacts, isLoading: false });
    } catch (e) {
      console.error("Failed to load contacts:", e);
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
      await get().loadContacts();
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
      await get().loadContacts();
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

  reset: () => {
    set({ contacts: [], searchResults: [], isSearching: false, addError: null });
  },
}));
