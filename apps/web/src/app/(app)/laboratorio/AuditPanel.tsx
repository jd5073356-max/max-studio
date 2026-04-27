"use client";

import { useState } from "react";
import { Shield, Lightbulb, Loader2, AlertTriangle, CheckCircle } from "lucide-react";
import { apiFetch } from "@/lib/api";

type AuditMode = "security" | "business";

interface SecurityResult {
  filename: string;
  language: string;
  model: string;
  report: string;
  code_lines: number;
}

interface BusinessResult {
  model: string;
  verdict: string;
  report: string;
}

export function AuditPanel() {
  const [mode, setMode] = useState<AuditMode>("security");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secResult, setSecResult] = useState<SecurityResult | null>(null);
  const [bizResult, setBizResult] = useState<BusinessResult | null>(null);

  // Security form
  const [code, setCode] = useState("");
  const [language, setLanguage] = useState("python");
  const [filename, setFilename] = useState("");

  // Business form
  const [idea, setIdea] = useState("");
  const [market, setMarket] = useState("");
  const [investment, setInvestment] = useState("");

  const runSecurityAudit = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setSecResult(null);
    try {
      const res = await apiFetch<SecurityResult>("/audit/security", {
        method: "POST",
        body: { code, language, filename },
      });
      setSecResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error en auditoría");
    } finally {
      setLoading(false);
    }
  };

  const runBusinessAudit = async () => {
    if (!idea.trim()) return;
    setLoading(true);
    setError(null);
    setBizResult(null);
    try {
      const res = await apiFetch<BusinessResult>("/audit/business", {
        method: "POST",
        body: { idea, market, investment: parseFloat(investment) || 0 },
      });
      setBizResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error en auditoría");
    } finally {
      setLoading(false);
    }
  };

  const verdictColor = (v: string) => {
    if (v === "VIABLE") return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    if (v === "VIABLE CON CAMBIOS") return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    return "text-rose-400 bg-rose-500/10 border-rose-500/30";
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Auditor Opus 4.7</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Análisis profundo con el modelo más potente</p>
        </div>
        <div className="flex rounded-xl bg-white/5 border border-white/5 p-1 gap-1">
          <button
            onClick={() => setMode("security")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              mode === "security" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Shield className="h-4 w-4" /> Código
          </button>
          <button
            onClick={() => setMode("business")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              mode === "business" ? "bg-white/10 text-white" : "text-zinc-400 hover:text-white"
            }`}
          >
            <Lightbulb className="h-4 w-4" /> Negocio
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {mode === "security" ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Lenguaje</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500/50"
              >
                {["python", "javascript", "typescript", "go", "java", "rust", "php", "sql"].map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Archivo (opcional)</label>
              <input
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
                placeholder="routes.py"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Código fuente</label>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Pega aquí el código a auditar…"
              rows={12}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white font-mono placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 resize-none"
            />
          </div>
          <button
            onClick={runSecurityAudit}
            disabled={loading || !code.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
            {loading ? "Auditando con Opus 4.7…" : "Auditar Código"}
          </button>

          {secResult && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-semibold">{secResult.code_lines} líneas · {secResult.language} · {secResult.model}</span>
              </div>
              <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono overflow-auto max-h-[500px]">
                {secResult.report}
              </pre>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Mercado objetivo (opcional)</label>
              <input
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                placeholder="Colombia, 18-35 años"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Inversión inicial USD</label>
              <input
                type="number"
                value={investment}
                onChange={(e) => setInvestment(e.target.value)}
                placeholder="5000"
                className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1.5 block">Describe tu idea de negocio</label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="Describe qué es, cómo genera dinero, quién es el cliente, por qué es diferente…"
              rows={8}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/50 resize-none"
            />
          </div>
          <button
            onClick={runBusinessAudit}
            disabled={loading || !idea.trim()}
            className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-semibold text-white hover:bg-purple-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lightbulb className="h-4 w-4" />}
            {loading ? "Analizando con Opus 4.7…" : "Auditar Idea"}
          </button>

          {bizResult && (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-sm font-bold mb-4 ${verdictColor(bizResult.verdict)}`}>
                {bizResult.verdict}
              </div>
              <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono overflow-auto max-h-[500px]">
                {bizResult.report}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
