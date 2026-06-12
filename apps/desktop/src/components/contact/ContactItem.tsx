import { Avatar } from "../common/Avatar";

interface ContactItemProps {
  name: string;
  username: string;
  online?: boolean;
  onClick?: () => void;
  action?: React.ReactNode;
}

export function ContactItem({ name, username, online, onClick, action }: ContactItemProps) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer transition-colors"
    >
      <Avatar name={name} online={online} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-feiyu-text truncate">{name}</div>
        <div className="text-xs text-feiyu-text-muted">@{username}</div>
      </div>
      {action}
    </div>
  );
}
