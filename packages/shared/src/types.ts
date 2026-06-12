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
