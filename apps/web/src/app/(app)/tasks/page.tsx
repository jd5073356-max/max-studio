import { CalendarClock } from "lucide-react";

export default function TasksPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <CalendarClock className="h-10 w-10 text-muted-foreground" aria-hidden />
      <div>
        <h2 className="text-base font-semibold">Tareas programadas</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pendiente Step 7 — CRUD + cron builder.
        </p>
      </div>
    </div>
  );
}
