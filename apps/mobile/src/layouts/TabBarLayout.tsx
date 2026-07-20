import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { TabBar } from "antd-mobile";
import {
  MessageOutline,
  UserOutline,
  AppOutline,
  SetOutline,
} from "antd-mobile-icons";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { useChatStore } from "../stores/chatStore";
import { useContactStore } from "../stores/contactStore";
import { useChannelStore } from "../stores/channelStore";
import { useSettingsStore } from "../stores/settingsStore";

const tabs = [
  {
    key: "/conversations",
    title: "tab.messages",
    icon: <MessageOutline />,
  },
  {
    key: "/contacts",
    title: "tab.contacts",
    icon: <UserOutline />,
  },
  {
    key: "/channels",
    title: "tab.channels",
    icon: <AppOutline />,
  },
  {
    key: "/settings",
    title: "tab.settings",
    icon: <SetOutline />,
  },
];

export function TabBarLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const loadConversations = useChatStore((s) => s.loadConversations);
  const loadContacts = useContactStore((s) => s.loadContacts);
  const loadChannels = useChannelStore((s) => s.loadChannels);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    if (user) {
      loadConversations();
      loadContacts();
      loadChannels();
      loadSettings();
    }
  }, [user]);

  const activeTab = tabs.find((tab) =>
    location.pathname.startsWith(tab.key)
  )?.key || "/conversations";

  return (
    <div className="page-container safe-area-top">
      <div className="page-content">
        <Outlet />
      </div>
      <div className="safe-area-bottom">
        <TabBar
          activeKey={activeTab}
          onChange={(key) => navigate(key)}
          style={{
            borderTop: "1px solid var(--feiyu-border)",
            backgroundColor: "var(--feiyu-card)",
          }}
        >
          {tabs.map((tab) => (
            <TabBar.Item
              key={tab.key}
              icon={tab.icon}
              title={t(tab.title)}
            />
          ))}
        </TabBar>
      </div>
    </div>
  );
}
