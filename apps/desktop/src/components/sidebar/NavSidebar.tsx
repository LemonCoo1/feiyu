import { NavItem } from "./NavItem";

type NavView = "messages" | "contacts" | "channels" | "settings";

interface NavSidebarProps {
  activeView: NavView;
  onViewChange: (view: NavView) => void;
}

export function NavSidebar({ activeView, onViewChange }: NavSidebarProps) {
  return (
    <div className="w-[60px] bg-feiyu-sidebar flex flex-col items-center pt-3 gap-2">
      <div className="w-10 h-10 rounded-xl bg-feiyu-primary flex items-center justify-center text-white text-xl font-bold mb-3">
        F
      </div>
      <NavItem
        icon="💬"
        label="消息"
        active={activeView === "messages"}
        onClick={() => onViewChange("messages")}
      />
      <NavItem
        icon="👥"
        label="通讯录"
        active={activeView === "contacts"}
        onClick={() => onViewChange("contacts")}
      />
      <NavItem
        icon="📋"
        label="频道"
        active={activeView === "channels"}
        onClick={() => onViewChange("channels")}
      />
      <div className="flex-1" />
      <NavItem
        icon="⚙️"
        label="设置"
        active={activeView === "settings"}
        onClick={() => onViewChange("settings")}
      />
    </div>
  );
}
