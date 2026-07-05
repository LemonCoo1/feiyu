import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { addDebugListener, type LogEntry } from "../../utils/debugLog";

export function DebugPanel() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [open, setOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return addDebugListener((entry) => {
      setLogs((prev) => [...prev.slice(-99), entry]);
    });
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <div className="fixed bottom-2 right-2 z-[9999]">
      <button
        onClick={() => setOpen(!open)}
        className="bg-feiyu-sidebar text-white text-xs px-2 py-1 rounded-feiyu-md shadow-feiyu-3 opacity-60 hover:opacity-100"
      >
        {open ? t("debug.closeLog") : t("debug.logCount", { count: logs.length })}
      </button>
      {open && (
        <div className="mt-1 w-[420px] max-h-[300px] overflow-y-auto bg-feiyu-sidebar text-feiyu-success text-caption font-mono rounded-feiyu-lg shadow-feiyu-5 p-2 space-y-0.5 select-text cursor-text">
          {logs.length === 0 && <div className="text-feiyu-text-muted">{t("debug.noLogs")}</div>}
          {logs.map((l, i) => (
            <div key={i} className={l.level === "error" ? "text-feiyu-danger" : l.level === "warn" ? "text-feiyu-warning" : "text-feiyu-success"}>
              <span className="text-feiyu-text-muted">{l.time}</span> {l.msg}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
