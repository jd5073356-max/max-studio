"use client";

import { useCallback, useEffect, useState } from "react";
import { BookOpen, Loader2, Search, Tag } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";
import type { KnowledgeEntry } from "@/types/api";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const load = useCallback(
    async (search: string, cat: string, off: number, replace: boolean) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(off) });
        if (search) params.set("q", search);
        if (cat) params.set("category", cat);
        const data = await apiFetch<KnowledgeEntry[]>(`/memory/knowledge?${params}`);
        setItems((prev) => (replace ? data : [...prev, ...data]));
        setHasMore(data.length === PAGE_SIZE);

        // Extraer categorías únicas para los filtros
        if (replace) {
          const cats = [...new Set(data.map((d) => d.category).filter(Boolean))].sort();
          if (cats.length) setCategories(cats);
        }
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
    void load(q, category, 0, true);
  }, [q, category, load]);

  const loadMore = () => {
    const next = offset + PAGE_SIZE;
    setOffset(next);
    void load(q, category, next, false);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Barra */}
      <div className="shrink-0 space-y-2 border-b border-border bg-background p-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en knowledge base…"
            className="pl-8 text-sm"
          />
        </div>
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant={category === "" ? "default" : "outline"}
              onClick={() => setCategory("")}
              className="h-6 px-2 text-[10px]"
            >
              Todas
            </Button>
            {categories.map((c) => (
              <Button
                key={c}
                size="sm"
                variant={category === c ? "default" : "outline"}
                onClick={() => setCategory(c)}
                className={cn("h-6 px-2 text-[10px]")}
              >
                {c}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Grid de tarjetas */}
      <div className="flex-1 overflow-y-auto p-3">
        {loading && items.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <BookOpen className="h-8 w-8" />
            <p className="text-sm">Sin entradas en knowledge base</p>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-lg border border-border bg-card p-3 hover:border-primary/30 transition-colors"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1 text-[10px] font-medium text-primary">
                    <Tag className="h-3 w-3" />
                    {item.category || "sin categoría"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatDate(item.created_at)}
                  </span>
                </div>
                <p className="line-clamp-4 text-xs text-foreground">{item.content}</p>
              </article>
            ))}
          </div>
        )}

        {hasMore && (
          <div className="flex justify-center pt-4">
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Cargar más"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
