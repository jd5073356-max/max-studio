"use client";

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TaskForm } from "@/components/tasks/TaskForm";
import { TaskTable } from "@/components/tasks/TaskTable";
import { useTasks } from "@/hooks/useTasks";
import type { CreateTaskInput, Task } from "@/types/api";

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
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <div>
          <h1 className="text-base font-semibold">Tareas programadas</h1>
          <p className="text-xs text-muted-foreground">
            Recordatorios y rutinas que MAX ejecuta por ti.
          </p>
        </div>
        <div className="flex gap-2">
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
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
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
