"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { TaskForm } from "@/components/tasks/TaskForm";
import { TaskTable } from "@/components/tasks/TaskTable";
import { useTasks } from "@/hooks/useTasks";
import { apiFetch } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { AgentJob, CreateTaskInput, Task } from "@/types/api";

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

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = "scheduled" | "jobs";

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
