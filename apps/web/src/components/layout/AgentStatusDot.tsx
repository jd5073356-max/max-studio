"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useWsStore } from "@/store/ws";

export function AgentStatusDot() {
  const agentOnline = useWsStore((s) => s.agentOnline);
  const wsStatus = useWsStore((s) => s.status);

  const label = agentOnline
    ? "Agent PC online"
    : wsStatus === "connected"
      ? "Agent PC offline — MAX en cloud"
      : "Conectando con gateway…";

  return (
    <Tooltip>
      <TooltipTrigger
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent hover:bg-accent"
        aria-label={label}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            agentOnline ? "bg-success" : "bg-destructive",
          )}
          aria-hidden
        />
        {agentOnline && (
          <span
            className="absolute h-2 w-2 animate-ping rounded-full bg-success opacity-75"
            aria-hidden
          />
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
