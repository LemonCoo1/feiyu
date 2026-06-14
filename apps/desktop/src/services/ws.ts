type MessageHandler = (data: any) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private token: string | null = null;
  private reconnectTimer: number | null = null;

  connect(token: string) {
    this.token = token;
    this.doConnect();
  }

  private doConnect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const httpBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
    const wsBase = httpBase.replace(/^http/, "ws");
    this.ws = new WebSocket(`${wsBase}/api/ws`);

    this.ws.onopen = () => {
      this.send({ type: "auth.token", payload: { token: this.token } });
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const type = data.type;
        const handlers = this.handlers.get(type) || [];
        handlers.forEach((h) => h(data.payload));
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    this.ws.onclose = () => {
      if (this.token) {
        this.reconnectTimer = window.setTimeout(() => this.doConnect(), 3000);
      }
    };

    this.ws.onerror = (e) => {
      console.error("WS error:", e);
    };
  }

  disconnect() {
    this.token = null;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    this.ws?.close();
    this.ws = null;
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  off(type: string, handler: MessageHandler) {
    const handlers = this.handlers.get(type) || [];
    this.handlers.set(
      type,
      handlers.filter((h) => h !== handler)
    );
  }

  sendMessage(conversationId: string, contentType: string, content: any) {
    this.send({
      type: "message.send",
      payload: {
        conversation_id: conversationId,
        content_type: contentType,
        content,
        client_msg_id: crypto.randomUUID(),
      },
    });
  }

  sendRead(conversationId: string, messageId: string) {
    this.send({
      type: "message.read",
      payload: {
        conversation_id: conversationId,
        message_id: messageId,
      },
    });
  }
}

export const wsClient = new WsClient();
