interface AvatarProps {
  name: string;
  size?: number;
  online?: boolean;
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

export function Avatar({ name, size = 40, online }: AvatarProps) {
  const color = getColor(name);
  const initial = getInitial(name);

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
        }}
      >
        {initial}
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
