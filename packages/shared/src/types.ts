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
  content_type: "text" | "image" | "file" | "sticker" | "gif";
  content: Record<string, unknown>;
  created_at: string;
}

export interface Conversation {
  id: string;
  type: "direct" | "group";
  name: string | null;
  owner_id?: string;
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
  role: string;
  joined_at: string;
}

export interface MemberWithUser {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  status: string;
  role: string;
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
  content_type: "text" | "image" | "file" | "sticker" | "gif";
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
  content_type: "text" | "image" | "file" | "sticker" | "gif";
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

export interface UserSettings {
  user_id: string;
  notify_message: boolean;
  notify_sound: boolean;
  notify_desktop: boolean;
  notify_dnd: boolean;
  notify_dnd_start: string | null;
  notify_dnd_end: string | null;
  privacy_add_me: "everyone" | "contacts" | "nobody";
  privacy_online_visible: boolean;
  privacy_read_receipt: boolean;
  chat_send_key: "enter" | "ctrl+enter";
  chat_font_size: "small" | "medium" | "large";
  theme: "light" | "dark";
  language: "zh-CN" | "en";
  two_factor_enabled: boolean;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}
