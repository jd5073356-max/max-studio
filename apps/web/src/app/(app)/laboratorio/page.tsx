"use client";

import { useState } from "react";
import { FlaskConical, Shield } from "lucide-react";
import { SimulationDashboard } from "./SimulationDashboard";
import { AuditPanel } from "./AuditPanel";

type Tab = "simulation" | "audit";

export default function LaboratorioPage() {
  const [tab, setTab] = useState<Tab>("simulation");

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-neutral-950 px-6 py-8 pb-24 text-white">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex rounded-xl bg-white/5 border border-white/5 p-1 gap-1">
          <button
            onClick={() => setTab("simulation")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === "simulation" ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <FlaskConical className="h-4 w-4" />
            Simulación 300 Agentes
          </button>
          <button
            onClick={() => setTab("audit")}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              tab === "audit" ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Shield className="h-4 w-4" />
            Auditor Opus 4.7
          </button>
        </div>
      </div>

      {tab === "simulation" ? <SimulationDashboard /> : <AuditPanel />}
    </div>
  );
}
