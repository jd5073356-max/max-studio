// Eventos WebSocket tipados entre PWA ↔ Gateway

// --- Outbound (PWA → Gateway) ---

export type PingEvent = { type: "ping" };
export type ChatSendEvent = { type: "chat.send"; content: string };

export type WsOutboundEvent = PingEvent | ChatSendEvent;

// --- Inbound (Gateway → PWA) ---

export type PongEvent = { type: "pong" };

export type ChatTokenEvent = {
  type: "chat.token";
  session_id: string;
  token: string;
};

export type ChatDoneEvent = {
  type: "chat.done";
  session_id: string;
  model_used: string;
  conversation_id: string;
};

export type ChatErrorEvent = {
  type: "chat.error";
  session_id: string;
  detail: string;
};

export type AgentStatusEvent = {
  type: "agent.status";
  online: boolean;
  agent_id: string;
  metadata?: Record<string, unknown>;
};

export type WsInboundEvent =
  | PongEvent
  | ChatTokenEvent
  | ChatDoneEvent
  | ChatErrorEvent
  | AgentStatusEvent;

export type WsStatus = "connecting" | "connected" | "disconnected";
