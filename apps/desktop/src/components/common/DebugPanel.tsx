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
        className="bg-gray-800 text-white text-xs px-2 py-1 rounded-md shadow-lg opacity-60 hover:opacity-100"
      >
        {open ? t("debug.closeLog") : t("debug.logCount", { count: logs.length })}
      </button>
      {open && (
        <div className="mt-1 w-[420px] max-h-[300px] overflow-y-auto bg-gray-900 text-green-400 text-[11px] font-mono rounded-lg shadow-2xl p-2 space-y-0.5 select-text cursor-text">
          {logs.length === 0 && <div className="text-gray-500">{t("debug.noLogs")}</div>}
          {logs.map((l, i) => (
            <div key={i} className={l.level === "error" ? "text-red-400" : l.level === "warn" ? "text-yellow-400" : "text-green-400"}>
              <span className="text-gray-500">{l.time}</span> {l.msg}
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
