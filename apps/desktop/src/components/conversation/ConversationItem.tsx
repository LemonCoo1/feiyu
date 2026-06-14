import { useTranslation } from "react-i18next";
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
      className={`w-full px-3 py-2.5 flex items-center gap-2.5 transition-all text-left rounded-lg mx-1 my-0.5 ${
        active
          ? "bg-feiyu-primary/12 border-l-[3px] border-feiyu-primary shadow-sm"
          : "hover:bg-gray-100 border-l-[3px] border-transparent"
      }`}
    >
      <Avatar name={name} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5 min-w-0">
            {isGroup && (
              <span className="text-blue-500 text-xs flex-shrink-0">{t("conversation.groupBadge")}</span>
            )}
            <span className="text-sm font-medium text-feiyu-text truncate">{name}</span>
          </div>
          <span className="text-[11px] text-feiyu-text-muted flex-shrink-0 ml-2">
            {isPinned && <span className="mr-1">📌</span>}
            {time}
          </span>
        </div>
        <div className="text-xs text-feiyu-text-secondary truncate mt-0.5">
          {lastMessage}
        </div>
      </div>
      {unread && unread > 0 ? (
        <span className="bg-red-500 text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
          {unread > 99 ? "99+" : unread}
        </span>
      ) : null}
    </button>
  );
}
