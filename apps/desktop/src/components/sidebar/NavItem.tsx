interface NavItemProps {
  icon: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-11 h-11 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors ${
        active
          ? "bg-gray-600 text-feiyu-primary"
          : "text-gray-400 hover:bg-gray-700 hover:text-gray-300"
      }`}
    >
      <span className="text-lg leading-none">{icon}</span>
      <span className="text-[9px] leading-none">{label}</span>
    </button>
  );
}
