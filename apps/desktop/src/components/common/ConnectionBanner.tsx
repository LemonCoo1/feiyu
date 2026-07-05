import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { ConnectionStatus } from "../../services/ws";

interface Props {
  status: ConnectionStatus;
}

export function ConnectionBanner({ status }: Props) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (status === "disconnected" || status === "connecting") {
      setVisible(true);
      setShowReconnected(false);
    } else if (status === "connected") {
      if (visible) {
        setShowReconnected(true);
        const timer = setTimeout(() => {
          setVisible(false);
          setShowReconnected(false);
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [status]);

  if (!visible) return null;

  const bgClass = showReconnected
    ? "bg-feiyu-success"
    : status === "connecting"
      ? "bg-feiyu-warning"
      : "bg-feiyu-danger";

  const text = showReconnected
    ? t("connection.connected")
    : status === "connecting"
      ? t("connection.connecting")
      : t("connection.disconnected");

  return (
    <div className={`${bgClass} text-white text-xs text-center py-1.5 z-50 transition-all h-8`}>
      {text}
    </div>
  );
}
