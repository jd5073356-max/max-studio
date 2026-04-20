"use client";

import { useEffect } from "react";
import { MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useChatStore } from "@/store/chat";
import { useThreads } from "@/hooks/useThreads";
import { cn } from "@/lib/utils";

function formatRelative(iso: string): string {
  const date = new Date(iso);
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `hace ${days} d`;
  return date.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

interface ChatSidebarProps {
  /** Muestra el aside aunque esté en móvil (para usar dentro de un Sheet drawer) */
  forceVisible?: boolean;
  /** Callback al navegar a un hilo (para cerrar el drawer en móvil) */
  onNavigate?: () => void;
}

export function ChatSidebar({ forceVisible, onNavigate }: ChatSidebarProps = {}) {
  const threads = useChatStore((s) => s.threads);
  const activeThreadId = useChatStore((s) => s.activeThreadId);
  const { loadThreads, openThread, newThread } = useThreads();

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  return (
    <aside
      className={cn(
        "h-full w-64 shrink-0 flex-col border-r border-border bg-background",
        forceVisible ? "flex" : "hidden md:flex",
      )}
    >
      <div className="border-b border-border p-3">
        <Button
          onClick={newThread}
          variant="outline"
          className="w-full justify-start gap-2"
          size="sm"
        >
          <MessageSquarePlus className="h-4 w-4" />
          Nueva conversación
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {threads.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            Sin conversaciones aún
          </p>
        ) : (
          <ul className="space-y-0.5">
            {threads.map((t) => {
              const active = t.id === activeThreadId;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => { openThread(t.id); onNavigate?.(); }}
                    className={cn(
                      "w-full rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                      "hover:bg-card",
                      active &&
                        "bg-card ring-1 ring-border text-foreground",
                      !active && "text-muted-foreground",
                    )}
                  >
                    <div className="truncate font-medium">{t.title}</div>
                    <div className="mt-0.5 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{formatRelative(t.last_message_at)}</span>
                      <span>{t.message_count} msg</span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
