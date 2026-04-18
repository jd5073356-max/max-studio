import type { WsInboundEvent, WsOutboundEvent } from "@/types/ws-events";

type Listener = (event: WsInboundEvent) => void;

const HEARTBEAT_INTERVAL = 20_000; // 20s
const BASE_DELAY = 1_000; // 1s
const MAX_DELAY = 30_000; // 30s

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private attempt = 0;
  private stopped = false;
  private onStatusChange: (status: "connecting" | "connected" | "disconnected") => void;

  constructor(
    private readonly url: string,
    onStatusChange: (status: "connecting" | "connected" | "disconnected") => void,
  ) {
    this.onStatusChange = onStatusChange;
  }

  connect(): void {
    if (this.stopped) return;
    this.onStatusChange("connecting");
    try {
      this.ws = new WebSocket(this.url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.attempt = 0;
      this.onStatusChange("connected");
      this.startHeartbeat();
    };

    this.ws.onmessage = (ev) => {
      try {
        const event = JSON.parse(ev.data) as WsInboundEvent;
        this.listeners.forEach((fn) => fn(event));
      } catch {
        // mensaje no-JSON ignorado
      }
    };

    this.ws.onclose = () => {
      this.stopHeartbeat();
      this.onStatusChange("disconnected");
      if (!this.stopped) this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  send(event: WsOutboundEvent): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  on(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  disconnect(): void {
    this.stopped = true;
    this.clearReconnect();
    this.stopHeartbeat();
    this.ws?.close(1000);
    this.ws = null;
  }

  private scheduleReconnect(): void {
    const delay = Math.min(BASE_DELAY * 2 ** this.attempt, MAX_DELAY);
    this.attempt++;
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.send({ type: "ping" });
    }, HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
