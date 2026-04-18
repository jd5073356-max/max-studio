"use client";

import { useEffect, useState, type FormEvent } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { CreateTaskInput, Task } from "@/types/api";

// 0 = Lunes ... 6 = Domingo (alineado con Python weekday())
const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"] as const;
const DAY_NAMES_FULL = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si se pasa, modo edición. Si no, modo creación. */
  initial?: Task | null;
  onSubmit: (input: CreateTaskInput) => Promise<void>;
}

export function TaskForm({ open, onOpenChange, initial, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [hour, setHour] = useState("8");
  const [minute, setMinute] = useState("0");
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4]); // L-V por defecto
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset al abrir — carga defaults o valores iniciales
  useEffect(() => {
    if (!open) return;
    if (initial) {
      setTitle(initial.title);
      setMessage(initial.message ?? "");
      setHour(String(initial.hour));
      setMinute(String(initial.minute));
      setDays(initial.days ?? []);
    } else {
      setTitle("");
      setMessage("");
      setHour("8");
      setMinute("0");
      setDays([0, 1, 2, 3, 4]);
    }
    setError(null);
  }, [open, initial]);

  const toggleDay = (d: number) => {
    setDays((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort(),
    );
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const h = Number(hour);
    const m = Number(minute);
    if (!title.trim()) {
      setError("El título es obligatorio");
      return;
    }
    if (Number.isNaN(h) || h < 0 || h > 23) {
      setError("Hora inválida (0-23)");
      return;
    }
    if (Number.isNaN(m) || m < 0 || m > 59) {
      setError("Minuto inválido (0-59)");
      return;
    }
    if (days.length === 0) {
      setError("Selecciona al menos un día");
      return;
    }

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        message: message.trim(),
        hour: h,
        minute: m,
        days,
      });
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error guardando");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Editar tarea" : "Nueva tarea programada"}
          </DialogTitle>
          <DialogDescription>
            Define qué quieres que MAX recuerde, a qué hora y en qué días.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Título</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Revisar correos de AutoFlow"
              required
              maxLength={200}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-message">Mensaje / instrucción</Label>
            <textarea
              id="task-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              maxLength={2000}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Qué debe hacer/recordarte MAX"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-hour">Hora</Label>
              <Input
                id="task-hour"
                type="number"
                min={0}
                max={23}
                value={hour}
                onChange={(e) => setHour(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-minute">Minuto</Label>
              <Input
                id="task-minute"
                type="number"
                min={0}
                max={59}
                value={minute}
                onChange={(e) => setMinute(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Días</Label>
            <div className="flex gap-1.5">
              {DAY_LABELS.map((lbl, idx) => {
                const active = days.includes(idx);
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    aria-label={DAY_NAMES_FULL[idx]}
                    aria-pressed={active}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-md border text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDays([0, 1, 2, 3, 4])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                L-V
              </button>
              <button
                type="button"
                onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setDays([5, 6])}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Fin de semana
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Guardando…" : initial ? "Actualizar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
