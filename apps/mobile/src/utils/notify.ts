import { useSettingsStore } from "../stores/settingsStore";

function shouldNotify(): boolean {
  const s = useSettingsStore.getState().settings;
  if (!s.notify_message) return false;
  if (s.notify_dnd && isInDndPeriod(s.notify_dnd_start, s.notify_dnd_end)) return false;
  return true;
}

function isInDndPeriod(start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const now = new Date();
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (startMin <= endMin) {
    return nowMin >= startMin && nowMin < endMin;
  }
  return nowMin >= startMin || nowMin < endMin;
}

export function notifyDesktop(title: string, body: string) {
  if (!shouldNotify()) return;
  const s = useSettingsStore.getState().settings;
  if (!s.notify_desktop) return;
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") new Notification(title, { body });
    });
  }
}

export function playNotificationSound() {
  if (!shouldNotify()) return;
  const s = useSettingsStore.getState().settings;
  if (!s.notify_sound) return;
  try {
    const audio = new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=");
    audio.volume = 0.3;
    audio.play().catch(() => {});
  } catch {}
}
