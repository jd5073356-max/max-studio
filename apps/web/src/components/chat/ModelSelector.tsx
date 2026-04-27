"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Cpu } from "lucide-react";
import { useChatStore } from "@/store/chat";

const MODELS = [
  { id: "auto",              label: "Auto",    description: "MAX elige" },
  { id: "claude-sonnet-4-6", label: "Sonnet",  description: "Razonamiento estándar" },
  { id: "claude-opus-4-7",   label: "Opus",    description: "Estrategia · Negocio" },
  { id: "kimi-k2.5",         label: "Kimi",    description: "Código · Análisis" },
  { id: "gpt-oss:120b",      label: "GPT-120", description: "Matemáticas · Datos" },
];

export function ModelSelector() {
  const selectedModel = useChatStore((s) => s.selectedModel);
  const setSelectedModel = useChatStore((s) => s.setSelectedModel);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = MODELS.find((m) => m.id === selectedModel) ?? MODELS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
        title="Cambiar modelo"
      >
        <Cpu className="h-3 w-3" />
        <span className="hidden sm:inline">{current.label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute bottom-full left-0 mb-1 w-52 rounded-xl border border-border bg-card shadow-2xl z-50 overflow-hidden">
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { setSelectedModel(m.id); setOpen(false); }}
              className={`w-full flex flex-col px-3 py-2 text-left transition-colors hover:bg-white/5 ${
                m.id === selectedModel ? "bg-primary/10 text-primary" : "text-foreground"
              }`}
            >
              <span className="text-xs font-semibold">{m.label}</span>
              <span className="text-[10px] text-muted-foreground">{m.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
