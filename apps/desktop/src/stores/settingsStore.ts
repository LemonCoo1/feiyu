import { create } from "zustand";
import { api } from "../services/api";
import i18n from "../i18n";

interface Settings {
  notify_message: boolean;
  notify_sound: boolean;
  notify_desktop: boolean;
  notify_dnd: boolean;
  notify_dnd_start: string | null;
  notify_dnd_end: string | null;
  privacy_add_me: string;
  privacy_online_visible: boolean;
  privacy_read_receipt: boolean;
  chat_send_key: string;
  chat_font_size: string;
  theme: string;
  language: string;
  two_factor_enabled: boolean;
}

const THEME_KEY = "feiyu_theme";
const LANGUAGE_KEY = "feiyu_language";

function loadThemeFromStorage(): string {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && ["light", "dark", "system"].includes(saved)) return saved;
  } catch {}
  return "system";
}

function loadLanguageFromStorage(): string {
  try {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    if (saved && ["zh-CN", "en"].includes(saved)) return saved;
  } catch {}
  return "zh-CN";
}

const defaultSettings: Settings = {
  notify_message: true,
  notify_sound: true,
  notify_desktop: true,
  notify_dnd: false,
  notify_dnd_start: null,
  notify_dnd_end: null,
  privacy_add_me: "everyone",
  privacy_online_visible: true,
  privacy_read_receipt: true,
  chat_send_key: "enter",
  chat_font_size: "medium",
  theme: loadThemeFromStorage(),
  language: loadLanguageFromStorage(),
  two_factor_enabled: false,
};

interface SettingsState {
  settings: Settings;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<string | null>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const data = await api.getSettings();
      // 主题和语言由客户端 localStorage 管理，不从服务端覆盖
      const { theme: _serverTheme, language: _serverLang, ...serverData } = data;
      const lang = loadLanguageFromStorage();
      i18n.changeLanguage(lang);
      set({ settings: { ...defaultSettings, ...serverData, language: lang }, isLoading: false });
    } catch (e) {
      console.error("Failed to load settings:", e);
      set({ isLoading: false });
    }
  },

  updateSettings: async (patch) => {
    const prev = get().settings;
    set({ settings: { ...prev, ...patch } });
    // 主题和语言由客户端 localStorage 管理，不同步到服务端
    const { theme: _themePatch, language: _langPatch, ...serverPatch } = patch;
    if ("theme" in patch) {
      localStorage.setItem(THEME_KEY, patch.theme!);
    }
    if ("language" in patch) {
      localStorage.setItem(LANGUAGE_KEY, patch.language!);
      i18n.changeLanguage(patch.language!);
    }
    try {
      if (Object.keys(serverPatch).length > 0) {
        await api.updateSettings(serverPatch);
      }
    } catch (e) {
      console.error("Failed to update settings:", e);
      set({ settings: prev });
    }
  },

  changePassword: async (oldPassword, newPassword) => {
    try {
      await api.changePassword(oldPassword, newPassword);
      return null;
    } catch (e: any) {
      return e.message || i18n.t("settings.securitySection.changeFailed");
    }
  },
}));
