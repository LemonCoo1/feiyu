import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MessageSquare, Users, Hash, Settings } from "lucide-react";
import { NavItem } from "./NavItem";
import { Avatar } from "../common/Avatar";
import { ProfilePanel } from "../profile/ProfilePanel";
import { useAuthStore } from "../../stores/authStore";

type NavView = "messages" | "contacts" | "channels" | "settings";

interface NavSidebarProps {
  activeView: NavView;
  onViewChange: (view: NavView) => void;
}

export function NavSidebar({ activeView, onViewChange }: NavSidebarProps) {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const displayName = user?.display_name || user?.username || "F";
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <div className="w-[54px] bg-feiyu-sidebar flex flex-col items-center py-3 gap-3">
        <button
          onClick={() => setProfileOpen(true)}
          className="mb-2 transition-transform hover:scale-105"
          title={t("nav.profile")}
        >
          <Avatar name={displayName} url={user?.avatar_url} size="md" />
        </button>
        <NavItem
          icon={<MessageSquare size={20} />}
          label={t("nav.messages")}
          active={activeView === "messages"}
          onClick={() => onViewChange("messages")}
        />
        <NavItem
          icon={<Users size={20} />}
          label={t("nav.contacts")}
          active={activeView === "contacts"}
          onClick={() => onViewChange("contacts")}
        />
        <NavItem
          icon={<Hash size={20} />}
          label={t("nav.channels")}
          active={activeView === "channels"}
          onClick={() => onViewChange("channels")}
        />
        <div className="flex-1" />
        <NavItem
          icon={<Settings size={20} />}
          label={t("nav.settings")}
          active={activeView === "settings"}
          onClick={() => onViewChange("settings")}
        />
      </div>

      {profileOpen && (
        <ProfilePanel
          onClose={() => setProfileOpen(false)}
          onOpenSettings={() => onViewChange("settings")}
        />
      )}
    </>
  );
}
