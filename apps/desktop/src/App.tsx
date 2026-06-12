import { useState, useEffect } from "react";
import { NavSidebar } from "./components/sidebar/NavSidebar";
import { ConversationList } from "./components/conversation/ConversationList";
import { ChatWindow } from "./components/chat/ChatWindow";
import { useAuthStore } from "./stores/authStore";
import { useChatStore } from "./stores/chatStore";
import { useWebSocket } from "./hooks/useWebSocket";

type NavView = "messages" | "contacts" | "channels" | "settings";

function App() {
  const [activeView, setActiveView] = useState<NavView>("messages");
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const loadConversations = useChatStore((s) => s.loadConversations);

  useWebSocket();

  useEffect(() => {
    loadFromStorage();
  }, []);

  useEffect(() => {
    if (user) {
      loadConversations();
    }
  }, [user]);

  if (!user || !token) {
    return <AuthScreen onLogin={login} onRegister={register} />;
  }

  return (
    <div className="flex h-screen w-screen">
      <NavSidebar activeView={activeView} onViewChange={setActiveView} />
      {activeView === "messages" && (
        <>
          <ConversationList />
          <ChatWindow />
        </>
      )}
      {activeView !== "messages" && (
        <div className="flex-1 bg-feiyu-bg flex items-center justify-center">
          <span className="text-feiyu-text-muted">
            {activeView === "contacts" && "通讯录 - 开发中"}
            {activeView === "channels" && "频道 - 开发中"}
            {activeView === "settings" && "设置 - 开发中"}
          </span>
        </div>
      )}
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
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const error = useAuthStore((s) => s.error);
  const isLoading = useAuthStore((s) => s.isLoading);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      await onLogin(email, password);
    } else {
      await onRegister(username, email, password);
    }
  };

  return (
    <div className="h-screen w-screen flex items-center justify-center bg-feiyu-bg">
      <div className="bg-white rounded-xl shadow-lg p-8 w-[360px]">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-feiyu-primary flex items-center justify-center text-white text-2xl font-bold mx-auto mb-3">
            F
          </div>
          <h1 className="text-xl font-bold text-feiyu-text">飞鱼</h1>
          <p className="text-sm text-feiyu-text-muted mt-1">
            {mode === "login" ? "登录你的账号" : "创建新账号"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "register" && (
            <input
              type="text"
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border border-feiyu-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-feiyu-primary"
              required
            />
          )}
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-feiyu-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-feiyu-primary"
            required
          />
          <input
            type="password"
            placeholder="密码"
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
            {isLoading ? "请稍候..." : mode === "login" ? "登录" : "注册"}
          </button>
        </form>

        <p className="text-center mt-4 text-sm text-feiyu-text-muted">
          {mode === "login" ? "没有账号？" : "已有账号？"}
          <button
            onClick={() => setMode(mode === "login" ? "register" : "login")}
            className="text-feiyu-primary hover:underline ml-1"
          >
            {mode === "login" ? "注册" : "登录"}
          </button>
        </p>
      </div>
    </div>
  );
}

export default App;
