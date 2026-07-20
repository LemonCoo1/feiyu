import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import { useWebSocket } from "./hooks/useWebSocket";
import { useTheme } from "./hooks/useTheme";
import { TabBarLayout } from "./layouts/TabBarLayout";
import { AuthPage } from "./pages/AuthPage";
import { ConversationsPage } from "./pages/ConversationsPage";
import { ChatPage } from "./pages/ChatPage";
import { ContactsPage } from "./pages/ContactsPage";
import { ContactDetailPage } from "./pages/ContactDetailPage";
import { ChannelsPage } from "./pages/ChannelsPage";
import { ChannelChatPage } from "./pages/ChannelChatPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LanguagePage } from "./pages/LanguagePage";
import { ProfilePage } from "./pages/ProfilePage";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  if (!user || !token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  useWebSocket();
  useTheme();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route path="/register" element={<AuthPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <TabBarLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/conversations" replace />} />
          <Route path="conversations" element={<ConversationsPage />} />
          <Route path="contacts" element={<ContactsPage />} />
          <Route path="channels" element={<ChannelsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route
          path="/chat/:id"
          element={
            <ProtectedRoute>
              <ChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts/:id"
          element={
            <ProtectedRoute>
              <ContactDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/channels/:id"
          element={
            <ProtectedRoute>
              <ChannelChatPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/language"
          element={
            <ProtectedRoute>
              <LanguagePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
