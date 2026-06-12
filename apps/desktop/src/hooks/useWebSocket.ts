import { useEffect } from "react";
import { wsClient } from "../services/ws";
import { useChatStore } from "../stores/chatStore";

export function useWebSocket() {
  const addIncomingMessage = useChatStore((s) => s.addIncomingMessage);

  useEffect(() => {
    const handleDeliver = (payload: any) => {
      addIncomingMessage(payload.message);
    };

    const handleAck = (payload: any) => {
      console.log("Message ACK:", payload);
    };

    wsClient.on("message.deliver", handleDeliver);
    wsClient.on("message.ack", handleAck);

    return () => {
      wsClient.off("message.deliver", handleDeliver);
      wsClient.off("message.ack", handleAck);
    };
  }, [addIncomingMessage]);
}
