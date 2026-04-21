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

export type TaskAutoCreatedEvent = {
  type: "task.auto_created";
  task_id: string;
  title: string;
  schedule: string; // e.g. "Lun, Mié · 09:00"
};

export type ProjectStepEvent = {
  type: "project.step";
  project_id: string;
  step: number;
  action: "create_file" | "run_code" | string;
  label: string;
  status: "running" | "done" | "error";
  result?: string;
};

export type ProjectDoneEvent = {
  type: "project.done";
  project_id: string;
  summary: string;
  files: Array<{ filename: string; size: number; description: string }>;
  zip_ready: boolean;
  rounds: number;
};

export type ProjectErrorEvent = {
  type: "project.error";
  project_id: string;
  detail: string;
};

export type WsInboundEvent =
  | PongEvent
  | ChatTokenEvent
  | ChatDoneEvent
  | ChatErrorEvent
  | AgentStatusEvent
  | TaskAutoCreatedEvent
  | ProjectStepEvent
  | ProjectDoneEvent
  | ProjectErrorEvent;

export type WsStatus = "connecting" | "connected" | "disconnected";
