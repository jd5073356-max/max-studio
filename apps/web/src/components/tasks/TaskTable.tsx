"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Play, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Task } from "@/types/api";

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"] as const;

function formatDays(days: number[]): string {
  if (!days || days.length === 0) return "—";
  if (days.length === 7) return "Todos";
  // L-V
  if (
    days.length === 5 &&
    [0, 1, 2, 3, 4].every((d) => days.includes(d))
  )
    return "L-V";
  if (days.length === 2 && days.includes(5) && days.includes(6))
    return "Fin de semana";
  return days
    .slice()
    .sort()
    .map((d) => DAY_LABELS[d])
    .join(" ");
}

function formatTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function formatNextRun(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 60) return `en ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `en ${diffH} h`;
  return d.toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  tasks: Task[];
  loading: boolean;
  onEdit: (task: Task) => void;
  onDelete: (id: string) => Promise<void>;
  onToggle: (task: Task) => Promise<unknown>;
  onRunNow: (id: string) => Promise<unknown>;
}

export function TaskTable({
  tasks,
  loading,
  onEdit,
  onDelete,
  onToggle,
  onRunNow,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);

  const handleDelete = async (task: Task) => {
    if (!confirm(`¿Borrar "${task.title}"?`)) return;
    setBusyId(task.id);
    try {
      await onDelete(task.id);
      toast.success("Tarea borrada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error borrando");
    } finally {
      setBusyId(null);
    }
  };

  const handleRun = async (task: Task) => {
    setBusyId(task.id);
    try {
      await onRunNow(task.id);
      toast.success(`"${task.title}" encolada ahora`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error encolando");
    } finally {
      setBusyId(null);
    }
  };

  const handleToggle = async (task: Task) => {
    setBusyId(task.id);
    try {
      await onToggle(task);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  if (loading && tasks.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Cargando tareas…
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-center text-sm text-muted-foreground">
        Sin tareas programadas aún.
        <br />
        Crea la primera para que MAX te recuerde cosas.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40%]">Tarea</TableHead>
            <TableHead>Horario</TableHead>
            <TableHead>Días</TableHead>
            <TableHead>Próximo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tasks.map((t) => {
            const active = t.status === "active";
            const busy = busyId === t.id;
            return (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="font-medium text-foreground">{t.title}</div>
                  {t.message && (
                    <div className="mt-0.5 max-w-md truncate text-xs text-muted-foreground">
                      {t.message}
                    </div>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {formatTime(t.hour, t.minute)}
                </TableCell>
                <TableCell className="text-xs">
                  {formatDays(t.days)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatNextRun(t.next_run)}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={active}
                      disabled={busy || t.status === "archived"}
                      onCheckedChange={() => handleToggle(t)}
                    />
                    <Badge
                      variant={active ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {t.status}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => handleRun(t)}
                      disabled={busy}
                      aria-label="Ejecutar ahora"
                      title="Ejecutar ahora"
                    >
                      <Play className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => onEdit(t)}
                      disabled={busy}
                      aria-label="Editar"
                      title="Editar"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => handleDelete(t)}
                      disabled={busy}
                      aria-label="Borrar"
                      title="Borrar"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
