type LogLevel = "info" | "warn" | "error";

const logs: Array<{ timestamp: string; level: LogLevel; message: string }> = [];
const MAX_LOGS = 200;

export function debugLog(message: string, level: LogLevel = "info") {
  const timestamp = new Date().toISOString();
  const entry = { timestamp, level, message };
  
  logs.push(entry);
  if (logs.length > MAX_LOGS) {
    logs.shift();
  }

  if (level === "error") {
    console.error(`[DEBUG] ${message}`);
  } else if (level === "warn") {
    console.warn(`[DEBUG] ${message}`);
  } else {
    console.log(`[DEBUG] ${message}`);
  }
}

export function getLogs() {
  return [...logs];
}

export function clearLogs() {
  logs.length = 0;
}
