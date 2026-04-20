export type User = {
  id: string;
  email: string;
};

export type LoginResponse = {
  user: User;
  /** JWT devuelto al cliente para enviarlo como Bearer en llamadas cross-origin al gateway */
  access_token: string;
};

export type ApiErrorBody = {
  detail: string;
};

/**
 * Tarea programada — espejo del schema `scheduled_tasks` en Supabase.
 * days: array de enteros 0-6 donde 0=Lunes ... 6=Domingo.
 */
export type Task = {
  id: string;
  title: string;
  message: string;
  hour: number;
  minute: number;
  days: number[];
  status: "active" | "paused" | "archived";
  created_at: string;
  next_run?: string | null;
};

export type CreateTaskInput = {
  title: string;
  message: string;
  hour: number;
  minute: number;
  days: number[];
};

export type UpdateTaskInput = Partial<CreateTaskInput> & {
  status?: Task["status"];
};

/** Job de agent.py (tabla `tasks`). */
export type AgentJob = {
  id: string;
  title: string;
  status: "pending" | "running" | "done" | "error";
  result: string | null;
  scheduled_at: string | null;
  executed_at: string | null;
  service: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

/** Resultado de ejecución en sandbox (POST /sandbox/run). */
export type SandboxResult = {
  stdout: string;
  stderr: string;
  exit_code: number;
  duration_ms: number;
  language: string;
};

/** Entrada del log de conversaciones (tabla `conversations`). */
export type Conversation = {
  id: string;
  engine: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

/** Entrada del RAG store (tabla `knowledge`). */
export type KnowledgeEntry = {
  id: string;
  category: string;
  content: string;
  created_at: string;
};

/** Status del sistema — respuesta de GET /system/status. */
export type SystemStatus = {
  agent: {
    online: boolean;
    last_heartbeat: string | null;
    seconds_since: number | null;
    metadata: Record<string, unknown>;
  };
  services: Array<{
    name: string;
    url: string;
    status: "online" | "offline" | "degraded" | "error";
    http_code: number | null;
    latency_ms: number | null;
    error?: string;
  }>;
  gateway: {
    status: "online";
    checked_at: string;
  };
};
