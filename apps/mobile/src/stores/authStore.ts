import { create } from "zustand";
import { api } from "../services/api";
import { wsClient } from "../services/ws";
import { useChatStore } from "./chatStore";
import { useContactStore } from "./contactStore";
import { useChannelStore } from "./channelStore";

interface User {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, displayName?: string) => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  logout: () => void;
  loadFromStorage: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.login({ email, password });
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      wsClient.connect(res.token);
      set({ user: res.user, token: res.token, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  register: async (username, email, password, displayName) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.register({ username, email, password, display_name: displayName });
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      wsClient.connect(res.token);
      set({ user: res.user, token: res.token, isLoading: false });
    } catch (e: any) {
      set({ error: e.message, isLoading: false });
    }
  },

  updateProfile: async (displayName) => {
    try {
      const updated = await api.updateProfile({ display_name: displayName });
      localStorage.setItem("user", JSON.stringify(updated));
      set((state) => ({ user: state.user ? { ...state.user, display_name: updated.display_name } : null }));
    } catch (e: any) {
      set({ error: e.message });
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    wsClient.disconnect();
    useChatStore.getState().reset();
    useContactStore.getState().reset();
    useChannelStore.getState().reset();
    set({ user: null, token: null });
  },

  loadFromStorage: () => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        wsClient.connect(token);
        set({ user, token });
      } catch {}
    }
  },
}));
