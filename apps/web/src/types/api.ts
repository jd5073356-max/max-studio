export type User = {
  id: string;
  email: string;
};

export type LoginResponse = {
  user: User;
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
