import { appDataDir, join } from "@tauri-apps/api/path";
import { writeFile } from "@tauri-apps/plugin-fs";

type LogEntry = {
  time: string;
  level: "info" | "error" | "warn";
  msg: string;
};

const listeners = new Set<(entry: LogEntry) => void>();

// 日志文件路径（惰性初始化）
let logFilePath: string | null = null;
let logInitFailed = false;

async function getLogFilePath(): Promise<string | null> {
  if (logFilePath) return logFilePath;
  if (logInitFailed) return null;
  try {
    const dir = await appDataDir();
    logFilePath = await join(dir, "feiyu.log");
    console.log("[debugLog] 日志路径:", logFilePath);
    return logFilePath;
  } catch (e) {
    console.error("[debugLog] 获取日志路径失败:", e);
    logInitFailed = true;
    return null;
  }
}

function formatLine(entry: LogEntry): string {
  return `[${entry.time}] [${entry.level.toUpperCase()}] ${entry.msg}\n`;
}

// 异步写入日志文件（fire-and-forget，不影响正常流程）
function appendToFile(entry: LogEntry) {
  getLogFilePath().then((path) => {
    if (!path) return;
    const data = new TextEncoder().encode(formatLine(entry));
    writeFile(path, data, { append: true }).catch((e) => {
      console.error("[debugLog] 写入日志文件失败:", path, e);
    });
  });
}

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
  appendToFile(entry);
}

export function addDebugListener(handler: (entry: LogEntry) => void) {
  listeners.add(handler);
  return () => { listeners.delete(handler); };
}

export async function getLogPath(): Promise<string | null> {
  return getLogFilePath();
}

export type { LogEntry };
