import { Activity } from "lucide-react";

export default function SystemPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
      <Activity className="h-10 w-10 text-muted-foreground" aria-hidden />
      <div>
        <h2 className="text-base font-semibold">Estado del sistema</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pendiente Step 8 — heartbeat PC + health checks + latencias.
        </p>
      </div>
    </div>
  );
}
