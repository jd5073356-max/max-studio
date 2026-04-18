"use client";

import { Activity, AlertTriangle, CircleCheck, CircleX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SystemStatus } from "@/types/api";

interface Props {
  services: SystemStatus["services"] | undefined;
  gateway: SystemStatus["gateway"] | undefined;
  loading?: boolean;
}

const DISPLAY_NAME: Record<string, string> = {
  dispatch: "Dispatch Router",
  pi: "Pi Service",
  openclaw: "OpenClaw",
};

type ServiceLike = {
  name: string;
  url?: string;
  status: string;
  latency_ms?: number | null;
  http_code?: number | null;
};

function statusIcon(status: string) {
  if (status === "online")
    return <CircleCheck className="h-4 w-4 text-success" />;
  if (status === "offline")
    return <CircleX className="h-4 w-4 text-destructive" />;
  if (status === "degraded")
    return <AlertTriangle className="h-4 w-4 text-warning" />;
  return <Activity className="h-4 w-4 text-muted-foreground" />;
}

function ServiceCard({ service }: { service: ServiceLike }) {
  const isOnline = service.status === "online";
  return (
    <Card className={cn(!isOnline && "border-destructive/30")}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          {statusIcon(service.status)}
          <CardTitle className="text-sm font-semibold">
            {DISPLAY_NAME[service.name] ?? service.name}
          </CardTitle>
        </div>
        <Badge
          variant={isOnline ? "default" : "destructive"}
          className={cn(
            "text-[10px]",
            isOnline && "bg-success text-success-foreground",
          )}
        >
          {service.status}
        </Badge>
      </CardHeader>
      <CardContent className="pt-0 text-xs text-muted-foreground">
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          {service.url && (
            <>
              <dt>URL:</dt>
              <dd className="truncate font-mono text-foreground">
                {service.url}
              </dd>
            </>
          )}
          <dt>Latencia:</dt>
          <dd className="font-mono text-foreground">
            {service.latency_ms !== null && service.latency_ms !== undefined
              ? `${service.latency_ms} ms`
              : "—"}
          </dd>
          {service.http_code !== null && service.http_code !== undefined && (
            <>
              <dt>HTTP:</dt>
              <dd className="font-mono text-foreground">{service.http_code}</dd>
            </>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}

export function ServiceGrid({ services, gateway, loading }: Props) {
  if (loading && !services) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
        Consultando servicios…
      </div>
    );
  }

  const gatewayCard: ServiceLike = {
    name: "gateway",
    url: "/health (local)",
    status: gateway?.status ?? "offline",
    latency_ms: 0,
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
          <div className="flex items-center gap-2">
            <CircleCheck className="h-4 w-4 text-success" />
            <CardTitle className="text-sm font-semibold">Gateway</CardTitle>
          </div>
          <Badge className="bg-success text-success-foreground text-[10px]">
            online
          </Badge>
        </CardHeader>
        <CardContent className="pt-0 text-xs text-muted-foreground">
          <p>API local respondiendo.</p>
          <p className="mt-1 font-mono text-foreground">
            {gatewayCard.url}
          </p>
        </CardContent>
      </Card>
      {(services ?? []).map((s) => (
        <ServiceCard key={s.name} service={s} />
      ))}
    </div>
  );
}
