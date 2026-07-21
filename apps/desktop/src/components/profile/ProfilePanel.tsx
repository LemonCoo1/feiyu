import { useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Avatar } from "../common/Avatar";
import { useAuthStore } from "../../stores/authStore";

interface ProfilePanelProps {
  onClose: () => void;
  onOpenSettings: () => void;
}

export function ProfilePanel({ onClose, onOpenSettings }: ProfilePanelProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (!user) return null;

  return (
    <div
      ref={panelRef}
      className="fixed left-[62px] top-3 z-50 w-[280px] bg-feiyu-surface rounded-feiyu-xl shadow-feiyu-5 border border-feiyu-border overflow-hidden animate-fade-in"
    >
      {/* User info */}
      <div className="p-4 flex items-center gap-3 border-b border-feiyu-border">
        <Avatar name={user.display_name || user.username || "?"} url={user.avatar_url} size="md" />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-feiyu-text truncate">
            {user.display_name || user.username}
          </div>
          <div className="text-xs text-feiyu-text-muted truncate">@{user.username}</div>
        </div>
        <span className="flex items-center gap-1 text-xs text-feiyu-text-muted">
          <span className={`w-2 h-2 rounded-full ${
            user.status === "online" ? "bg-feiyu-success" : user.status === "away" ? "bg-feiyu-warning" : "bg-feiyu-text-muted"
          }`} />
          {user.status === "online" ? t("profile.online") : user.status === "away" ? t("profile.away") : t("profile.offline")}
        </span>
      </div>

      {/* Quick info */}
      <div className="px-4 py-2.5 border-b border-feiyu-border">
        <div className="text-xs text-feiyu-text-muted">{t("profile.email")}</div>
        <div className="text-sm text-feiyu-text mt-0.5">{user.email}</div>
      </div>

      {/* Actions */}
      <div className="py-1">
        <button
          onClick={() => { onClose(); onOpenSettings(); }}
          className="w-full px-4 py-2.5 text-sm text-left text-feiyu-text hover:bg-feiyu-surface-container-high transition-colors"
        >
          {t("profile.editProfile")}
        </button>
        <button
          onClick={logout}
          className="w-full px-4 py-2.5 text-sm text-left text-feiyu-danger hover:bg-feiyu-surface-container-high transition-colors"
        >
          {t("profile.logout")}
        </button>
      </div>
    </div>
  );
}
