import { useEffect } from "react";
import { wsClient } from "../services/ws";
import { useChatStore } from "../stores/chatStore";
import { useContactStore } from "../stores/contactStore";
import { useChannelStore } from "../stores/channelStore";

function sendBrowserNotification(title: string, body: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission === "granted") {
    new Notification(title, { body });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") new Notification(title, { body });
    });
  }
}

export function useWebSocket() {
  const addIncomingMessage = useChatStore((s) => s.addIncomingMessage);
  const updatePresence = useContactStore((s) => s.updatePresence);
  const addChannelMessage = useChannelStore((s) => s.addIncomingMessage);

  useEffect(() => {
    const handleDeliver = (payload: any) => {
      addIncomingMessage(payload.message);
      const activeConvId = useChatStore.getState().activeConversationId;
      if (payload.message.conversation_id !== activeConvId) {
        const content = payload.message.content;
        const text = typeof content === "object" && content.text
          ? content.text
          : "收到新消息";
        sendBrowserNotification("新消息", text);
      }
    };

    const handleAck = (payload: any) => {
      console.log("Message ACK:", payload);
    };

    const handlePresence = (payload: any) => {
      updatePresence(payload.user_id, payload.status);
    };

    const handleChannelDeliver = (payload: any) => {
      addChannelMessage(payload.message);
      const activeChannelId = useChannelStore.getState().activeChannelId;
      if (payload.channel_id !== activeChannelId) {
        const content = payload.message.content;
        const text = typeof content === "object" && content.text
          ? content.text
          : "收到新频道消息";
        sendBrowserNotification("频道消息", text);
      }
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
