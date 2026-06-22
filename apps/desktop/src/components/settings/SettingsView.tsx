import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { useAuthStore } from "../../stores/authStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { getServerUrl } from "../../services/serverConfig";

type SettingsSection = "profile" | "theme" | "notifications" | "privacy" | "chat" | "language" | "storage" | "shortcuts" | "security" | "about";

export function SettingsView() {
  const { t } = useTranslation();
  const [active, setActive] = useState<SettingsSection>("profile");

  const sections: { key: SettingsSection; label: string; icon: string }[] = [
    { key: "profile", label: t("settings.profile"), icon: "👤" },
    { key: "theme", label: t("settings.theme"), icon: "🎨" },
    { key: "notifications", label: t("settings.notifications"), icon: "🔔" },
    { key: "privacy", label: t("settings.privacy"), icon: "🔒" },
    { key: "chat", label: t("settings.chat"), icon: "💬" },
    { key: "language", label: t("settings.language"), icon: "🌐" },
    { key: "storage", label: t("settings.storage"), icon: "💾" },
    { key: "shortcuts", label: t("settings.shortcuts"), icon: "⌨️" },
    { key: "security", label: t("settings.security"), icon: "🛡️" },
    { key: "about", label: t("settings.about"), icon: "ℹ️" },
  ];

  return (
    <div className="flex-1 bg-feiyu-bg flex">
      {/* Left nav */}
      <div className="w-[200px] bg-feiyu-card border-r border-feiyu-border py-4 overflow-y-auto">
        <div className="px-4 mb-4">
          <h2 className="text-base font-bold text-feiyu-text">{t("settings.title")}</h2>
        </div>
        {sections.map((s) => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            className={`w-full px-4 py-2 text-sm text-left flex items-center gap-2.5 transition-colors ${
              active === s.key
                ? "bg-feiyu-primary/10 text-feiyu-primary border-r-2 border-feiyu-primary"
                : "text-feiyu-text hover:bg-gray-50"
            }`}
          >
            <span className="text-base">{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>

      {/* Right content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-[560px]">
          {active === "profile" && <ProfileSection />}
          {active === "theme" && <ThemeSection />}
          {active === "notifications" && <NotificationsSection />}
          {active === "privacy" && <PrivacySection />}
          {active === "chat" && <ChatSection />}
          {active === "language" && <LanguageSection />}
          {active === "storage" && <StorageSection />}
          {active === "shortcuts" && <ShortcutsSection />}
          {active === "security" && <SecuritySection />}
          {active === "about" && <AboutSection />}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// P0: 账号资料
// ============================================================
function ProfileSection() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    await updateProfile(displayName);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      const token = localStorage.getItem("token");
      const res = await fetch(`${getServerUrl()}/api/users/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        // 更新本地 user 状态
        const userStr = localStorage.getItem("user");
        if (userStr) {
          const u = JSON.parse(userStr);
          u.avatar_url = data.avatar_url;
          localStorage.setItem("user", JSON.stringify(u));
        }
        window.location.reload();
      }
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-feiyu-text mb-6">{t("settings.profile")}</h3>

      <div className="flex items-center gap-4 mb-8">
        <div className="relative group cursor-pointer" onClick={handleAvatarClick}>
          <Avatar name={user?.display_name || user?.username || "?"} size="lg" />
          <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-white text-xs">{uploading ? "..." : t("settings.profileSection.uploadAvatar")}</span>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>
        <div>
          <div className="text-sm font-medium text-feiyu-text">{user?.display_name || user?.username}</div>
          <div className="text-xs text-feiyu-text-muted">@{user?.username}</div>
        </div>
      </div>

      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-feiyu-text-secondary mb-1.5">{t("settings.profileSection.nickname")}</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t("settings.profileSection.nicknamePlaceholder")}
            className="w-full border border-feiyu-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-feiyu-primary transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-feiyu-text-secondary mb-1.5">{t("settings.profileSection.username")}</label>
          <input
            type="text"
            value={user?.username || ""}
            disabled
            className="w-full border border-feiyu-border rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-feiyu-text-muted"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-feiyu-text-secondary mb-1.5">{t("settings.profileSection.email")}</label>
          <input
            type="email"
            value={user?.email || ""}
            disabled
            className="w-full border border-feiyu-border rounded-lg px-3 py-2.5 text-sm bg-gray-50 text-feiyu-text-muted"
          />
        </div>
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            className="bg-feiyu-primary text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-feiyu-primary-hover transition-colors"
          >
            {t("settings.profileSection.save")}
          </button>
          {saved && <span className="text-sm text-green-600">{t("settings.profileSection.saved")}</span>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// P0: 外观主题
// ============================================================
function ThemeSection() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettingsStore();
  const theme = settings.theme;

  return (
    <div>
      <h3 className="text-lg font-bold text-feiyu-text mb-6">{t("settings.themeSection.title")}</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-feiyu-text-secondary mb-3">{t("settings.themeSection.themeMode")}</label>
          <div className="flex gap-3">
            {([
              { value: "light", label: t("settings.themeSection.light"), icon: "☀️" },
              { value: "dark", label: t("settings.themeSection.dark"), icon: "🌙" },
              { value: "system", label: t("settings.themeSection.system"), icon: "💻" },
            ] as const).map((t) => (
              <button
                key={t.value}
                onClick={() => updateSettings({ theme: t.value })}
                className={`flex-1 py-6 rounded-xl border-2 transition-colors flex flex-col items-center gap-2 ${
                  theme === t.value
                    ? "border-feiyu-primary bg-feiyu-primary/5"
                    : "border-feiyu-border hover:border-gray-300"
                }`}
              >
                <span className="text-2xl">{t.icon}</span>
                <span className="text-sm font-medium text-feiyu-text">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// P1: 通知设置
// ============================================================
function NotificationsSection() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettingsStore();

  return (
    <div>
      <h3 className="text-lg font-bold text-feiyu-text mb-6">{t("settings.notificationSection.title")}</h3>
      <div className="space-y-1">
        <ToggleRow
          label={t("settings.notificationSection.messageNotify")}
          desc={t("settings.notificationSection.messageNotifyDesc")}
          checked={settings.notify_message}
          onChange={(v) => updateSettings({ notify_message: v })}
        />
        <ToggleRow
          label={t("settings.notificationSection.sound")}
          desc={t("settings.notificationSection.soundDesc")}
          checked={settings.notify_sound}
          onChange={(v) => updateSettings({ notify_sound: v })}
        />
        <ToggleRow
          label={t("settings.notificationSection.desktop")}
          desc={t("settings.notificationSection.desktopDesc")}
          checked={settings.notify_desktop}
          onChange={(v) => updateSettings({ notify_desktop: v })}
        />
        <ToggleRow
          label={t("settings.notificationSection.dnd")}
          desc={t("settings.notificationSection.dndDesc")}
          checked={settings.notify_dnd}
          onChange={(v) => updateSettings({ notify_dnd: v })}
        />
        {settings.notify_dnd && (
          <div className="flex items-center gap-3 py-3 px-1">
            <label className="text-sm text-feiyu-text-secondary">{t("settings.notificationSection.timeRange")}</label>
            <input
              type="time"
              value={settings.notify_dnd_start || "22:00"}
              onChange={(e) => updateSettings({ notify_dnd_start: e.target.value })}
              className="border border-feiyu-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-feiyu-primary"
            />
            <span className="text-sm text-feiyu-text-muted">{t("settings.notificationSection.to")}</span>
            <input
              type="time"
              value={settings.notify_dnd_end || "08:00"}
              onChange={(e) => updateSettings({ notify_dnd_end: e.target.value })}
              className="border border-feiyu-border rounded px-2 py-1.5 text-sm focus:outline-none focus:border-feiyu-primary"
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// P1: 隐私设置
// ============================================================
function PrivacySection() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettingsStore();

  return (
    <div>
      <h3 className="text-lg font-bold text-feiyu-text mb-6">{t("settings.privacySection.title")}</h3>
      <div className="space-y-1">
        <div className="py-3 px-1">
          <label className="block text-sm font-medium text-feiyu-text mb-1.5">{t("settings.privacySection.whoCanAdd")}</label>
          <div className="flex gap-2 mt-2">
            {([
              { value: "everyone", label: t("settings.privacySection.everyone") },
              { value: "contacts", label: t("settings.privacySection.contactsOnly") },
              { value: "nobody", label: t("settings.privacySection.nobody") },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateSettings({ privacy_add_me: opt.value })}
                className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                  settings.privacy_add_me === opt.value
                    ? "border-feiyu-primary bg-feiyu-primary/5 text-feiyu-primary"
                    : "border-feiyu-border text-feiyu-text hover:border-gray-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <ToggleRow
          label={t("settings.privacySection.onlineVisible")}
          desc={t("settings.privacySection.onlineVisibleDesc")}
          checked={settings.privacy_online_visible}
          onChange={(v) => updateSettings({ privacy_online_visible: v })}
        />
        <ToggleRow
          label={t("settings.privacySection.readReceipt")}
          desc={t("settings.privacySection.readReceiptDesc")}
          checked={settings.privacy_read_receipt}
          onChange={(v) => updateSettings({ privacy_read_receipt: v })}
        />
      </div>
    </div>
  );
}

// ============================================================
// P1: 聊天设置
// ============================================================
function ChatSection() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettingsStore();

  return (
    <div>
      <h3 className="text-lg font-bold text-feiyu-text mb-6">{t("settings.chatSection.title")}</h3>
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-feiyu-text-secondary mb-2">{t("settings.chatSection.sendKey")}</label>
          <div className="flex gap-2">
            {([
              { value: "enter", label: t("settings.chatSection.enter"), desc: t("settings.chatSection.enterDesc") },
              { value: "ctrl+enter", label: t("settings.chatSection.ctrlEnter"), desc: t("settings.chatSection.ctrlEnterDesc") },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateSettings({ chat_send_key: opt.value })}
                className={`flex-1 py-3 px-4 rounded-lg border-2 transition-colors text-left ${
                  settings.chat_send_key === opt.value
                    ? "border-feiyu-primary bg-feiyu-primary/5"
                    : "border-feiyu-border hover:border-gray-300"
                }`}
              >
                <div className="text-sm font-medium text-feiyu-text">{opt.label}</div>
                <div className="text-xs text-feiyu-text-muted mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-feiyu-text-secondary mb-2">{t("settings.chatSection.fontSize")}</label>
          <div className="flex gap-2">
            {([
              { value: "small", label: t("settings.chatSection.small"), size: "text-xs" },
              { value: "medium", label: t("settings.chatSection.medium"), size: "text-sm" },
              { value: "large", label: t("settings.chatSection.large"), size: "text-base" },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => updateSettings({ chat_font_size: opt.value })}
                className={`flex-1 py-3 rounded-lg border-2 transition-colors flex flex-col items-center gap-1 ${
                  settings.chat_font_size === opt.value
                    ? "border-feiyu-primary bg-feiyu-primary/5"
                    : "border-feiyu-border hover:border-gray-300"
                }`}
              >
                <span className={`${opt.size} font-medium text-feiyu-text`}>Aa</span>
                <span className="text-xs text-feiyu-text-muted">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// P1: 语言
// ============================================================
function LanguageSection() {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSettingsStore();

  return (
    <div>
      <h3 className="text-lg font-bold text-feiyu-text mb-6">{t("settings.languageSection.title")}</h3>
      <div className="space-y-2">
        {([
          { value: "zh-CN", label: t("settings.languageSection.chinese"), flag: "🇨🇳" },
          { value: "en", label: t("settings.languageSection.english"), flag: "🇺🇸" },
        ] as const).map((opt) => (
          <button
            key={opt.value}
            onClick={() => updateSettings({ language: opt.value })}
            className={`w-full py-3 px-4 rounded-lg border-2 transition-colors flex items-center gap-3 text-left ${
              settings.language === opt.value
                ? "border-feiyu-primary bg-feiyu-primary/5"
                : "border-feiyu-border hover:border-gray-300"
            }`}
          >
            <span className="text-xl">{opt.flag}</span>
            <span className="text-sm font-medium text-feiyu-text">{opt.label}</span>
            {settings.language === opt.value && (
              <span className="ml-auto text-feiyu-primary text-sm">✓</span>
            )}
          </button>
        ))}
      </div>
      <p className="text-xs text-feiyu-text-muted mt-4">{t("settings.languageSection.refreshHint")}</p>
    </div>
  );
}

// ============================================================
// P2: 存储管理
// ============================================================
function StorageSection() {
  const { t } = useTranslation();
  const {
    cacheStats,
    loadCacheStats,
    clearMessageCache,
    clearMediaCache,
    clearConversationCache,
    clearContactCache,
    clearChannelCache,
    clearAllCache,
  } = useSettingsStore();
  const [clearedMsg, setClearedMsg] = useState<string | null>(null);

  useEffect(() => {
    loadCacheStats();
  }, [loadCacheStats]);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const handleClear = async (label: string, clearFn: () => Promise<void>) => {
    if (!window.confirm(t("storageSection.clearConfirm"))) return;
    await clearFn();
    setClearedMsg(label);
    setTimeout(() => setClearedMsg(null), 3000);
  };

  const handleClearAll = async () => {
    if (!window.confirm(t("storageSection.clearAllConfirm"))) return;
    await clearAllCache();
    setClearedMsg(t("storageSection.clearAll"));
    setTimeout(() => setClearedMsg(null), 3000);
  };

  const cacheItems = [
    {
      label: t("storageSection.messages"),
      desc: t("storageSection.messagesDesc"),
      count: cacheStats.messages.count,
      unit: t("storageSection.items"),
      size: cacheStats.messages.sizeBytes,
      onClear: () => handleClear(t("storageSection.messages"), clearMessageCache),
    },
    {
      label: t("storageSection.media"),
      desc: t("storageSection.mediaDesc"),
      count: cacheStats.media.count,
      unit: t("storageSection.files"),
      size: cacheStats.media.sizeBytes,
      onClear: () => handleClear(t("storageSection.media"), clearMediaCache),
    },
    {
      label: t("storageSection.conversations"),
      desc: t("storageSection.conversationsDesc"),
      count: cacheStats.conversations.count,
      unit: t("storageSection.items"),
      size: cacheStats.conversations.sizeBytes,
      onClear: () => handleClear(t("storageSection.conversations"), clearConversationCache),
    },
    {
      label: t("storageSection.contacts"),
      desc: t("storageSection.contactsDesc"),
      count: cacheStats.contacts.count,
      unit: t("storageSection.people"),
      size: cacheStats.contacts.sizeBytes,
      onClear: () => handleClear(t("storageSection.contacts"), clearContactCache),
    },
    {
      label: t("storageSection.channels"),
      desc: t("storageSection.channelsDesc"),
      count: cacheStats.channels.count,
      unit: t("storageSection.units"),
      size: cacheStats.channels.sizeBytes,
      onClear: () => handleClear(t("storageSection.channels"), clearChannelCache),
    },
  ];

  return (
    <div>
      <h3 className="text-lg font-bold text-feiyu-text mb-6">{t("settings.storageSection.title")}</h3>
      <div className="space-y-3">
        {cacheItems.map((item) => (
          <div key={item.label} className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-feiyu-text">{item.label}</div>
              <div className="text-xs text-feiyu-text-muted mt-0.5">{item.desc}</div>
              <div className="text-xs text-feiyu-text-secondary mt-1">
                {item.count} {item.unit} · {formatBytes(item.size)}
              </div>
            </div>
            <button
              onClick={item.onClear}
              className="text-xs text-red-500 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              {t("settings.storageSection.clearCache")}
            </button>
          </div>
        ))}

        {/* 总计 */}
        <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-feiyu-text">{t("storageSection.total")}</div>
            <div className="text-lg font-bold text-feiyu-text">{formatBytes(cacheStats.totalSizeBytes)}</div>
          </div>
          <button
            onClick={handleClearAll}
            className="bg-red-50 text-red-600 hover:bg-red-100 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
          >
            {t("storageSection.clearAll")}
          </button>
        </div>

        {/* 自动清理策略 */}
        <div className="pt-4 border-t border-feiyu-border">
          <h4 className="text-sm font-medium text-feiyu-text mb-3">{t("storageSection.autoCleanup")}</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-feiyu-text-secondary">
              <span className="text-green-500">✓</span>
              <span>{t("storageSection.autoCleanupMedia")}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-feiyu-text-secondary">
              <span className="text-green-500">✓</span>
              <span>{t("storageSection.autoCleanupStartup")}</span>
            </div>
          </div>
        </div>

        {clearedMsg && (
          <p className="text-sm text-green-600">
            {clearedMsg} {t("settings.storageSection.cacheCleared")}
          </p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// P2: 快捷键
// ============================================================
function ShortcutsSection() {
  const { t } = useTranslation();
  const shortcuts = [
    { key: "Ctrl + N", desc: t("settings.shortcutsSection.newChat") },
    { key: "Ctrl + F", desc: t("settings.shortcutsSection.searchMsg") },
    { key: "Ctrl + ,", desc: t("settings.shortcutsSection.openSettings") },
    { key: "Ctrl + 1", desc: t("settings.shortcutsSection.switchMessages") },
    { key: "Ctrl + 2", desc: t("settings.shortcutsSection.switchContacts") },
    { key: "Ctrl + 3", desc: t("settings.shortcutsSection.switchChannels") },
    { key: "Escape", desc: t("settings.shortcutsSection.closePopup") },
  ];

  return (
    <div>
      <h3 className="text-lg font-bold text-feiyu-text mb-6">{t("settings.shortcutsSection.title")}</h3>
      <div className="space-y-1">
        {shortcuts.map((s) => (
          <div key={s.key} className="flex items-center justify-between py-2.5 px-1">
            <span className="text-sm text-feiyu-text">{s.desc}</span>
            <kbd className="px-2 py-1 bg-gray-100 border border-feiyu-border rounded text-xs font-mono text-feiyu-text-secondary">
              {s.key}
            </kbd>
          </div>
        ))}
      </div>
      <p className="text-xs text-feiyu-text-muted mt-4">{t("settings.shortcutsSection.customHint")}</p>
    </div>
  );
}

// ============================================================
// P2: 账号安全
// ============================================================
function SecuritySection() {
  const { t } = useTranslation();
  const { settings, updateSettings, changePassword } = useSettingsStore();
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdSuccess, setPwdSuccess] = useState(false);

  const handleChangePassword = async () => {
    setPwdError(null);
    setPwdSuccess(false);
    if (newPwd.length < 6) {
      setPwdError(t("settings.securitySection.passwordMinLength"));
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdError(t("settings.securitySection.passwordMismatch"));
      return;
    }
    const err = await changePassword(oldPwd, newPwd);
    if (err) {
      setPwdError(err);
    } else {
      setPwdSuccess(true);
      setOldPwd("");
      setNewPwd("");
      setConfirmPwd("");
    }
  };

  return (
    <div>
      <h3 className="text-lg font-bold text-feiyu-text mb-6">{t("settings.securitySection.title")}</h3>

      <div className="space-y-6">
        {/* 修改密码 */}
        <div>
          <h4 className="text-sm font-medium text-feiyu-text mb-3">{t("settings.securitySection.changePassword")}</h4>
          <div className="space-y-3">
            <input
              type="password"
              value={oldPwd}
              onChange={(e) => setOldPwd(e.target.value)}
              placeholder={t("settings.securitySection.currentPassword")}
              className="w-full border border-feiyu-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-feiyu-primary"
            />
            <input
              type="password"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder={t("settings.securitySection.newPassword")}
              className="w-full border border-feiyu-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-feiyu-primary"
            />
            <input
              type="password"
              value={confirmPwd}
              onChange={(e) => setConfirmPwd(e.target.value)}
              placeholder={t("settings.securitySection.confirmPassword")}
              className="w-full border border-feiyu-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-feiyu-primary"
            />
            {pwdError && <p className="text-sm text-red-500">{pwdError}</p>}
            {pwdSuccess && <p className="text-sm text-green-600">{t("settings.securitySection.passwordUpdated")}</p>}
            <button
              onClick={handleChangePassword}
              className="bg-feiyu-primary text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-feiyu-primary-hover transition-colors"
            >
              {t("settings.securitySection.changeBtn")}
            </button>
          </div>
        </div>

        {/* 两步验证 */}
        <div className="pt-4 border-t border-feiyu-border">
          <ToggleRow
            label={t("settings.securitySection.twoFactor")}
            desc={t("settings.securitySection.twoFactorDesc")}
            checked={settings.two_factor_enabled}
            onChange={(v) => updateSettings({ two_factor_enabled: v })}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// P2: 关于
// ============================================================
function AboutSection() {
  const { t } = useTranslation();
  return (
    <div>
      <h3 className="text-lg font-bold text-feiyu-text mb-6">{t("settings.aboutSection.title")}</h3>
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-xl p-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-feiyu-primary flex items-center justify-center text-white text-3xl font-bold mx-auto mb-3">
            F
          </div>
          <h2 className="text-xl font-bold text-feiyu-text">{t("app.name")}</h2>
          <p className="text-sm text-feiyu-text-muted mt-1">{t("settings.aboutSection.version")}</p>
        </div>

        <div className="space-y-1">
          {[
            { label: t("settings.aboutSection.userAgreement"), href: "#" },
            { label: t("settings.aboutSection.privacyPolicy"), href: "#" },
            { label: t("settings.aboutSection.openSource"), href: "#" },
            { label: t("settings.aboutSection.feedback"), href: "#" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="flex items-center justify-between py-3 px-1 hover:bg-gray-50 rounded-lg transition-colors"
            >
              <span className="text-sm text-feiyu-text">{item.label}</span>
              <span className="text-feiyu-text-muted">→</span>
            </a>
          ))}
        </div>

        <p className="text-xs text-feiyu-text-muted text-center pt-4">
          © 2026 Feiyu. Built with Tauri + React + Rust.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Shared: Toggle Row
// ============================================================
function ToggleRow({ label, desc, checked, onChange }: {
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-1">
      <div>
        <div className="text-sm font-medium text-feiyu-text">{label}</div>
        {desc && <div className="text-xs text-feiyu-text-muted mt-0.5">{desc}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? "bg-feiyu-primary" : "bg-gray-300"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}
