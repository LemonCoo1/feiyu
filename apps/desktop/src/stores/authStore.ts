import { create } from "zustand";
import { api } from "../services/api";
import { wsClient } from "../services/ws";
import { initDbForUser, closeDb } from "../services/db";
import { debugLog } from "../utils/debugLog";
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
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      debugLog("[Auth] 登录中...");
      const res = await api.login({ email, password });
      debugLog(`[Auth] 服务端登录成功, userId=${res.user.id}`);
      // 打开该账号的本地数据库（账号隔离），早于任何缓存读写
      await initDbForUser(res.user.id);
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      wsClient.connect(res.token);
      set({ user: res.user, token: res.token, isLoading: false });
      debugLog("[Auth] 登录完成");
    } catch (e: any) {
      debugLog(`[Auth] 登录失败: ${e.message}`, "error");
      set({ error: e.message, isLoading: false });
    }
  },

  register: async (username, email, password, displayName) => {
    set({ isLoading: true, error: null });
    try {
      debugLog("[Auth] 注册中...");
      const res = await api.register({ username, email, password, display_name: displayName });
      debugLog(`[Auth] 注册成功, userId=${res.user.id}`);
      await initDbForUser(res.user.id);
      localStorage.setItem("token", res.token);
      localStorage.setItem("user", JSON.stringify(res.user));
      wsClient.connect(res.token);
      set({ user: res.user, token: res.token, isLoading: false });
    } catch (e: any) {
      debugLog(`[Auth] 注册失败: ${e.message}`, "error");
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

  logout: async () => {
    const user = get().user;
    debugLog(`[Auth] 登出: userId=${user?.id ?? "unknown"}`);
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    wsClient.disconnect();
    // 重置内存状态（会话/消息/联系人/频道），保留各账号的本地数据库历史
    useChatStore.getState().reset();
    useContactStore.getState().reset();
    useChannelStore.getState().reset();
    set({ user: null, token: null });
    // 关闭当前账号的数据库连接（数据保留在磁盘，仅释放连接池）
    if (user) {
      try {
        await closeDb(user.id);
      } catch (e) {
        debugLog(`[Auth] 关闭数据库失败: ${e}`, "error");
      }
    }
  },

  loadFromStorage: async () => {
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        debugLog(`[Auth] 从 localStorage 恢复会话: userId=${user.id}`);
        await initDbForUser(user.id);
        wsClient.connect(token);
        set({ user, token });
        debugLog("[Auth] 会话恢复成功");
      } catch (e) {
        debugLog(`[Auth] 恢复会话失败: ${e}`, "error");
      }
    }
  },
}));
