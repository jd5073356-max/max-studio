"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useRef, useEffect } from "react";
import { Save, Activity, Download } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { SystemHealthPanel } from "./SystemHealthPanel";

interface ExcalidrawAPI {
  getSceneElements: () => readonly unknown[];
  getAppState: () => Record<string, unknown>;
  updateScene: (opts: { elements?: unknown[]; appState?: Record<string, unknown> }) => void;
}

interface CanvasState {
  elements: unknown[];
  appState: Record<string, unknown>;
}

// Excalidraw must be loaded client-side only — uses browser APIs
const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-[#0A0A0B] text-zinc-500 text-sm">
        Cargando canvas...
      </div>
    ),
  },
);

export function CanvasClient() {
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const [showHealth, setShowHealth] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [initialData, setInitialData] = useState<CanvasState | null>(null);
  const [ready, setReady] = useState(false);

  // Load saved canvas state on mount
  useEffect(() => {
    apiFetch<{ data: CanvasState } | null>("/canvas/latest")
      .then((res) => {
        if (res?.data) setInitialData(res.data);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const handleSave = useCallback(async () => {
    if (!apiRef.current) return;
    setSaving(true);
    try {
      const elements = apiRef.current.getSceneElements();
      const appState = apiRef.current.getAppState();
      await apiFetch("/canvas/save", {
        method: "POST",
        body: { data: { elements, appState } },
      });
      setSaveMsg("Guardado");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch {
      setSaveMsg("Error al guardar");
      setTimeout(() => setSaveMsg(""), 3000);
    } finally {
      setSaving(false);
    }
  }, []);

  // Auto-save every 60s
  useEffect(() => {
    const timer = setInterval(handleSave, 60_000);
    return () => clearInterval(timer);
  }, [handleSave]);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0A0A0B] text-zinc-500 text-sm">
        Cargando...
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-2 border-b border-[#27272A] bg-[#0A0A0B] px-4 py-2">
        <span className="mr-2 text-sm font-semibold text-[#FAFAFA]">Canvas</span>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-md bg-[#7C3AED]/10 px-3 py-1.5 text-xs font-medium text-[#7C3AED] transition-colors hover:bg-[#7C3AED]/20 disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Guardando..." : saveMsg || "Guardar"}
        </button>

        <button
          onClick={() => setShowHealth((v) => !v)}
          className={[
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            showHealth
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-[#131316] text-[#A1A1AA] hover:bg-[#1C1C21]",
          ].join(" ")}
        >
          <Activity className="h-3.5 w-3.5" />
          Sistema
        </button>

        <div className="ml-auto flex items-center gap-1 text-xs text-[#A1A1AA]">
          <Download className="h-3.5 w-3.5" />
          <span>Ctrl+S para exportar</span>
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-hidden">
        <Excalidraw
          excalidrawAPI={(api) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            apiRef.current = api as unknown as ExcalidrawAPI;
            if (initialData && api) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (api as any).updateScene({
                elements: initialData.elements,
                appState: { ...initialData.appState, collaborators: new Map() },
              });
            }
          }}
          theme="dark"
          UIOptions={{
            canvasActions: {
              // @ts-expect-error — Excalidraw v0.18 internal option
              saveFileToDisk: true,
            },
          }}
        />
      </div>

      {/* Health overlay */}
      {showHealth && (
        <div className="pointer-events-none absolute right-4 top-16 z-20 w-72">
          <div className="pointer-events-auto">
            <SystemHealthPanel />
          </div>
        </div>
      )}
    </div>
  );
}
