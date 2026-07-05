import { useTranslation } from "react-i18next";
import { Pin } from "lucide-react";
import { Avatar } from "../common/Avatar";

interface ConversationItemProps {
  name: string;
  lastMessage: string;
  time: string;
  active?: boolean;
  unread?: number;
  isGroup?: boolean;
  isPinned?: boolean;
  onClick?: () => void;
}

export function ConversationItem({
  name,
  lastMessage,
  time,
  active,
  unread,
  isGroup,
  isPinned,
  onClick,
}: ConversationItemProps) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2.5 flex items-center gap-3 transition-all text-left ${
        active
          ? "bg-feiyu-surface-container-highest"
          : "hover:bg-feiyu-surface-container-high"
      }`}
    >
      <Avatar name={name} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5 min-w-0">
            {isGroup && (
              <span className={`${active ? "text-feiyu-primary" : "text-feiyu-info"} text-xs flex-shrink-0`}>{t("conversation.groupBadge")}</span>
            )}
            <span className={`text-sm font-medium truncate ${active ? "text-feiyu-text" : "text-feiyu-text"}`}>{name}</span>
          </div>
          <span className={`text-eyebrow flex-shrink-0 ml-2 flex items-center gap-1 ${active ? "text-feiyu-text-secondary" : "text-feiyu-text-muted"}`}>
            {isPinned && <Pin size={10} />}
            {time}
          </span>
        </div>
        <div className={`text-xs truncate mt-0.5 ${active ? "text-feiyu-text-secondary" : "text-feiyu-text-muted"}`}>
          {lastMessage}
        </div>
      </div>
      {unread && unread > 0 ? (
        <span className="bg-feiyu-danger text-white text-eyebrow rounded-feiyu-pill min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </button>
  );
}
