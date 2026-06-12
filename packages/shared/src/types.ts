export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  status: "online" | "offline" | "away";
  created_at: string;
  updated_at: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  display_name?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content_type: "text" | "image" | "file";
  content: Record<string, unknown>;
  created_at: string;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  name: string | null;
  created_at: string;
}

export interface Channel {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export type WsMessageType =
  | "auth.token"
  | "auth.ok"
  | "message.send"
  | "message.deliver"
  | "message.ack"
  | "message.read"
  | "typing.start"
  | "typing.stop"
  | "presence.update"
  | "channel.join"
  | "channel.leave";

export interface WsMessage<T = unknown> {
  type: WsMessageType;
  payload: T;
  request_id?: string;
  timestamp: number;
}

// === Phase 2: 会话与消息 ===

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  joined_at: string;
}

export interface CreateConversationRequest {
  type: "direct" | "group";
  name?: string;
  member_ids: string[];
}

export interface ConversationWithLastMessage extends Conversation {
  last_message: Message | null;
  unread_count: number;
  other_user?: User;
}

export interface SendMessageRequest {
  conversation_id: string;
  content_type: "text" | "image" | "file";
  content: Record<string, unknown>;
}

export interface WsAuthPayload {
  token: string;
}

export interface WsAuthOkPayload {
  user_id: string;
}

export interface WsMessageSendPayload {
  conversation_id: string;
  content_type: "text" | "image" | "file";
  content: Record<string, unknown>;
  client_msg_id: string;
}

export interface WsMessageDeliverPayload {
  message: Message;
  conversation_id: string;
}

export interface WsMessageAckPayload {
  client_msg_id: string;
  server_msg_id: string;
  conversation_id: string;
}

export interface WsPresencePayload {
  user_id: string;
  status: "online" | "offline" | "away";
}
