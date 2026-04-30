"use client";

import { useState, useRef, useCallback } from "react";
import { Play, FlaskConical, ChevronRight, Download, AlertCircle, Briefcase, CheckCircle2, Clock } from "lucide-react";
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
  mode?: string;
  docs?: { title: string; doc_id: string; filename: string }[];
}

interface RoundState {
  label: string;
  done: number;
  total: number;
  doc_id?: string;
}

type SimPhase = "idle" | "running" | "complete" | "error";
type SimMode = "standard" | "portfolio";

const PORTFOLIO_LABELS = [
  "Business Intelligence LATAM",
  "Arquitectura SaaS Dental",
  "Propuesta Comercial",
  "API Documentation Suite",
  "Email Sequence 7 Correos",
  "n8n Workflow Onboarding",
  "Dashboard Analytics — Código",
  "Python Campaign Script",
  "Go-to-Market Strategy",
  "Contenido LinkedIn 30 días",
  "Pitch Deck + Financial Model",
  "Análisis Competitivo",
];

export function SimulationDashboard() {
  const [mode, setMode] = useState<SimMode>("portfolio");
  const [phase, setPhase] = useState<SimPhase>("idle");
  const [rounds, setRounds] = useState<Record<number, RoundState>>({});
  const [recentAgents, setRecentAgents] = useState<AgentEvent[]>([]);
  const [result, setResult] = useState<SimResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [currentRound, setCurrentRound] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  const totalRounds = mode === "portfolio" ? 12 : 3;
  const agentsPerRound = mode === "portfolio" ? 25 : 100;

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
        body: { label: mode === "portfolio" ? "Portfolio 12 prompts" : "Simulación 300 agentes", mode },
      });

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

      es.addEventListener("round_end", (e) => {
        const d = JSON.parse(e.data) as { round: number; doc_id?: string };
        if (d.doc_id) {
          setRounds((prev) => {
            const r = prev[d.round];
            if (!r) return prev;
            return { ...prev, [d.round]: { ...r, doc_id: d.doc_id } };
          });
        }
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
  }, [mode, phase]);

  const stop = () => {
    esRef.current?.close();
    setPhase("idle");
  };

  const totalDone = Object.values(rounds).reduce((s, r) => s + r.done, 0);
  const totalAgents = totalRounds * agentsPerRound;
  const overallPct = totalAgents > 0 ? Math.round((totalDone / totalAgents) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold">
            {mode === "portfolio" ? "Portfolio 12 Prompts × 25 Agentes" : "Experimento Kimi: 300 Agentes"}
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {mode === "portfolio"
              ? "12 documentos de portafolio generados por 300 instancias Kimi K2.5 en paralelo"
              : "3 rondas × 100 agentes IA simultáneos"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode toggle — only when idle */}
          {phase === "idle" && (
            <div className="flex rounded-xl border border-white/10 overflow-hidden text-xs">
              <button
                onClick={() => setMode("portfolio")}
                className={`px-3 py-2 font-semibold transition-colors ${
                  mode === "portfolio" ? "bg-purple-600 text-white" : "text-zinc-400 hover:bg-white/5"
                }`}
              >
                <Briefcase className="h-3 w-3 inline mr-1" />
                Portfolio
              </button>
              <button
                onClick={() => setMode("standard")}
                className={`px-3 py-2 font-semibold transition-colors ${
                  mode === "standard" ? "bg-purple-600 text-white" : "text-zinc-400 hover:bg-white/5"
                }`}
              >
                <FlaskConical className="h-3 w-3 inline mr-1" />
                Estándar
              </button>
            </div>
          )}

          {phase === "idle" || phase === "error" ? (
            <button
              onClick={startSimulation}
              className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 transition-colors shadow-[0_0_20px_-5px_rgba(168,85,247,0.5)]"
            >
              <Play className="h-4 w-4" />
              {mode === "portfolio" ? "Iniciar Portfolio (esta noche)" : "Iniciar Simulación"}
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
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {errorMsg}
        </div>
      )}

      {/* Overall progress bar (portfolio mode) */}
      {mode === "portfolio" && phase === "running" && (
        <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 px-5 py-4">
          <div className="flex justify-between text-xs text-zinc-400 mb-2">
            <span className="font-semibold text-purple-300">Progreso general</span>
            <span>{totalDone} / {totalAgents} agentes · {overallPct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400 transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <p className="text-[10px] text-zinc-500 mt-2 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Tiempo estimado restante: ~{Math.max(1, Math.round(((totalAgents - totalDone) / 5) * 4 / 60))} min
          </p>
        </div>
      )}

      {/* Portfolio: 12-prompt grid */}
      {mode === "portfolio" && Object.keys(rounds).length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 12 }, (_, idx) => {
            const r = idx + 1;
            const rd = rounds[r];
            const pct = rd ? Math.round((rd.done / rd.total) * 100) : 0;
            const isActive = currentRound === r && phase === "running";
            const isDone = rd && rd.done >= rd.total;
            return (
              <div
                key={r}
                className={`rounded-2xl border p-4 transition-all ${
                  isDone
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : isActive
                    ? "border-purple-500/50 bg-purple-500/5"
                    : rd
                    ? "border-white/10 bg-white/[0.02]"
                    : "border-white/5 bg-white/[0.01] opacity-40"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    {isDone ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    ) : (
                      <FlaskConical className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-purple-400 animate-pulse" : "text-zinc-500"}`} />
                    )}
                    <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">P{r}</span>
                  </div>
                  {isDone && rd.doc_id && (
                    <a
                      href={`${process.env.NEXT_PUBLIC_GATEWAY_URL}/docs/${rd.doc_id}/download?token=${getToken() ?? ""}`}
                      download
                      className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5"
                    >
                      <Download className="h-3 w-3" />
                      .md
                    </a>
                  )}
                </div>
                <p className="text-xs font-medium mb-2 line-clamp-1">
                  {rd?.label?.replace(/^P\d+:\s*/, "") ?? PORTFOLIO_LABELS[idx]}
                </p>
                <div className="h-1 w-full rounded-full bg-white/10 overflow-hidden mb-1">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isDone ? "bg-emerald-500" : "bg-purple-500"
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[9px] text-zinc-500">
                  {rd ? `${rd.done} / ${rd.total} agentes` : "Esperando…"}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Standard: 3-round cards */}
      {mode === "standard" && Object.keys(rounds).length > 0 && (
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
                  <div className="h-full rounded-full bg-purple-500 transition-all duration-300" style={{ width: `${pct}%` }} />
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
          <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
            {recentAgents.map((a, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <span className="shrink-0 rounded-full bg-purple-500/20 px-1.5 py-0.5 text-purple-400 font-mono">
                  {mode === "portfolio" ? `P${a.round}` : `R${a.round}`}#{a.index}
                </span>
                {a.score !== undefined && a.score > 0 ? (
                  <span className="text-zinc-400">
                    {mode === "portfolio" ? (
                      <span className="text-zinc-400">{a.preview ?? `${Math.round(a.score * 100)} chars`}</span>
                    ) : (
                      <span className={`font-semibold ${a.score >= 0.7 ? "text-emerald-400" : a.score >= 0.4 ? "text-amber-400" : "text-rose-400"}`}>
                        {a.score.toFixed(2)}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="text-zinc-500 line-clamp-1">{a.preview}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio complete — 12 docs ready */}
      {result && result.mode === "portfolio" && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <div className="mb-5">
            <h3 className="font-bold text-lg text-emerald-300">✓ Portfolio Completo</h3>
            <p className="text-sm text-zinc-500 mt-1">
              12 documentos de portafolio generados por 300 agentes Kimi K2.5
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(result.docs ?? result.top_ideas.map((t, i) => ({ title: t.idea, doc_id: null, filename: `portfolio_${i+1}.md` }))).map((doc, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-white/5 border border-white/5 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-[10px] font-bold text-emerald-400">
                    {i + 1}
                  </span>
                  <p className="text-xs font-medium truncate">{"title" in doc ? doc.title : doc.idea}</p>
                </div>
                {"doc_id" in doc && doc.doc_id && (
                  <a
                    href={`${process.env.NEXT_PUBLIC_GATEWAY_URL}/docs/${doc.doc_id}/download?token=${getToken() ?? ""}`}
                    download
                    className="shrink-0 ml-3 flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    Descargar
                  </a>
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-zinc-500 mt-4">
            Los documentos también están disponibles en la sección <strong className="text-zinc-300">Documentos</strong>.
          </p>
        </div>
      )}

      {/* Standard complete */}
      {result && result.mode !== "portfolio" && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-lg">Simulación Completa</h3>
              <p className="text-sm text-zinc-500">{result.total_agents} agentes · Score promedio: <span className="text-emerald-400 font-semibold">{(result.avg_score * 100).toFixed(1)}%</span></p>
            </div>
          </div>
          <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Top 5 Ideas Supervivientes</h4>
          <div className="flex flex-col gap-3">
            {result.top_ideas.map((ti, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl bg-white/5 p-3">
                <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-[10px] font-bold text-purple-400">{i + 1}</span>
                <p className="text-xs text-zinc-300 flex-1 min-w-0 line-clamp-3">{ti.idea}</p>
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

      {/* Idle */}
      {phase === "idle" && Object.keys(rounds).length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-white/5 bg-white/[0.01] py-16 gap-5 text-center">
          <div className="rounded-full bg-purple-500/10 p-5">
            {mode === "portfolio"
              ? <Briefcase className="h-10 w-10 text-purple-400" />
              : <FlaskConical className="h-10 w-10 text-purple-400" />
            }
          </div>
          <div>
            <p className="font-semibold text-lg">
              {mode === "portfolio" ? "Portfolio Mode — 12 Documentos en 1 Click" : "Laboratorio de Agentes IA"}
            </p>
            <p className="text-sm text-zinc-500 mt-1 max-w-md mx-auto">
              {mode === "portfolio"
                ? "300 instancias Kimi K2.5 trabajan en paralelo generando los 12 documentos de portafolio. Cada prompt recibe 25 agentes y se guarda el mejor output. Tiempo estimado: ~20 min."
                : "300 instancias de Kimi K2.5 operando en paralelo para generar, auditar y predecir supervivencia de ideas de negocio."
              }
            </p>
          </div>
          {mode === "portfolio" && (
            <div className="grid grid-cols-2 gap-2 text-left max-w-lg w-full mt-2">
              {PORTFOLIO_LABELS.map((label, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-zinc-500 bg-white/[0.02] rounded-lg px-3 py-2 border border-white/5">
                  <span className="text-purple-400 font-mono text-[10px]">P{i + 1}</span>
                  <span className="truncate">{label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
