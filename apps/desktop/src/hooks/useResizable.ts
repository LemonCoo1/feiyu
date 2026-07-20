import { useState, useRef, useCallback, useEffect } from "react";

export type ResizeDirection = "horizontal" | "vertical";

interface UseResizableOptions {
  storageKey: string;
  defaultSize: number;
  min: number;
  max: number;
  direction: ResizeDirection;
  invert?: boolean;
}

export function useResizable({
  storageKey,
  defaultSize,
  min,
  max,
  direction,
  invert = false,
}: UseResizableOptions) {
  const [size, setSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved != null) {
        const n = Number(saved);
        if (!Number.isNaN(n) && n >= min && n <= max) return n;
      }
    } catch {}
    return defaultSize;
  });

  const sizeRef = useRef(size);
  sizeRef.current = size;

  const draggingRef = useRef(false);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(0);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      const current = direction === "horizontal" ? e.clientX : e.clientY;
      const rawDelta = current - startPosRef.current;
      const delta = invert ? -rawDelta : rawDelta;
      const next = Math.min(max, Math.max(min, startSizeRef.current + delta));
      if (next !== sizeRef.current) {
        setSize(next);
      }
    };

    const handleUp = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      try {
        localStorage.setItem(storageKey, String(sizeRef.current));
      } catch {}
    };

    document.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, [direction, min, max, storageKey, invert]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      startPosRef.current =
        direction === "horizontal" ? e.clientX : e.clientY;
      startSizeRef.current = sizeRef.current;
      document.body.style.cursor =
        direction === "horizontal" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
    },
    [direction]
  );

  const reset = useCallback(() => {
    setSize(defaultSize);
    try {
      localStorage.setItem(storageKey, String(defaultSize));
    } catch {}
  }, [defaultSize, storageKey]);

  return { size, onMouseDown, reset };
}
