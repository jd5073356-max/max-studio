"use client";

import { useCallback, useEffect, useState } from "react";

import { apiFetch } from "@/lib/api";
import type {
  CreateTaskInput,
  Task,
  UpdateTaskInput,
} from "@/types/api";

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Task[]>("/tasks");
      setTasks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error cargando tareas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(
    async (input: CreateTaskInput) => {
      const created = await apiFetch<Task>("/tasks", {
        method: "POST",
        body: input,
      });
      await load();
      return created;
    },
    [load],
  );

  const update = useCallback(
    async (id: string, patch: UpdateTaskInput) => {
      const updated = await apiFetch<Task>(`/tasks/${id}`, {
        method: "PATCH",
        body: patch,
      });
      await load();
      return updated;
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      await apiFetch<void>(`/tasks/${id}`, { method: "DELETE" });
      await load();
    },
    [load],
  );

  const runNow = useCallback(
    async (id: string) => {
      return apiFetch<{ enqueued: boolean; job_id: string | null }>(
        `/tasks/${id}/run-now`,
        { method: "POST" },
      );
    },
    [],
  );

  const toggleStatus = useCallback(
    async (task: Task) => {
      const nextStatus: Task["status"] =
        task.status === "active" ? "paused" : "active";
      return update(task.id, { status: nextStatus });
    },
    [update],
  );

  return {
    tasks,
    loading,
    error,
    refresh: load,
    create,
    update,
    remove,
    runNow,
    toggleStatus,
  };
}
