import { Avatar } from "../common/Avatar";

interface ContactItemProps {
  name: string;
  username: string;
  online?: boolean;
  onClick?: () => void;
  action?: React.ReactNode;
}

export function ContactItem({ name, username, online, onClick, action }: ContactItemProps) {
  const clickable = !!onClick;
  return (
    <div
      onClick={onClick}
      className={`group flex items-center gap-3 px-4 py-2.5 transition-colors ${clickable ? "cursor-pointer hover:bg-feiyu-bg-hover" : ""}`}
    >
      <Avatar name={name} online={online} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-feiyu-text truncate">{name}</div>
        <div className="text-xs text-feiyu-text-muted">@{username}</div>
      </div>
      {action && (
        <div onClick={(e) => e.stopPropagation()} className="flex items-center flex-shrink-0">
          {action}
        </div>
      )}
    </div>
  );
}
