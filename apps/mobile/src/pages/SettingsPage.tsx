import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { List, Switch, Dialog } from "antd-mobile";
import {
  UserOutline,
  BellOutline,
  LockOutline,
  GlobalOutline,
  InformationCircleOutline,
} from "antd-mobile-icons";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../stores/authStore";
import { useSettingsStore } from "../stores/settingsStore";
import { Avatar } from "../components/common/Avatar";

interface Settings {
  theme?: string;
  language?: string;
  notify_message?: boolean;
  privacy_read_receipt?: boolean;
}

function getSystemTheme(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const settingsRaw = useSettingsStore((s) => s.settings);
  const settings = settingsRaw as unknown as Settings;
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const [isDark, setIsDark] = useState(() => {
    if (settings?.theme === "dark") return true;
    if (settings?.theme === "light") return false;
    return getSystemTheme();
  });

  useEffect(() => {
    if (settings?.theme === "dark") {
      setIsDark(true);
    } else if (settings?.theme === "light") {
      setIsDark(false);
    } else {
      setIsDark(getSystemTheme());
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
  }, [settings?.theme]);

  const handleLogout = async () => {
    const result = await Dialog.confirm({
      content: t("settings.logoutConfirm"),
    });
    if (result) {
      logout();
      navigate("/login", { replace: true });
    }
  };

  const handleThemeChange = (checked: boolean) => {
    const newTheme = checked ? "dark" : "light";
    updateSettings({ theme: newTheme });
  };

  const currentLang = i18n.language.startsWith("zh") ? "zh-CN" : "en";

  return (
    <div>
      <div
        style={{
          padding: "16px",
          fontSize: "24px",
          fontWeight: "bold",
          color: "var(--feiyu-text)",
        }}
      >
        {t("tab.settings")}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          padding: "20px 16px",
          background: "var(--feiyu-card)",
          marginBottom: "12px",
        }}
      >
        <Avatar
          name={user?.display_name || user?.username || "?"}
          size={56}
        />
        <div>
          <div style={{ fontSize: "18px", fontWeight: 600, color: "var(--feiyu-text)" }}>
            {user?.display_name || user?.username}
          </div>
          <div style={{ fontSize: "14px", color: "var(--feiyu-text-muted)", marginTop: "4px" }}>
            {user?.email}
          </div>
        </div>
      </div>

      <List header={t("settings.general")}>
        <List.Item
          prefix={<UserOutline />}
          onClick={() => navigate("/settings/profile")}
        >
          {t("settings.profile")}
        </List.Item>
        <List.Item
          prefix={<LockOutline />}
          extra={
            <Switch
              checked={isDark}
              onChange={handleThemeChange}
            />
          }
        >
          {t("settings.darkMode")}
        </List.Item>
        <List.Item
          prefix={<GlobalOutline />}
          onClick={() => navigate("/settings/language")}
          extra={currentLang === "zh-CN" ? "简体中文" : "English"}
        >
          {t("settings.language")}
        </List.Item>
      </List>

      <List header={t("settings.notifications")}>
        <List.Item
          prefix={<BellOutline />}
          extra={
            <Switch
              checked={settings?.notify_message ?? true}
              onChange={(checked) =>
                updateSettings({ notify_message: checked })
              }
            />
          }
        >
          {t("settings.enableNotifications")}
        </List.Item>
      </List>

      <List header={t("settings.privacy")}>
        <List.Item
          prefix={<LockOutline />}
          extra={
            <Switch
              checked={settings?.privacy_read_receipt ?? true}
              onChange={(checked) =>
                updateSettings({ privacy_read_receipt: checked })
              }
            />
          }
        >
          {t("settings.readReceipts")}
        </List.Item>
      </List>

      <List header={t("settings.about")}>
        <List.Item prefix={<InformationCircleOutline />}>
          {t("settings.version")}
        </List.Item>
      </List>

      <div style={{ padding: "24px 16px" }}>
        <button
          onClick={handleLogout}
          style={{
            width: "100%",
            padding: "12px",
            background: "var(--feiyu-danger)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontSize: "16px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          {t("settings.logout")}
        </button>
      </div>
    </div>
  );
}
