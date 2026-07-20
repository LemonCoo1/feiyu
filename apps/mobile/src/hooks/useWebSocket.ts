import { useEffect, useState } from "react";
import i18n from "../i18n";
import { wsClient } from "../services/ws";
import type { ConnectionStatus } from "../services/ws";
import { useChatStore } from "../stores/chatStore";
import { useContactStore } from "../stores/contactStore";
import { useChannelStore } from "../stores/channelStore";
import { useSettingsStore } from "../stores/settingsStore";
import { notifyDesktop, playNotificationSound } from "../utils/notify";

export function useWebSocket() {
  const addIncomingMessage = useChatStore((s) => s.addIncomingMessage);
  const updateLastRead = useChatStore((s) => s.updateLastRead);
  const addConversation = useChatStore((s) => s.addConversation);
  const updatePresence = useContactStore((s) => s.updatePresence);
  const addChannelMessage = useChannelStore((s) => s.addIncomingMessage);

  useEffect(() => {
    const handleDeliver = (payload: any) => {
      const msg = payload.message;
      addIncomingMessage(msg);
      const activeConvId = useChatStore.getState().activeConversationId;
      if (payload.message.conversation_id !== activeConvId) {
        const content = payload.message.content;
        const text = typeof content === "object" && content.text
          ? content.text
          : i18n.t("notification.newMessageBody");
        notifyDesktop(i18n.t("notification.newMessage"), text);
        playNotificationSound();
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
          : i18n.t("notification.channelMessageBody");
        notifyDesktop(i18n.t("notification.channelMessage"), text);
        playNotificationSound();
      }
    };

    const handleReadNotify = (payload: any) => {
      const s = useSettingsStore.getState().settings;
      if (!s.privacy_read_receipt) return;
      // 传递 user_id 以便群聊中更新已读回执
      updateLastRead(payload.conversation_id, payload.message_id, payload.user_id);
    };

    const handleMessageRecalled = (payload: { message_id: string; conversation_id: string; user_id: string }) => {
      const chatState = useChatStore.getState();
      const msgs = chatState.messages.get(payload.conversation_id);
      if (!msgs) return;
      const updatedMsgs = msgs.map((m) =>
        m.id === payload.message_id ? { ...m, recalled: true } : m
      );
      useChatStore.setState((state) => {
        const newMessages = new Map(state.messages);
        newMessages.set(payload.conversation_id, updatedMsgs);
        return { messages: newMessages };
      });
    };

    const handleConversationCreated = (payload: any) => {
      addConversation(payload.conversation);
    };

    wsClient.on("message.deliver", handleDeliver);
    wsClient.on("message.ack", handleAck);
    wsClient.on("presence.update", handlePresence);
    wsClient.on("channel.message.deliver", handleChannelDeliver);
    wsClient.on("message.read", handleReadNotify);
    wsClient.on("message.recalled", handleMessageRecalled);
    wsClient.on("conversation.created", handleConversationCreated);

    return () => {
      wsClient.off("message.deliver", handleDeliver);
      wsClient.off("message.ack", handleAck);
      wsClient.off("presence.update", handlePresence);
      wsClient.off("channel.message.deliver", handleChannelDeliver);
      wsClient.off("message.read", handleReadNotify);
      wsClient.off("message.recalled", handleMessageRecalled);
      wsClient.off("conversation.created", handleConversationCreated);
    };
  }, [addIncomingMessage, updateLastRead, updatePresence, addChannelMessage, addConversation]);
}

export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connected');

  useEffect(() => {
    wsClient.onStatusChange(setStatus);
    return () => wsClient.offStatusChange(setStatus);
  }, []);

  return status;
}
