type MessageHandler = (data: any) => void;
export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

class WsClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, MessageHandler[]> = new Map();
  private token: string | null = null;

  private _status: ConnectionStatus = 'disconnected';
  private statusHandlers: ((status: ConnectionStatus) => void)[] = [];

  private reconnectAttempt = 0;
  private reconnectTimer: number | null = null;
  private readonly MAX_RECONNECT_DELAY = 30000;

  private pingInterval: number | null = null;
  private pongTimeout: number | null = null;
  private readonly PING_INTERVAL = 30000;
  private readonly PONG_TIMEOUT = 10000;

  private sendQueue: any[] = [];
  private readonly MAX_QUEUE_SIZE = 100;

  private _isConnected = false;

  private getReconnectDelay(): number {
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempt), this.MAX_RECONNECT_DELAY);
    return delay;
  }

  private setStatus(status: ConnectionStatus) {
    if (this._status === status) return;
    this._status = status;
    this._isConnected = status === 'connected';
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }

  onStatusChange(handler: (status: ConnectionStatus) => void) {
    this.statusHandlers.push(handler);
  }

  offStatusChange(handler: (status: ConnectionStatus) => void) {
    this.statusHandlers = this.statusHandlers.filter(h => h !== handler);
  }

  getStatus(): ConnectionStatus {
    return this._status;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(token: string) {
    this.token = token;
    this.doConnect();
  }

  private doConnect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.setStatus('connecting');

    const httpBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
    const wsBase = httpBase.replace(/^http/, "ws");
    this.ws = new WebSocket(`${wsBase}/api/ws`);

    this.ws.onopen = () => {
      this.send({ type: "auth.token", payload: { token: this.token } });
      this.setStatus('connected');
      this.reconnectAttempt = 0;

      // flush 发送队列
      while (this.sendQueue.length > 0) {
        const msg = this.sendQueue.shift();
        this.ws?.send(JSON.stringify(msg));
      }

      // 启动心跳
      this.startPing();
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // 处理 pong 响应
        if (data.type === 'pong') {
          this.handlePong();
          return;
        }

        const type = data.type;
        const handlers = this.handlers.get(type) || [];
        handlers.forEach((h) => h(data.payload));
      } catch (e) {
        console.error("WS parse error:", e);
      }
    };

    this.ws.onclose = () => {
      this.stopPing();
      this.setStatus('disconnected');

      if (this.token) {
        const delay = this.getReconnectDelay();
        this.reconnectTimer = window.setTimeout(() => {
          this.reconnectAttempt++;
          this.doConnect();
        }, delay);
      }
    };

    this.ws.onerror = (e) => {
      console.error("WS error:", e);
    };
  }

  private startPing() {
    this.stopPing();
    this.pingInterval = window.setInterval(() => {
      this.ws?.send(JSON.stringify({ type: 'ping' }));
      this.pongTimeout = window.setTimeout(() => {
        console.warn('WS pong timeout, closing connection');
        this.ws?.close();
      }, this.PONG_TIMEOUT);
    }, this.PING_INTERVAL);
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  private handlePong() {
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
  }

  disconnect() {
    this.token = null;
    this.stopPing();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.sendQueue = [];
    this.ws?.close();
    this.ws = null;
    this.setStatus('disconnected');
  }

  send(data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      if (this.sendQueue.length < this.MAX_QUEUE_SIZE) {
        this.sendQueue.push(data);
      }
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
