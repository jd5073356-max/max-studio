"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface AgentStatusDotProps {
  online?: boolean;
  lastSeen?: string | null;
}

export function AgentStatusDot({ online = false, lastSeen }: AgentStatusDotProps) {
  const label = online
    ? "Agent PC online"
    : lastSeen
      ? `Agent PC offline — último heartbeat ${lastSeen}`
      : "Agent PC offline — sin heartbeats";

  return (
    <Tooltip>
      <TooltipTrigger
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md bg-transparent hover:bg-accent"
        aria-label={label}
      >
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            online ? "bg-success" : "bg-destructive",
          )}
          aria-hidden
        />
        {online && (
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
