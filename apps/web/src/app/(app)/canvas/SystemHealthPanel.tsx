"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { ErrorModal } from "./ErrorModal";

interface ServiceStatus {
  name: string;
  url: string;
  status: "online" | "offline" | "degraded" | "error";
  latency_ms: number | null;
  error?: string;
}

interface SystemStatus {
  agent: {
    online: boolean;
    last_heartbeat: string | null;
    seconds_since: number | null;
    metadata: Record<string, unknown>;
  };
  services: ServiceStatus[];
  gateway: { status: string };
}

interface NodeInfo {
  label: string;
  status: "green" | "yellow" | "red";
  detail: string;
  error?: string;
}

function nodeColor(s: string, latency?: number | null): "green" | "yellow" | "red" {
  if (s === "online") return latency && latency > 500 ? "yellow" : "green";
  if (s === "degraded") return "yellow";
  return "red";
}

const DOT: Record<"green" | "yellow" | "red", string> = {
  green: "bg-emerald-400",
  yellow: "bg-amber-400",
  red: "bg-red-400 animate-pulse",
};

const LABEL: Record<"green" | "yellow" | "red", string> = {
  green: "text-emerald-400",
  yellow: "text-amber-400",
  red: "text-red-400",
};

export function SystemHealthPanel() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<NodeInfo | null>(null);

  useEffect(() => {
    const fetch = () =>
      apiFetch<SystemStatus>("/system/status")
        .then(setStatus)
        .catch(() => {});

    fetch();
    const timer = setInterval(fetch, 5_000);
    return () => clearInterval(timer);
  }, []);

  if (!status) {
    return (
      <div className="rounded-xl border border-[#27272A] bg-[#131316]/90 p-3 text-xs text-[#A1A1AA] backdrop-blur">
        Conectando...
      </div>
    );
  }

  const agentStatus = status.agent.online ? "green" : "red";
  const agentDetail = status.agent.online
    ? `Online · ${status.agent.seconds_since}s`
    : "Offline (agente PC desconectado)";

  const nodes: NodeInfo[] = [
    {
      label: "Gateway",
      status: status.gateway.status === "online" ? "green" : "red",
      detail: status.gateway.status,
    },
    {
      label: "Agente PC",
      status: agentStatus,
      detail: agentDetail,
    },
    ...status.services.map((s) => ({
      label: s.name.charAt(0).toUpperCase() + s.name.slice(1),
      status: nodeColor(s.status, s.latency_ms),
      detail: s.latency_ms ? `${s.status} · ${s.latency_ms}ms` : s.status,
      error: s.error,
    })),
  ];

  const redCount = nodes.filter((n) => n.status === "red").length;

  return (
    <>
      <div className="rounded-xl border border-[#27272A] bg-[#131316]/90 p-3 backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-[#FAFAFA]">Monitor</span>
          {redCount > 0 && (
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
              {redCount} error{redCount > 1 ? "es" : ""}
            </span>
          )}
        </div>

        <ul className="flex flex-col gap-1.5">
          {nodes.map((node) => (
            <li key={node.label}>
              <button
                onClick={() => node.status === "red" ? setError(node) : undefined}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-white/5"
              >
                <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[node.status]}`} />
                <span className="flex-1 text-xs text-[#FAFAFA]">{node.label}</span>
                <span className={`text-xs ${LABEL[node.status]}`}>{node.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {error && <ErrorModal node={error} onClose={() => setError(null)} />}
    </>
  );
}
