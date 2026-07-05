interface AvatarProps {
  name: string;
  url?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  online?: boolean;
}

// 400 级饱和色：深色侧边栏上足够亮，浅色会话列表上足够饱和，白色文字清晰可读
const colors = [
  "#3b82f6", // blue-500
  "#10b981", // emerald-500
  "#f59e0b", // amber-500
  "#06b6d4", // cyan-500
  "#f43f5e", // rose-500
  "#8b5cf6", // violet-500
];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function Avatar({ name, url, size = "md", online }: AvatarProps) {
  const sizeMap = {
    sm: "w-6 h-6 text-eyebrow",
    md: "w-9 h-9 text-sm",
    lg: "w-12 h-12 text-lg",
    xl: "w-16 h-16 text-2xl",
  };
  const dotSizeMap = {
    sm: "w-2 h-2 border-[1.5px]",
    md: "w-2.5 h-2.5 border-2",
    lg: "w-3 h-3 border-2",
    xl: "w-3.5 h-3.5 border-2",
  };
  const color = colors[hashCode(name) % colors.length];
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="relative flex-shrink-0">
      {url ? (
        <img
          src={url}
          alt={name}
          className={`${sizeMap[size]} rounded-full object-cover`}
        />
      ) : (
        <div
          className={`${sizeMap[size]} rounded-full flex items-center justify-center text-white font-semibold`}
          style={{ backgroundColor: color }}
        >
          {initial}
        </div>
      )}
      {online !== undefined && (
        <div
          className={`absolute bottom-0 right-0 ${dotSizeMap[size]} rounded-full border-feiyu-surface ${
            online ? "bg-feiyu-success" : "bg-feiyu-text-muted"
          }`}
        />
      )}
    </div>
  );
}
