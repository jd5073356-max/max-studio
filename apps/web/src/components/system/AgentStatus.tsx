"use client";

import { Cpu, WifiOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SystemStatus } from "@/types/api";

interface Props {
  agent: SystemStatus["agent"] | undefined;
  loading?: boolean;
}

function formatSeconds(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `hace ${seconds}s`;
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)}h`;
  return `hace ${Math.floor(seconds / 86400)}d`;
}

export function AgentStatus({ agent, loading }: Props) {
  const online = agent?.online ?? false;
  const meta = agent?.metadata ?? {};

  return (
    <Card className={cn(online ? "" : "opacity-90")}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          {online ? (
            <Cpu className="h-4 w-4 text-success" />
          ) : (
            <WifiOff className="h-4 w-4 text-destructive" />
          )}
          <CardTitle className="text-sm font-semibold">Agente PC</CardTitle>
        </div>
        <Badge
          variant={online ? "default" : "destructive"}
          className={cn(online && "bg-success text-success-foreground")}
        >
          {loading && !agent ? "…" : online ? "online" : "offline"}
        </Badge>
      </CardHeader>
      <CardContent className="pt-0 text-xs text-muted-foreground">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt>Último heartbeat:</dt>
          <dd className="font-mono text-foreground">
            {formatSeconds(agent?.seconds_since)}
          </dd>
          {typeof meta.hostname === "string" && (
            <>
              <dt>Host:</dt>
              <dd className="font-mono text-foreground">
                {String(meta.hostname)}
              </dd>
            </>
          )}
          {typeof meta.os === "string" && (
            <>
              <dt>OS:</dt>
              <dd className="font-mono text-foreground">{String(meta.os)}</dd>
            </>
          )}
          {meta.mock === true && (
            <>
              <dt className="col-span-2 pt-1 text-[10px] italic text-warning">
                ⚠ Heartbeat simulado (mock)
              </dt>
            </>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
