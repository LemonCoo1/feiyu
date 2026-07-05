import { type ReactNode } from "react";

interface NavItemProps {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-10 h-10 rounded-feiyu-md flex flex-col items-center justify-center gap-0.5 transition-colors ${
        active
          ? "bg-feiyu-primary-light text-feiyu-primary"
          : "text-feiyu-text-muted hover:bg-feiyu-surface-container-high hover:text-feiyu-text-secondary"
      }`}
    >
      <span className="leading-none">{icon}</span>
      <span className="text-eyebrow leading-none">{label}</span>
    </button>
  );
}
