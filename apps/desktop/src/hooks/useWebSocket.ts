import { useEffect } from "react";
import { wsClient } from "../services/ws";
import { useChatStore } from "../stores/chatStore";
import { useContactStore } from "../stores/contactStore";
import { useChannelStore } from "../stores/channelStore";

export function useWebSocket() {
  const addIncomingMessage = useChatStore((s) => s.addIncomingMessage);
  const updatePresence = useContactStore((s) => s.updatePresence);
  const addChannelMessage = useChannelStore((s) => s.addIncomingMessage);

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

    const handleChannelDeliver = (payload: any) => {
      addChannelMessage(payload.message);
    };

    wsClient.on("message.deliver", handleDeliver);
    wsClient.on("message.ack", handleAck);
    wsClient.on("presence.update", handlePresence);
    wsClient.on("channel.message.deliver", handleChannelDeliver);

    return () => {
      wsClient.off("message.deliver", handleDeliver);
      wsClient.off("message.ack", handleAck);
      wsClient.off("presence.update", handlePresence);
      wsClient.off("channel.message.deliver", handleChannelDeliver);
    };
  }, [addIncomingMessage, updatePresence, addChannelMessage]);
}
