type LogEntry = {
  time: string;
  level: "info" | "error" | "warn";
  msg: string;
};

const listeners = new Set<(entry: LogEntry) => void>();

export function debugLog(msg: string, level: "info" | "error" | "warn" = "info") {
  const lang = localStorage.getItem("feiyu_language") || "zh-CN";
  const entry: LogEntry = {
    time: new Date().toLocaleTimeString(lang, { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    level,
    msg,
  };
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(`[DEBUG] ${msg}`);
  listeners.forEach((l) => l(entry));
}

export function addDebugListener(handler: (entry: LogEntry) => void) {
  listeners.add(handler);
  return () => { listeners.delete(handler); };
}

export type { LogEntry };
