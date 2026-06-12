import { Avatar } from "../common/Avatar";

interface ConversationItemProps {
  name: string;
  lastMessage: string;
  time: string;
  active?: boolean;
  unread?: number;
  isGroup?: boolean;
  onClick?: () => void;
}

export function ConversationItem({
  name,
  lastMessage,
  time,
  active,
  unread,
  isGroup,
  onClick,
}: ConversationItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2 flex items-center gap-2.5 transition-colors text-left ${
        active
          ? "bg-feiyu-primary/10 border-l-2 border-feiyu-primary"
          : "hover:bg-gray-100 border-l-2 border-transparent"
      }`}
    >
      <Avatar name={name} />
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5 min-w-0">
            {isGroup && (
              <span className="text-blue-500 text-xs flex-shrink-0">群</span>
            )}
            <span className="text-sm font-medium text-feiyu-text truncate">{name}</span>
          </div>
          <span className="text-[11px] text-feiyu-text-muted flex-shrink-0 ml-2">{time}</span>
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
