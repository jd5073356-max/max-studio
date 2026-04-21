"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  RefreshCw,
  CalendarClock,
  History,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Zap,
  FolderKanban,
  FileDown,
  Sparkles,
  File,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { TaskForm } from "@/components/tasks/TaskForm";
import { TaskTable } from "@/components/tasks/TaskTable";
import { useTasks } from "@/hooks/useTasks";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiFetch } from "@/lib/api";
import { getGatewayUrl } from "@/store/settings";
import { getToken } from "@/store/auth";
import { cn } from "@/lib/utils";
import type { AgentJob, CreateTaskInput, Task } from "@/types/api";
import type {
  ProjectDoneEvent,
  ProjectErrorEvent,
  ProjectStepEvent,
  WsInboundEvent,
} from "@/types/ws-events";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Job status badge ──────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: {
    icon: Clock,
    label: "Pendiente",
    className: "text-warning bg-warning/10 border-warning/20",
  },
  running: {
    icon: Loader2,
    label: "Ejecutando",
    className: "text-info bg-info/10 border-info/20",
    spin: true,
  },
  done: {
    icon: CheckCircle2,
    label: "Completado",
    className: "text-success bg-success/10 border-success/20",
  },
  error: {
    icon: XCircle,
    label: "Error",
    className: "text-destructive bg-destructive/10 border-destructive/20",
  },
} as const;

function JobStatusBadge({ status }: { status: AgentJob["status"] }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
        cfg.className,
      )}
    >
      <Icon className={cn("h-3 w-3", "spin" in cfg && cfg.spin && "animate-spin")} />
      {cfg.label}
    </span>
  );
}

// ── Jobs list ─────────────────────────────────────────────────────────────────

function JobsView() {
  const [jobs, setJobs] = useState<AgentJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiFetch<AgentJob[]>("/tasks/jobs?limit=50")
      .then((data) => setJobs(Array.isArray(data) ? data : []))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
        {error}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
        <History className="h-8 w-8" />
        <p className="text-sm">Sin ejecuciones registradas todavía.</p>
        <p className="text-xs">Usa "Ejecutar ahora" en una tarea para generar el primer job.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="rounded-lg border border-border bg-card p-3 hover:border-primary/30 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium truncate">{job.title}</p>
                <JobStatusBadge status={job.status} />
                {job.service && (
                  <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {job.service}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Creado {formatDate(job.created_at)}
                {job.executed_at && ` · Ejecutado ${formatDate(job.executed_at)}`}
              </p>
              {job.result && (
                <p className="mt-1.5 line-clamp-2 rounded bg-surface-2 px-2 py-1 text-[11px] text-muted-foreground font-mono">
                  {job.result}
                </p>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Modo Proyecto ─────────────────────────────────────────────────────────────

type ProjectStep = {
  step: number;
  action: string;
  label: string;
  status: "running" | "done" | "error";
  result?: string;
};

type ProjectState =
  | { phase: "idle" }
  | { phase: "running"; projectId: string; steps: ProjectStep[] }
  | { phase: "done"; projectId: string; steps: ProjectStep[]; summary: string; files: ProjectDoneEvent["files"]; zipReady: boolean }
  | { phase: "error"; detail: string };

function ProjectView() {
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<ProjectState>({ phase: "idle" });
  const stepsRef = useRef<HTMLDivElement>(null);

  const handleWsEvent = useCallback((event: WsInboundEvent) => {
    if (event.type === "project.step") {
      const e = event as ProjectStepEvent;
      setState((s) => {
        if (s.phase !== "running" || s.projectId !== e.project_id) return s;
        const existing = s.steps.findIndex((x) => x.step === e.step);
        const updated: ProjectStep = { step: e.step, action: e.action, label: e.label, status: e.status, result: e.result };
        const steps = existing >= 0
          ? s.steps.map((x, i) => i === existing ? updated : x)
          : [...s.steps, updated];
        return { ...s, steps };
      });
      // Auto-scroll
      setTimeout(() => stepsRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 50);
    }
    if (event.type === "project.done") {
      const e = event as ProjectDoneEvent;
      setState((s) => {
        if (s.phase !== "running" || s.projectId !== e.project_id) return s;
        return { phase: "done", projectId: e.project_id, steps: s.steps, summary: e.summary, files: e.files, zipReady: e.zip_ready };
      });
    }
    if (event.type === "project.error") {
      const e = event as ProjectErrorEvent;
      setState((s) => {
        if (s.phase !== "running" || s.projectId !== e.project_id) return s;
        return { phase: "error", detail: e.detail };
      });
    }
  }, []);

  useWebSocket(handleWsEvent);

  const submit = async () => {
    const text = prompt.trim();
    if (!text || state.phase === "running") return;
    setState({ phase: "running", projectId: "", steps: [] });
    try {
      const res = await apiFetch<{ project_id: string; message: string }>("/kimi/project", {
        method: "POST",
        body: { prompt: text },
      });
      setState({ phase: "running", projectId: res.project_id, steps: [] });
    } catch (e) {
      setState({ phase: "error", detail: e instanceof Error ? e.message : "Error al iniciar proyecto" });
    }
  };

  const downloadUrl = (projectId: string) => {
    const base = getGatewayUrl();
    const token = getToken();
    return `${base}/kimi/project/${projectId}/download${token ? `?token=${token}` : ""}`;
  };

  const reset = () => { setState({ phase: "idle" }); setPrompt(""); };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Descripción */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Describe tu proyecto</span>
          <span className="ml-auto text-[10px] text-muted-foreground">Kimi K2.6 · 300 sub-agentes</span>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          disabled={state.phase === "running"}
          placeholder={`Ej: "Crea 5 scripts Python para scraping de productos de MercadoLibre con distintas categorías. Incluye README y requirements.txt."`}
          className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
        />
        <div className="flex gap-2">
          <Button
            onClick={submit}
            disabled={!prompt.trim() || state.phase === "running"}
            className="gap-2"
          >
            {state.phase === "running"
              ? <><Loader2 className="h-4 w-4 animate-spin" />Ejecutando…</>
              : <><Sparkles className="h-4 w-4" />Iniciar proyecto</>}
          </Button>
          {state.phase !== "idle" && state.phase !== "running" && (
            <Button variant="outline" onClick={reset}>Nuevo proyecto</Button>
          )}
        </div>
      </div>

      {/* Progress */}
      {(state.phase === "running" || state.phase === "done") && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="text-xs font-medium">Progreso en tiempo real</span>
            {state.phase === "running" && (
              <span className="flex items-center gap-1 text-[10px] text-primary">
                <Loader2 className="h-3 w-3 animate-spin" />Kimi trabajando…
              </span>
            )}
            {state.phase === "done" && (
              <span className="text-[10px] text-success flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />Completado
              </span>
            )}
          </div>
          <div ref={stepsRef} className="max-h-64 overflow-y-auto divide-y divide-border">
            {state.steps.length === 0 && (
              <div className="flex items-center gap-2 px-4 py-3 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />Planificando…
              </div>
            )}
            {state.steps.map((step) => (
              <div key={step.step} className="flex items-start gap-3 px-4 py-2.5">
                <div className="mt-0.5 shrink-0">
                  {step.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-info" />}
                  {step.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                  {step.status === "error" && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <File className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs font-medium truncate">{step.label}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">{step.action}</span>
                  </div>
                  {step.result && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground font-mono truncate">{step.result}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resultado final */}
      {state.phase === "done" && (
        <div className="rounded-lg border border-success/30 bg-success/5 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-success">
              ✅ {state.files.length} archivo{state.files.length !== 1 ? "s" : ""} generado{state.files.length !== 1 ? "s" : ""}
            </span>
            {state.zipReady && (
              <a href={downloadUrl(state.projectId)} download>
                <Button size="sm" className="gap-1.5 h-7 text-xs">
                  <FileDown className="h-3.5 w-3.5" />Descargar ZIP
                </Button>
              </a>
            )}
          </div>

          {/* Lista de archivos */}
          <ul className="space-y-1">
            {state.files.map((f) => (
              <li key={f.filename} className="flex items-center gap-2 text-xs text-muted-foreground">
                <File className="h-3 w-3 shrink-0" />
                <span className="font-mono">{f.filename}</span>
                <span className="text-[10px]">· {(f.size / 1024).toFixed(1)} KB</span>
                {f.description && <span className="text-[10px] truncate">— {f.description}</span>}
              </li>
            ))}
          </ul>

          {/* Resumen de Kimi */}
          {state.summary && (
            <div className="rounded-md bg-background border border-border p-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {state.summary}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {state.phase === "error" && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 px-4 py-3">
          <p className="text-xs text-destructive font-medium">Error</p>
          <p className="text-xs text-destructive/80 mt-0.5">{state.detail}</p>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "scheduled" | "jobs" | "project";

export default function TasksPage() {
  const {
    tasks,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    runNow,
    toggleStatus,
  } = useTasks();

  const [tab, setTab] = useState<Tab>("scheduled");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setFormOpen(true);
  };

  const handleSubmit = async (input: CreateTaskInput) => {
    if (editing) {
      await update(editing.id, input);
    } else {
      await create(input);
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <div>
          <h1 className="text-base font-semibold">Tareas</h1>
          <p className="text-xs text-muted-foreground">
            Recordatorios, rutinas e historial de ejecuciones.
          </p>
        </div>
        <div className="flex gap-2">
          {tab === "scheduled" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={refresh}
                disabled={loading}
                aria-label="Refrescar"
              >
                <RefreshCw
                  className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
                />
              </Button>
              <Button size="sm" onClick={openCreate}>
                <Plus className="h-3.5 w-3.5" />
                Nueva tarea
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border bg-background px-6">
        <button
          type="button"
          onClick={() => setTab("scheduled")}
          className={cn(
            "flex items-center gap-1.5 border-b-2 px-1 pb-2 pt-2.5 text-xs font-medium transition-colors",
            tab === "scheduled"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <CalendarClock className="h-3.5 w-3.5" />
          Programadas
          {tasks.length > 0 && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
              {tasks.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab("jobs")}
          className={cn(
            "ml-4 flex items-center gap-1.5 border-b-2 px-1 pb-2 pt-2.5 text-xs font-medium transition-colors",
            tab === "jobs"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Zap className="h-3.5 w-3.5" />
          Historial de jobs
        </button>
        <button
          type="button"
          onClick={() => setTab("project")}
          className={cn(
            "ml-4 flex items-center gap-1.5 border-b-2 px-1 pb-2 pt-2.5 text-xs font-medium transition-colors",
            tab === "project"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <FolderKanban className="h-3.5 w-3.5" />
          Proyecto
          <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px] text-primary font-bold">K2.6</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "scheduled" && (
          <>
            {error && (
              <div className="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
            <TaskTable
              tasks={tasks}
              loading={loading}
              onEdit={openEdit}
              onDelete={remove}
              onToggle={toggleStatus}
              onRunNow={runNow}
            />
          </>
        )}
        {tab === "jobs" && <JobsView />}
        {tab === "project" && <ProjectView />}
      </div>

      <TaskForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
