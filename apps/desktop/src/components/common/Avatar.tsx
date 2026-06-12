interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  online?: boolean;
}

const colors = ["#4f9cf7", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#ec4899"];

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

export function Avatar({ name, size = "md", online }: AvatarProps) {
  const sizeClass = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-12 h-12 text-lg" : "w-10 h-10 text-sm";
  const color = colors[hashCode(name) % colors.length];
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="relative flex-shrink-0">
      <div
        className={`${sizeClass} rounded-lg flex items-center justify-center text-white font-bold`}
        style={{ backgroundColor: color }}
      >
        {initial}
      </div>
      {online !== undefined && (
        <div
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
            online ? "bg-green-500" : "bg-gray-400"
          }`}
        />
      )}
    </div>
  );
}
