import { useEffect } from "react";
import { wsClient } from "../services/ws";
import { useChatStore } from "../stores/chatStore";
import { useContactStore } from "../stores/contactStore";

export function useWebSocket() {
  const addIncomingMessage = useChatStore((s) => s.addIncomingMessage);
  const updatePresence = useContactStore((s) => s.updatePresence);

  useEffect(() => {
    const handleDeliver = (payload: any) => {
      addIncomingMessage(payload.message);
    };

    const handleAck = (payload: any) => {
      console.log("Message ACK:", payload);
    };

    const handlePresence = (payload: any) => {
      updatePresence(payload.user_id, payload.status);
    };

    wsClient.on("message.deliver", handleDeliver);
    wsClient.on("message.ack", handleAck);
    wsClient.on("presence.update", handlePresence);

    return () => {
      wsClient.off("message.deliver", handleDeliver);
      wsClient.off("message.ack", handleAck);
      wsClient.off("presence.update", handlePresence);
    };
  }, [addIncomingMessage, updatePresence]);
}
