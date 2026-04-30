"use client";

import { useState, useRef, useCallback } from "react";
import { Play, FlaskConical, ChevronRight, Download, AlertCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/store/auth";

interface AgentEvent {
  round: number;
  index: number;
  preview?: string;
  score?: number;
}

interface TopIdea {
  idea: string;
  score: number;
}

interface SimResult {
  sim_id: string;
  avg_score: number;
  top_ideas: TopIdea[];
  total_agents: number;
}

interface RoundState {
  label: string;
  done: number;
  total: number;
}

type SimPhase = "idle" | "running" | "complete" | "error";

export function SimulationDashboard() {
  const [phase, setPhase] = useState<SimPhase>("idle");
  const [rounds, setRounds] = useState<Record<number, RoundState>>({});
  const [recentAgents, setRecentAgents] = useState<AgentEvent[]>([]);
  const [result, setResult] = useState<SimResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  const startSimulation = useCallback(async () => {
    setPhase("running");
    setRounds({});
    setRecentAgents([]);
    setResult(null);
    setErrorMsg(null);
    setCurrentRound(0);

    try {
      const res = await apiFetch<{ sim_id: string }>("/kimi/simulation/start", {
        method: "POST",
        body: { label: "Simulación 300 agentes" },
      });

      // Connect SSE — EventSource no soporta headers, usamos query param con el JWT
      const token = getToken() ?? "";
      const wsUrl = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "";
      const sseUrl = `${wsUrl}/kimi/simulation/${res.sim_id}/stream?token=${token}`;

      const es = new EventSource(sseUrl);
      esRef.current = es;

      es.addEventListener("round_start", (e) => {
        const d = JSON.parse(e.data) as { round: number; label: string; total: number };
        setCurrentRound(d.round);
        setRounds((prev) => ({
          ...prev,
          [d.round]: { label: d.label, done: 0, total: d.total },
        }));
      });

      es.addEventListener("agent_done", (e) => {
        const d = JSON.parse(e.data) as AgentEvent;
        setRounds((prev) => {
          const r = prev[d.round];
          if (!r) return prev;
          return { ...prev, [d.round]: { ...r, done: r.done + 1 } };
        });
        setRecentAgents((prev) => [d, ...prev].slice(0, 20));
      });

      es.addEventListener("complete", (e) => {
        const d = JSON.parse(e.data) as SimResult;
        setResult(d);
        setPhase("complete");
        es.close();
      });

      es.addEventListener("error", (e) => {
        const d = JSON.parse((e as MessageEvent).data ?? "{}") as { detail: string };
        setErrorMsg(d.detail ?? "Error desconocido");
        setPhase("error");
        es.close();
      });

      es.onerror = () => {
        if (phase !== "complete") {
          setPhase("error");
          setErrorMsg("Conexión SSE perdida");
          es.close();
        }
      };
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error al iniciar");
      setPhase("error");
    }
  }, [phase]);

  const stop = () => {
    esRef.current?.close();
    setPhase("idle");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Experimento Kimi: 300 Agentes</h2>
          <p className="text-sm text-zinc-500 mt-0.5">3 rondas × 100 agentes IA simultáneos</p>
        </div>
        {phase === "idle" || phase === "error" ? (
          <button
            onClick={startSimulation}
            className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 transition-colors shadow-[0_0_20px_-5px_rgba(168,85,247,0.5)]"
          >
            <Play className="h-4 w-4" />
            Iniciar Simulación
          </button>
        ) : phase === "running" ? (
          <button
            onClick={stop}
            className="flex items-center gap-2 rounded-xl bg-zinc-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-600 transition-colors"
          >
            Detener
          </button>
        ) : null}
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Round Progress Cards */}
      {Object.keys(rounds).length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[1, 2, 3].map((r) => {
            const rd = rounds[r];
            const pct = rd ? Math.round((rd.done / rd.total) * 100) : 0;
            const isActive = currentRound === r && phase === "running";
            return (
              <div
                key={r}
                className={`rounded-2xl border p-5 transition-all ${
                  isActive
                    ? "border-purple-500/50 bg-purple-500/5"
                    : rd
                    ? "border-white/10 bg-white/[0.02]"
                    : "border-white/5 bg-white/[0.01] opacity-40"
                }`}
              >
                <div className="flex items-center gap-2 mb-3">
                  <FlaskConical className={`h-4 w-4 ${isActive ? "text-purple-400 animate-pulse" : "text-zinc-500"}`} />
                  <span className="text-xs font-semibold text-zinc-400">Round {r}</span>
                </div>
                <p className="text-sm font-medium mb-3">{rd?.label ?? ["Emprendedores", "Auditores", "Futuristas"][r - 1]}</p>
                <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden mb-1">
                  <div
                    className="h-full rounded-full bg-purple-500 transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-500">{rd ? `${rd.done} / ${rd.total} agentes` : "Esperando…"}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Live Feed */}
      {recentAgents.length > 0 && (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <h3 className="text-sm font-semibold mb-4 text-zinc-400">Feed en tiempo real</h3>
          <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
            {recentAgents.map((a, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <span className="shrink-0 rounded-full bg-purple-500/20 px-1.5 py-0.5 text-purple-400 font-mono">
                  R{a.round}#{a.index}
                </span>
                {a.score !== undefined ? (
                  <span className="text-zinc-400">
                    Score: <span className={`font-semibold ${a.score >= 0.7 ? "text-emerald-400" : a.score >= 0.4 ? "text-amber-400" : "text-rose-400"}`}>{a.score.toFixed(2)}</span>
                  </span>
                ) : (
                  <span className="text-zinc-500 line-clamp-1">{a.preview}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-lg">Simulación Completa</h3>
              <p className="text-sm text-zinc-500">{result.total_agents} agentes · Score promedio: <span className="text-emerald-400 font-semibold">{(result.avg_score * 100).toFixed(1)}%</span></p>
            </div>
            <button className="flex items-center gap-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-600/30 transition-colors">
              <Download className="h-4 w-4" />
              Descargar Informe
            </button>
          </div>

          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Top 5 Ideas Supervivientes</h4>
          <div className="flex flex-col gap-3">
            {result.top_ideas.map((ti, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-[10px] font-bold text-purple-400">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-300 line-clamp-3">{ti.idea}</p>
                </div>
                <div className="shrink-0 flex items-center gap-1">
                  <ChevronRight className="h-3 w-3 text-zinc-600" />
                  <span className={`text-xs font-bold ${ti.score >= 0.7 ? "text-emerald-400" : ti.score >= 0.4 ? "text-amber-400" : "text-rose-400"}`}>
                    {(ti.score * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Idle state */}
      {phase === "idle" && Object.keys(rounds).length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.01] py-20 gap-4 text-center">
          <div className="rounded-full bg-purple-500/10 p-5">
            <FlaskConical className="h-10 w-10 text-purple-400" />
          </div>
          <div>
            <p className="font-semibold">Laboratorio de Agentes IA</p>
            <p className="text-sm text-zinc-500 mt-1 max-w-sm">
              300 instancias de Kimi K2.5 operando en paralelo para generar, auditar y predecir supervivencia de ideas de negocio
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
