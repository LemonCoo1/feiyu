const KEY = "serverUrl";
const DEFAULT_URL = "http://localhost:3000";

export function getServerUrl(): string {
  try {
    return localStorage.getItem(KEY) || DEFAULT_URL;
  } catch {
    return DEFAULT_URL;
  }
}

export function setServerUrl(url: string): void {
  localStorage.setItem(KEY, normalizeServerUrl(url));
}

export function getDefaultServerUrl(): string {
  return DEFAULT_URL;
}

export function validateServerUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return "empty";
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "protocol";
    }
    return null;
  } catch {
    return "invalid";
  }
}

export function normalizeServerUrl(url: string): string {
  return url.trim().replace(/\/+$/, "");
}
