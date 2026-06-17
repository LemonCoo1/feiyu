import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "./i18n";
import { NavSidebar } from "./components/sidebar/NavSidebar";
import { ConversationList } from "./components/conversation/ConversationList";
import { ChatWindow } from "./components/chat/ChatWindow";
import { ContactList } from "./components/contact/ContactList";
import { ChannelList } from "./components/channel/ChannelList";
import { ChannelView } from "./components/channel/ChannelView";
import { SettingsView } from "./components/settings/SettingsView";
import { useAuthStore } from "./stores/authStore";
import { useChatStore } from "./stores/chatStore";
import { useContactStore } from "./stores/contactStore";
import { useChannelStore } from "./stores/channelStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useWebSocket } from "./hooks/useWebSocket";
import { useTheme } from "./hooks/useTheme";
import { DebugPanel } from "./components/common/DebugPanel";
import { ConnectionBanner } from "./components/common/ConnectionBanner";
import { wsClient } from "./services/ws";
import { getServerUrl, setServerUrl, validateServerUrl, normalizeServerUrl, getDefaultServerUrl } from "./services/serverConfig";
import type { ConnectionStatus } from "./services/ws";
import * as cacheService from "./services/cacheService";

type NavView = "messages" | "contacts" | "channels" | "settings";

function App() {
  const [activeView, setActiveView] = useState<NavView>("messages");
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const loadContacts = useContactStore((s) => s.loadContacts);
  const loadChannels = useChannelStore((s) => s.loadChannels);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connected");

  useWebSocket();
  useTheme();

  useEffect(() => {
    wsClient.onStatusChange(setConnectionStatus);
    return () => wsClient.offStatusChange(setConnectionStatus);
  }, []);

  useEffect(() => {
    loadFromStorage();
  }, []);

  // 启动时自动清理过期缓存
  useEffect(() => {
    cacheService.runAutoCleanup();
  }, []);

  useEffect(() => {
    if (user) {
      loadConversations();
      loadContacts();
      loadChannels();
      loadSettings();
    }
  }, [user]);

  if (!user || !token) {
    return <AuthScreen onLogin={login} onRegister={register} />;
  }

  return (
    <div className="flex h-screen w-screen flex-col">
      <ConnectionBanner status={connectionStatus} />
      <div className="flex flex-1 overflow-hidden">
        <NavSidebar activeView={activeView} onViewChange={setActiveView} />
        {activeView === "messages" && (
          <>
            <ConversationList />
            <ChatWindow />
          </>
        )}
        {activeView === "contacts" && <ContactList />}
        {activeView === "channels" && (
          <>
            <ChannelList />
            <ChannelView />
          </>
        )}
        {activeView === "settings" && <SettingsView />}
        <DebugPanel />
      </div>
    </div>
  );
}

function AuthScreen({
  onLogin,
  onRegister,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (username: string, email: string, password: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const error = useAuthStore((s) => s.error);
  const isLoading = useAuthStore((s) => s.isLoading);
  const [serverUrl, setServerUrlState] = useState<string>(getServerUrl());
  const [urlError, setUrlError] = useState<string | null>(null);
  const [testState, setTestState] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg] = useState<string>("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      await onLogin(email, password);
    } else {
      await onRegister(username, email, password);
    }
  };

  const handleServerUrlBlur = () => {
    const err = validateServerUrl(serverUrl);
    if (err) {
      setUrlError(err);
      return;
    }
    setUrlError(null);
    setServerUrl(serverUrl);
  };

  const handleTestConnection = async () => {
    const err = validateServerUrl(serverUrl);
    if (err) {
      setUrlError(err);
      return;
    }
    setUrlError(null);
    setTestState("testing");
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${normalizeServerUrl(serverUrl)}/api/health`, {
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        setTestState("ok");
        setTestMsg("");
      } else {
        setTestState("fail");
        setTestMsg(`${res.status}`);
      }
    } catch (e: any) {
      setTestState("fail");
      setTestMsg(e?.name === "AbortError" ? "timeout" : e?.message || "network");
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-feiyu-bg">
      <div className="bg-feiyu-card rounded-xl shadow-lg p-8 w-[360px]">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-feiyu-primary flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
            F
          </div>
          <h1 className="text-xl font-bold text-feiyu-text">{t("app.name")}</h1>
          <p className="text-sm text-feiyu-text-muted mt-1">
            {mode === "login" ? t("auth.loginSubtitle") : t("auth.registerSubtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <input
              type="text"
              placeholder={t("auth.username")}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-feiyu-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-feiyu-primary"
              required
            />
          )}
          <input
            type="email"
            placeholder={t("auth.email")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-feiyu-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-feiyu-primary"
            required
          />
          <input
            type="password"
            placeholder={t("auth.password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-feiyu-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-feiyu-primary"
            required
          />
          {error && (
            <p className="text-red-500 text-xs">{error}</p>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-feiyu-primary text-white rounded-lg py-2.5 text-sm font-medium hover:bg-feiyu-primary-hover disabled:opacity-50 transition-colors"
          >
            {isLoading ? t("auth.pleaseWait") : mode === "login" ? t("auth.login") : t("auth.register")}
          </button>
        </form>

        <details className="text-sm border-t border-feiyu-border pt-3">
          <summary className="cursor-pointer text-feiyu-text-muted hover:text-feiyu-text select-none">
            {t("auth.serverSettings")}
          </summary>
          <div className="mt-2 space-y-2">
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrlState(e.target.value)}
              onBlur={handleServerUrlBlur}
              placeholder={getDefaultServerUrl()}
              className="w-full border border-feiyu-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-feiyu-primary"
            />
            {urlError && (
              <p className="text-red-500 text-xs">{t(`auth.urlError.${urlError}`)}</p>
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testState === "testing"}
                className="text-xs border border-feiyu-border rounded px-2 py-1 hover:bg-feiyu-bg disabled:opacity-50"
              >
                {testState === "testing" ? t("auth.testing") : t("auth.testConnection")}
              </button>
              {testState === "ok" && (
                <span className="text-green-500 text-xs">✓ {t("auth.connectionOk")}</span>
              )}
              {testState === "fail" && (
                <span className="text-red-500 text-xs">
                  ✗ {t("auth.connectionFailed")}
                  {testMsg ? `: ${testMsg}` : ""}
                </span>
              )}
            </div>
          </div>
        </details>

        <p className="text-center mt-4 text-sm text-feiyu-text-muted">
          {mode === "login" ? t("auth.noAccount") : t("auth.hasAccount")}
          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-feiyu-primary hover:underline ml-1"
          >
            {mode === "login" ? t("auth.register") : t("auth.login")}
          </button>
        </p>
      </div>
    </div>
  );
}

export default App;
