"use client";

import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AgentStatus } from "@/components/system/AgentStatus";
import { ServiceGrid } from "@/components/system/ServiceGrid";
import { useSystemStatus } from "@/hooks/useSystemStatus";

export default function SystemPage() {
  const { data, loading, error, refresh } = useSystemStatus(true);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-border bg-background px-6 py-4">
        <div>
          <h1 className="text-base font-semibold">Estado del sistema</h1>
          <p className="text-xs text-muted-foreground">
            Agente PC + servicios MAX · auto-refresh cada 15s
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={loading}
        >
          <RefreshCw
            className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
          />
          Refrescar
        </Button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6">
        {error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Agente local
          </h2>
          <div className="max-w-md">
            <AgentStatus agent={data?.agent} loading={loading} />
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Servicios MAX
          </h2>
          <ServiceGrid
            services={data?.services}
            gateway={data?.gateway}
            loading={loading}
          />
        </section>

        {data?.gateway?.checked_at && (
          <p className="text-[10px] text-muted-foreground">
            Última verificación: {new Date(data.gateway.checked_at).toLocaleTimeString("es-CO")}
          </p>
        )}
      </div>
    </div>
  );
}
