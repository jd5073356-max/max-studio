"use client";

import { useCallback, useEffect, useState } from "react";
import { Bot, Loader2, Search, User } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import type { Conversation } from "@/types/api";
import { cn } from "@/lib/utils";

const ENGINES = ["", "pwa", "telegram", "whatsapp"];
const PAGE_SIZE = 50;

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-CO", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EngineBadge({ engine }: { engine: string }) {
  const colors: Record<string, string> = {
    pwa: "bg-primary/10 text-primary",
    telegram: "bg-blue-500/10 text-blue-400",
    whatsapp: "bg-emerald-500/10 text-emerald-400",
  };
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium",
        colors[engine] ?? "bg-muted text-muted-foreground",
      )}
    >
      {engine || "—"}
    </span>
  );
}

export default function ConversationsPage() {
  const [items, setItems] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [engine, setEngine] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    async (search: string, eng: string, off: number, replace: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
        if (search) params.set("q", search);
        if (eng) params.set("engine", eng);
        const data = await apiFetch<Conversation[]>(`/memory/conversations?${params}`);
        setItems((prev) => (replace ? data : [...prev, ...data]));
        setHasMore(data.length === PAGE_SIZE);
      } catch {
        // silencioso
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    setOffset(0);
    void load(q, engine, 0, true);
  }, [q, engine, load]);

  const loadMore = () => {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    void load(q, engine, next, false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Barra de búsqueda */}
      <div className="flex shrink-0 flex-wrap gap-2 border-b border-border bg-background p-3">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en conversaciones…"
            className="pl-8 text-sm"
          />
        </div>
        <div className="flex gap-1">
          {ENGINES.map((e) => (
            <Button
              key={e || "all"}
              size="sm"
              variant={engine === e ? "default" : "outline"}
              onClick={() => setEngine(e)}
              className="text-xs"
            >
              {e || "Todos"}
            </Button>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {loading && items.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <Search className="h-8 w-8" />
            <p className="text-sm">Sin resultados</p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((item) => (
              <li key={item.id} className="flex gap-3 px-4 py-3 hover:bg-card">
                <div className="mt-0.5 shrink-0">
                  {item.role === "user" ? (
                    <User className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Bot className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <EngineBadge engine={item.engine} />
                    <span className="text-[10px] text-muted-foreground">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                  <p className="line-clamp-3 text-sm text-foreground">{item.content}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {hasMore && (
          <div className="flex justify-center p-4">
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cargar más"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
