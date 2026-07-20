import type { ResizeDirection } from "../../hooks/useResizable";

interface ResizeHandleProps {
  direction: ResizeDirection;
  onMouseDown: (e: React.MouseEvent) => void;
}

export function ResizeHandle({ direction, onMouseDown }: ResizeHandleProps) {
  const isHorizontal = direction === "horizontal";
  return (
    <div
      onMouseDown={onMouseDown}
      onDoubleClick={(e) => e.preventDefault()}
      role="separator"
      aria-orientation={isHorizontal ? "vertical" : "horizontal"}
      className={`group relative flex-shrink-0 bg-feiyu-border transition-colors hover:bg-feiyu-primary/60 ${
        isHorizontal
          ? "w-px cursor-col-resize"
          : "h-px cursor-row-resize"
      }`}
    >
      <div
        className={`absolute z-10 ${
          isHorizontal
            ? "w-1 h-full -translate-x-1/2 left-1/2"
            : "h-1 w-full -translate-y-1/2 top-1/2"
        }`}
      />
    </div>
  );
}
