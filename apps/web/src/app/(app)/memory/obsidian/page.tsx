"use client";

import { useCallback, useEffect, useState } from "react";
import { FileText, Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

interface ONote {
  id: string;
  content: string;
  created_at: string;
}

function NoteCard({ note }: { note: ONote }) {
  const [open, setOpen] = useState(false);

  // La primera línea es "# path/to/file.md"
  const lines = note.content.split("\n");
  const titleLine = lines[0]?.replace(/^# ?/, "") ?? "Sin título";
  const body = lines.slice(2).join("\n"); // skip blank line after title

  return (
    <article className="rounded-lg border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-2 p-3 text-left"
      >
        <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">{titleLine}</p>
          <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">{body.slice(0, 120)}</p>
        </div>
        <span className="shrink-0 text-[9px] text-muted-foreground">
          {new Date(note.created_at).toLocaleDateString("es", { day: "2-digit", month: "short" })}
        </span>
      </button>
      {open && (
        <div className="border-t border-border bg-muted/20 p-3">
          <pre className="text-[10px] text-foreground leading-relaxed whitespace-pre-wrap max-h-60 overflow-y-auto">
            {note.content}
          </pre>
        </div>
      )}
    </article>
  );
}

export default function ObsidianPage() {
  const [notes, setNotes] = useState<ONote[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [q, setQ] = useState("");

  const load = useCallback(async (search: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "40" });
      if (search) params.set("q", search);
      const data = await apiFetch<ONote[]>(`/context/obsidian?${params}`);
      setNotes(data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(q); }, [q, load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await apiFetch("/context/sync", { method: "POST" });
      toast.success("Sincronización iniciada — espera ~15 s");
      setTimeout(() => void load(""), 15000);
    } catch {
      toast.error("Agente local no disponible");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Barra */}
      <div className="shrink-0 flex items-center gap-2 border-b border-border bg-background p-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en Obsidian…"
            className="pl-8 text-sm"
          />
        </div>
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="gap-1.5 shrink-0">
          {syncing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Sincronizar
        </Button>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && notes.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
            <FileText className="h-8 w-8" />
            <p className="text-sm">Sin notas sincronizadas</p>
            <p className="text-xs max-w-xs text-center">
              Inicia agent.py para sincronizar automáticamente las últimas notas de Obsidian.
            </p>
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              Sincronizar ahora
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[10px] text-muted-foreground px-0.5">{notes.length} nota(s)</p>
            {notes.map((n) => (
              <NoteCard key={n.id} note={n} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
