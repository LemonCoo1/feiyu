import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, EyeOff } from "lucide-react";
import { Avatar } from "../common/Avatar";

interface Member {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface ReadReceiptPopoverProps {
  anchorRect: DOMRect;
  readUserIds: string[];
  unreadUserIds: string[];
  members: Member[];
  onClose: () => void;
}

function displayName(m: Member | undefined, fallback: string): string {
  if (!m) return fallback;
  return m.display_name || m.username || fallback;
}

function avatarUrl(m: Member | undefined): string | null | undefined {
  return m?.avatar_url;
}

export function ReadReceiptPopover({
  anchorRect,
  readUserIds,
  unreadUserIds,
  members,
  onClose,
}: ReadReceiptPopoverProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>(() =>
    computePosition(anchorRect)
  );

  // 计算浮层位置：默认在触发按钮上方、右对齐
  function computePosition(rect: DOMRect): { top: number; left: number } {
    const POPOVER_WIDTH = 320;
    const POPOVER_MAX_HEIGHT = 360;
    const GAP = 8;
    const margin = 8;
    let top: number;
    if (rect.top - POPOVER_MAX_HEIGHT - GAP > margin) {
      top = rect.top - POPOVER_MAX_HEIGHT - GAP;
    } else {
      top = rect.bottom + GAP;
    }
    let left = rect.right - POPOVER_WIDTH;
    if (left < margin) left = margin;
    if (left + POPOVER_WIDTH > window.innerWidth - margin) {
      left = window.innerWidth - POPOVER_WIDTH - margin;
    }
    return { top, left };
  }

  // 窗口变化时重新定位
  useEffect(() => {
    const handler = () => setPos(computePosition(anchorRect));
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler, true);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler, true);
    };
  }, [anchorRect]);

  // 点击外部 / Esc 关闭
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const memberMap = new Map(members.map((m) => [m.user_id, m]));
  const readMembers = readUserIds
    .map((id) => memberMap.get(id))
    .filter((m): m is Member => !!m);
  const unreadMembers = unreadUserIds
    .map((id) => memberMap.get(id))
    .filter((m): m is Member => !!m);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-80 bg-feiyu-card border border-feiyu-border rounded-feiyu-lg shadow-feiyu-4 overflow-hidden flex flex-col"
      style={{ top: pos.top, left: pos.left, maxHeight: 360 }}
    >
      <div className="grid grid-cols-2 divide-x divide-feiyu-border">
        <Column
          icon={<Check size={12} className="text-feiyu-success" />}
          title={t("chat.readTitle")}
          count={readMembers.length}
        >
          {readMembers.length === 0 ? (
            <EmptyRow text={t("chat.readEmpty")} />
          ) : (
            readMembers.map((m) => (
              <MemberRow
                key={m.user_id}
                name={displayName(m, t("unknownUser"))}
                url={avatarUrl(m)}
              />
            ))
          )}
        </Column>
        <Column
          icon={<EyeOff size={12} className="text-feiyu-text-muted" />}
          title={t("chat.unreadTitle")}
          count={unreadMembers.length}
        >
          {unreadMembers.length === 0 ? (
            <EmptyRow text={t("chat.unreadEmpty")} />
          ) : (
            unreadMembers.map((m) => (
              <MemberRow
                key={m.user_id}
                name={displayName(m, t("unknownUser"))}
                url={avatarUrl(m)}
              />
            ))
          )}
        </Column>
      </div>
    </div>
  );
}

function Column({
  icon,
  title,
  count,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-0">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-feiyu-border bg-feiyu-surface-container">
        <span className="flex-shrink-0">{icon}</span>
        <span className="text-eyebrow text-feiyu-text-muted font-medium">
          {title}
        </span>
        <span className="ml-auto text-eyebrow text-feiyu-text-muted">
          {count}
        </span>
      </div>
      <div className="overflow-y-auto py-1 max-h-[280px]">{children}</div>
    </div>
  );
}

function MemberRow({ name, url }: { name: string; url?: string | null }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 hover:bg-feiyu-surface-container-high">
      <Avatar name={name} url={url} size="sm" />
      <span className="text-sm text-feiyu-text truncate">{name}</span>
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="px-3 py-3 text-caption text-feiyu-text-muted">{text}</div>
  );
}
