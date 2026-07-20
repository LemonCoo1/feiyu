import { getServerUrl } from "../../services/serverConfig";

interface AvatarProps {
  name: string;
  url?: string | null;
  size?: number;
  online?: boolean;
}

/** 将相对路径（如 /api/files/xxx）拼接为完整 URL；已是完整 URL 则原样返回 */
function resolveFileUrl(url: string): string {
  if (/^(https?:|blob:|data:)/.test(url)) return url;
  return `${getServerUrl()}${url}`;
}

const colors = [
  "#3b82f6",
  "#ef4444",
  "#22c55e",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

function getColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}

export function Avatar({ name, url, size = 40, online }: AvatarProps) {
  const color = getColor(name);
  const initial = getInitial(name);
  const src = url ? resolveFileUrl(url) : undefined;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <div
        className="avatar"
        style={{
          width: `${size}px`,
          height: `${size}px`,
          backgroundColor: color,
          color: "white",
          fontSize: `${size * 0.4}px`,
          ...(src ? { backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
        }}
      >
        {src ? null : initial}
      </div>
      {online !== undefined && (
        <div
          className="badge-dot"
          style={{
            width: `${size * 0.25}px`,
            height: `${size * 0.25}px`,
            backgroundColor: online ? "var(--feiyu-success)" : "var(--feiyu-text-muted)",
          }}
        />
      )}
    </div>
  );
}
