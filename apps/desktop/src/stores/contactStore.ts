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

  loadContacts: () => Promise<void>;
  searchUsers: (query: string) => Promise<void>;
  addContact: (contactId: string) => Promise<void>;
  clearSearch: () => void;
  updatePresence: (userId: string, status: string) => void;
}

export const useContactStore = create<ContactState>((set) => ({
  contacts: [],
  searchResults: [],
  isLoading: false,

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
