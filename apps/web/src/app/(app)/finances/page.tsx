"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { ArrowRight, Lock, Send, ArrowLeftRight, Activity, DollarSign, Wallet, CreditCard, Building2, Briefcase } from "lucide-react";
import { AssetCard } from "@/components/finance/AssetCard";
import { PortfolioChart } from "@/components/finance/PortfolioChart";
import {
  getProjects, getExpenseCategories, getAccounts, getSnapshots, getEntityHistory,
  getLedgerMonthTotals,
  type FinanceProject, type FinanceExpenseCategory, type FinanceAccount, type FinanceSnapshot
} from "@/lib/supabase-finance";

// Datos simulados de tendencia mensual para cada seccion personal
type PersonalSection = "proyectos" | "gastos" | "liquidez" | null;

const SECTION_LABELS: Record<string, string> = {
  proyectos: "Ingresos Mensuales",
  gastos: "Gastos Mensuales",
  liquidez: "Liquidez Disponible",
};

const SECTION_COLORS: Record<string, string> = {
  proyectos: "#34d399",
  gastos: "#f43f5e",
  liquidez: "#60a5fa",
};

const ASSETS = [
  { symbol: "BTC-USD", name: "Bitcoin" },
  { symbol: "ETH-USD", name: "Ethereum" },
  { symbol: "SOL-USD", name: "Solana" },
  { symbol: "DX-Y.NYB", name: "US Dollar Index" },
  { symbol: "COP=X", name: "USD/COP" }
];

interface QuoteData {
  price: number;
  changePercent: number;
}

interface HistoryData {
  date: string;
  close: number;
}

export default function FinancesPage() {
  const [quotes, setQuotes] = useState<Record<string, QuoteData>>({});
  const [history, setHistory] = useState<HistoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<string>("BTC-USD");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("1mo");
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "COP">("COP");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<PersonalSection>(null);
  const [selectedSubEntity, setSelectedSubEntity] = useState<{id: string, type: string, name: string} | null>(null);
  const [personalPeriod, setPersonalPeriod] = useState<string>("1mo");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- Datos reales de Supabase ---
  const [dbProjects, setDbProjects] = useState<FinanceProject[]>([]);
  const [dbCategories, setDbCategories] = useState<FinanceExpenseCategory[]>([]);
  const [dbAccounts, setDbAccounts] = useState<FinanceAccount[]>([]);
  const [dbSnapshots, setDbSnapshots] = useState<FinanceSnapshot[]>([]);
  const [ledgerTotals, setLedgerTotals] = useState<Record<string, number>>({});
  const [budgetPredictions, setBudgetPredictions] = useState<Record<string, { depleted_date: string; daily_burn: number }>>({});

  // Cargar datos financieros de Supabase
  const loadFinanceData = useCallback(async () => {
    const [projects, categories, accounts, snapshots, totals] = await Promise.all([
      getProjects(), getExpenseCategories(), getAccounts(), getSnapshots(), getLedgerMonthTotals()
    ]);
    setDbProjects(projects);
    setDbCategories(categories);
    setDbAccounts(accounts);
    setDbSnapshots(snapshots);
    setLedgerTotals(totals);

    // Budget predictions from gateway
    try {
      const preds = await fetch("/api/finance/budgets").then(r => r.json()) as Array<{id: string; depleted_date: string; daily_burn: number}>;
      const map: Record<string, { depleted_date: string; daily_burn: number }> = {};
      for (const p of preds) map[p.id] = { depleted_date: p.depleted_date, daily_burn: p.daily_burn };
      setBudgetPredictions(map);
    } catch {
      // predictions are optional
    }
  }, []);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  // Refrescar cuando MAX actualiza datos desde el chat
  useEffect(() => {
    const handler = () => loadFinanceData();
    window.addEventListener("finance:refresh", handler);
    return () => window.removeEventListener("finance:refresh", handler);
  }, [loadFinanceData]);

  // Historial granular para la entidad seleccionada
  const [granularHistory, setGranularHistory] = useState<HistoryData[]>([]);
  const [granularLoading, setGranularLoading] = useState(false);

  useEffect(() => {
    async function loadGranular() {
      if (!selectedSubEntity) return;
      setGranularLoading(true);
      try {
        const data = await getEntityHistory(selectedSubEntity.id, selectedSubEntity.type, personalPeriod);
        setGranularHistory(data.map((d: any) => ({
          date: d.recorded_at.split("T")[0],
          close: Number(d.amount)
        })));
      } catch (err) {
        console.error("Ledger load error:", err);
      } finally {
        setGranularLoading(false);
      }
    }
    loadGranular();
  }, [selectedSubEntity, personalPeriod]);

  // Totales calculados desde la base de datos
  const totalIncome = dbProjects.filter(p => p.status === "active").reduce((sum, p) => sum + Number(p.monthly_income), 0);
  const totalBudget = dbCategories.reduce((sum, c) => sum + Number(c.budget_limit), 0);
  const totalLiquidity = dbAccounts.reduce((sum, a) => sum + Number(a.balance), 0);

  // Generar datos de grafica:
  // · selectedSubEntity != null → historial granular de ese item especifico
  // · selectedSubEntity == null pero selectedSection != null → snapshot global del conjunto
  const personalChartData = useMemo(() => {
    if (selectedSubEntity) {
      // Grafica individual del item seleccionado
      return granularHistory;
    }
    if (!selectedSection || dbSnapshots.length === 0) return [];
    // Grafica agregada de todo el conjunto
    const fieldMap: Record<string, keyof FinanceSnapshot> = {
      proyectos: "total_income",
      gastos: "total_expenses",
      liquidez: "total_liquidity",
    };
    const field = fieldMap[selectedSection];
    return dbSnapshots.map(s => ({
      date: s.month,
      close: Number(s[field]),
    }));
  }, [selectedSection, selectedSubEntity, granularHistory, dbSnapshots]);

  const chartTitle = selectedSubEntity
    ? selectedSubEntity.name
    : selectedSection
      ? `${SECTION_LABELS[selectedSection]} - Total`
      : "";

  const chartColor = selectedSubEntity
    ? (selectedSection === "gastos" ? "#f43f5e" : selectedSection === "liquidez" ? "#60a5fa" : "#34d399")
    : selectedSection
      ? SECTION_COLORS[selectedSection]
      : "#a855f7";

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const periodMap: Record<string, string> = {
    "Day": "1d",
    "Week": "5d",
    "Month": "1mo",
    "Year": "1y"
  };

  const loadQuotes = async () => {
    setLoading(true);
    try {
      const quotePromises = ASSETS.map(asset => 
        fetch(`/api/finance/quote/${asset.symbol}`).then(res => res.json())
      );
      const results = await Promise.all(quotePromises);
      
      const newQuotes: Record<string, QuoteData> = {};
      results.forEach((res, index) => {
        const data = res as QuoteData;
        if (data && data.price !== undefined) {
          newQuotes[ASSETS[index].symbol] = {
            price: data.price,
            changePercent: data.changePercent
          };
        }
      });
      setQuotes(newQuotes);
    } catch (err) {
      console.error("Failed to load quotes:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const histRes = await fetch(`/api/finance/history/${selectedAsset}?period=${selectedPeriod}`).then(res => res.json());
      const histData = histRes as { history?: HistoryData[] };
      if (histData && histData.history) {
        setHistory(histData.history);
      } else {
        setHistory([]);
      }
    } catch (err) {
      console.error("Failed to load history data:", err);
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    loadQuotes();
  }, []);

  useEffect(() => {
    loadHistory();
  }, [selectedAsset, selectedPeriod]);

  const handleRefresh = () => {
    loadQuotes();
    loadHistory();
    showToast("Mercados actualizados en tiempo real");
  };

  const portfolioValue = totalLiquidity; // Ahora es solo lo que hay en cuentas reales

  // COP=X da cuántos COP vale 1 USD (ej: 4000)
  const copPerUsd = quotes["COP=X"]?.price || 4000;

  // Para datos personales almacenados en COP
  const formatPrice = (val: number) => {
    if (displayCurrency === "USD") {
      const usd = val / copPerUsd;
      return `$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
    }
    return `$${val.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP`;
  };

  // Para cotizaciones de mercado que vienen en USD desde yfinance
  const formatMarketPrice = (val: number) => {
    if (displayCurrency === "COP") {
      const cop = val * copPerUsd;
      return `$${cop.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP`;
    }
    return `$${val.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-neutral-950 px-6 py-8 pb-24 text-white relative">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-900/40 px-6 py-3 text-sm font-medium text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
          <Activity className="h-4 w-4" />
          {toastMessage}
        </div>
      )}

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Finance & Portfolio</h1>
        <div className="flex items-center gap-3">
          {/* Currency Toggle */}
          <div className="flex items-center rounded-full bg-white/5 border border-white/5 p-1 backdrop-blur-md">
            <button
              onClick={() => setDisplayCurrency("COP")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${displayCurrency === "COP" ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              COP
            </button>
            <button
              onClick={() => setDisplayCurrency("USD")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${displayCurrency === "USD" ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              USD
            </button>
          </div>
          
          <button 
            onClick={handleRefresh}
            className={`flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm font-medium border border-white/5 backdrop-blur-md transition-all hover:bg-white/10 active:scale-95 ${loading ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Activity className={`h-4 w-4 text-purple-400 ${loading ? 'animate-pulse' : ''}`} />
            <span className="text-zinc-300">{loading ? 'Actualizando...' : 'Live Market'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          
          <div className="flex flex-col gap-6 rounded-3xl border border-white/5 bg-white/[0.02] p-8 backdrop-blur-2xl">
            <div>
              <p className="text-zinc-400">Total Portfolio Value</p>
              <div className="mt-2 flex items-end gap-4">
                <h2 className="text-5xl font-bold tracking-tight">
                  {loading ? "---" : formatPrice(portfolioValue)}
                </h2>
                <div className="mb-2 flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-sm font-medium text-emerald-400">
                  +1.24% <span className="text-xs text-emerald-400/70">Last 24h</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-2">
              <button onClick={() => showToast("Compra de activos: Próximamente")} className="flex items-center gap-2 rounded-full bg-purple-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-500 shadow-[0_0_20px_-5px_rgba(168,85,247,0.5)]">
                <Lock className="h-4 w-4" /> Buy Asset
              </button>
              <button onClick={() => showToast("Envío de fondos: Próximamente")} className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 hover:border-purple-500/30">
                <Send className="h-4 w-4" /> Send
              </button>
              <button onClick={() => showToast("Recepción de fondos: Próximamente")} className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 hover:border-purple-500/30">
                <ArrowRight className="h-4 w-4" /> Receive
              </button>
              <button onClick={() => showToast("Swap cripto: Próximamente")} className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 hover:border-purple-500/30">
                <ArrowLeftRight className="h-4 w-4" /> Swap
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Portfolio Overview ({selectedAsset.split("-")[0].replace("=X", "").replace(".NYB", "")})</h3>
              <div className="flex gap-2 rounded-full bg-white/5 p-1">
                {Object.keys(periodMap).map(t => {
                  const isActive = periodMap[t] === selectedPeriod;
                  return (
                    <button 
                      key={t} 
                      onClick={() => setSelectedPeriod(periodMap[t])}
                      className={`rounded-full px-4 py-1 text-xs font-medium transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>
            {historyLoading ? (
              <div className="flex h-[300px] items-center justify-center text-zinc-500">Loading chart data...</div>
            ) : (
              <PortfolioChart data={history} color="#a855f7" formatPrice={formatPrice} />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Top Tokens & Assets</h3>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors"
            >
              View more &rarr;
            </button>
          </div>
          
          <div className="grid gap-4">
            {ASSETS.map((asset) => {
              const quote = quotes[asset.symbol];
              const isActive = asset.symbol === selectedAsset;
              return (
                <div key={asset.symbol} className={isActive ? "ring-1 ring-purple-500 rounded-2xl" : ""}>
                  <AssetCard
                    name={asset.name}
                    symbol={asset.symbol}
                    price={quote?.price || 0}
                    changePercent={quote?.changePercent || 0}
                    onClick={() => setSelectedAsset(asset.symbol)}
                    formatPrice={formatMarketPrice}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* --- Personal Management Section --- */}
      <div className="mt-12 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight">Gestión Personal</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          
          {/* Ingresos & Proyectos */}
          <div 
            onClick={() => {
              // Clic en el conjunto: mostrar grafica agregada
              setSelectedSubEntity(null);
              setSelectedSection(selectedSection === "proyectos" ? null : "proyectos");
            }}
            className={`rounded-3xl border bg-white/[0.02] p-6 backdrop-blur-2xl xl:col-span-1 cursor-pointer transition-all hover:bg-white/[0.04] ${
              selectedSection === "proyectos" ? "border-emerald-500/50 ring-1 ring-emerald-500/30" : "border-white/5"
            }`}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Proyectos Activos</h3>
                <p className="text-xs text-zinc-400">Ingresos Mensuales</p>
              </div>
            </div>
            
            <div className="text-3xl font-bold text-white mb-6">
              {formatPrice(totalIncome)}
            </div>

            <div className="flex flex-col gap-4">
              {dbProjects.map(p => (
                <div 
                  key={p.id} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSection("proyectos");
                    setSelectedSubEntity({id: p.id, type: "project", name: p.name});
                  }}
                  className={`flex items-center justify-between rounded-xl p-4 transition-all hover:bg-white/10 ${
                    selectedSubEntity?.id === p.id ? "bg-white/10 border border-emerald-500/30" : "bg-white/5 border border-transparent"
                  } ${p.status !== "active" ? "opacity-70" : ""}`}
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{p.name}</span>
                    <span className="text-xs text-zinc-500">{p.description || p.recurrence}</span>
                  </div>
                  <span className={`font-semibold ${p.status === "active" ? "text-emerald-400" : "text-zinc-300"}`}>
                    {formatPrice(Number(p.monthly_income))}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Gastos y Presupuesto (Barras de progreso) */}
          <div 
            onClick={() => {
              // Clic en el conjunto: mostrar grafica agregada
              setSelectedSubEntity(null);
              setSelectedSection(selectedSection === "gastos" ? null : "gastos");
            }}
            className={`rounded-3xl border bg-white/[0.02] p-6 backdrop-blur-2xl xl:col-span-1 cursor-pointer transition-all hover:bg-white/[0.04] ${
              selectedSection === "gastos" ? "border-rose-500/50 ring-1 ring-rose-500/30" : "border-white/5"
            }`}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Desglose de Gastos</h3>
                <p className="text-xs text-zinc-400">Presupuesto vs Consumido</p>
              </div>
            </div>

            <div className="text-3xl font-bold text-white mb-6">
              {formatPrice(Object.values(ledgerTotals).reduce((s, v) => s + v, 0))}
              <span className="text-sm font-normal text-zinc-500"> / {formatPrice(totalBudget)}</span>
            </div>

            <div className="flex flex-col gap-5">
              {dbCategories.map(cat => {
                const spent = ledgerTotals[cat.id] ?? 0;
                const pct = Number(cat.budget_limit) > 0 ? Math.min(100, Math.round((spent / Number(cat.budget_limit)) * 100)) : 0;
                return (
                  <div 
                    key={cat.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSection("gastos");
                      setSelectedSubEntity({id: cat.id, type: "category", name: cat.name});
                    }}
                    className={`p-2 rounded-xl transition-all hover:bg-white/5 cursor-pointer ${selectedSubEntity?.id === cat.id ? "bg-white/5" : ""}`}
                  >
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-zinc-300">{cat.name}</span>
                      <span className="font-medium text-xs">
                        {spent > 0 ? `${formatPrice(spent)} · ` : ""}{pct}%
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: cat.color }}></div>
                    </div>
                    {budgetPredictions[cat.id] && (
                      <div className="flex items-center justify-between mt-1.5">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          budgetPredictions[cat.id].depleted_date === "Agotado"
                            ? "bg-rose-500/20 text-rose-400"
                            : pct >= 80
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-white/5 text-zinc-500"
                        }`}>
                          {budgetPredictions[cat.id].depleted_date === "Agotado"
                            ? "⚠ Agotado"
                            : budgetPredictions[cat.id].depleted_date === "Sin datos"
                            ? "Sin datos"
                            : `Agota: ${budgetPredictions[cat.id].depleted_date}`}
                        </span>
                        {budgetPredictions[cat.id].daily_burn > 0 && (
                          <span className="text-[10px] text-zinc-600">
                            {formatPrice(budgetPredictions[cat.id].daily_burn)}/día
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Liquidez / Cuentas */}
          <div 
            onClick={() => {
              // Clic en el conjunto: mostrar grafica agregada
              setSelectedSubEntity(null);
              setSelectedSection(selectedSection === "liquidez" ? null : "liquidez");
            }}
            className={`rounded-3xl border bg-white/[0.02] p-6 backdrop-blur-2xl xl:col-span-1 cursor-pointer transition-all hover:bg-white/[0.04] ${
              selectedSection === "liquidez" ? "border-blue-500/50 ring-1 ring-blue-500/30" : "border-white/5"
            }`}
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Liquidez (Efectivo)</h3>
                <p className="text-xs text-zinc-400">Dinero disponible</p>
              </div>
            </div>

            <div className="text-3xl font-bold text-white mb-6">
              {formatPrice(totalLiquidity)}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {dbAccounts.map((acc, i) => (
                <div 
                  key={acc.id} 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedSection("liquidez");
                    setSelectedSubEntity({id: acc.id, type: "account", name: acc.name});
                  }}
                  className={`rounded-2xl p-4 border transition-all hover:bg-white/10 cursor-pointer ${
                    selectedSubEntity?.id === acc.id ? "bg-white/10 border-blue-500/30" : "bg-white/5 border-white/5"
                  } ${i === dbAccounts.length - 1 && dbAccounts.length % 2 !== 0 ? "col-span-2" : ""}`}
                >
                  {acc.icon === "dollar-sign" 
                    ? <DollarSign className="h-5 w-5 text-emerald-400 mb-2" />
                    : <Building2 className="h-5 w-5 text-zinc-400 mb-2" />
                  }
                  <p className="text-xs text-zinc-500 mb-1">{acc.institution || acc.name}</p>
                  <p className="font-semibold text-sm">{formatPrice(Number(acc.balance))}</p>
                </div>
              ))}
            </div>
          </div>
          
        </div>

        {/* Grafica de la seccion seleccionada */}
        {selectedSection && (
          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-2xl mt-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{chartTitle}</h3>
                <p className="text-xs text-zinc-500">
                  {selectedSubEntity ? "Historial Individual" : "Resumen del Conjunto"}
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* Period Selector para Gestion Personal */}
                <div className="flex bg-white/5 rounded-lg p-1">
                  {["Day", "Week", "Month", "Year"].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPersonalPeriod(periodMap[p])}
                      className={`px-3 py-1 text-xs rounded-md transition-all ${
                        personalPeriod === periodMap[p] ? "bg-white/10 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => {
                    setSelectedSection(null);
                    setSelectedSubEntity(null);
                  }}
                  className="text-xs text-zinc-400 hover:text-white transition-colors rounded-full bg-white/5 px-3 py-1"
                >
                  Cerrar
                </button>
              </div>
            </div>
            
            {granularLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Activity className="h-8 w-8 text-purple-500 animate-pulse" />
              </div>
            ) : personalChartData.length === 0 ? (
              <div className="h-[300px] flex flex-col items-center justify-center gap-3 text-center">
                <div className="rounded-full bg-white/5 p-4">
                  <Activity className="h-8 w-8 text-zinc-600" />
                </div>
                <p className="text-sm text-zinc-500">Sin historial disponible.</p>
                <p className="text-xs text-zinc-600">MAX puede agregar datos usando las tablas de Supabase.</p>
              </div>
            ) : (
              <PortfolioChart 
                data={personalChartData} 
                color={chartColor} 
                formatPrice={formatPrice} 
              />
            )}
          </div>
        )}
      </div>

      {/* --- Market Modal (View More) --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-2xl rounded-3xl border border-white/10 bg-neutral-900 p-8 shadow-2xl overflow-hidden">
            {/* Background Glow */}
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-purple-600/20 blur-[100px]"></div>
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">Mercado Global</h2>
                  <p className="text-sm text-zinc-400 mt-1">Explora otros activos y mercados</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full bg-white/5 p-2 hover:bg-white/10 transition-colors"
                >
                  <Lock className="h-5 w-5 text-zinc-400" />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                {[
                  { name: "S&P 500", symbol: "^GSPC", type: "Index" },
                  { name: "Nasdaq 100", symbol: "^NDX", type: "Index" },
                  { name: "Gold Futures", symbol: "GC=F", type: "Commodity" },
                  { name: "Crude Oil", symbol: "CL=F", type: "Commodity" },
                  { name: "Apple Inc.", symbol: "AAPL", type: "Stock" },
                  { name: "Tesla, Inc.", symbol: "TSLA", type: "Stock" },
                  { name: "NVIDIA Corp.", symbol: "NVDA", type: "Stock" },
                  { name: "Amazon.com", symbol: "AMZN", type: "Stock" },
                ].map((m) => (
                  <div key={m.symbol} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-purple-500/30 transition-all group">
                    <div className="flex flex-col">
                      <span className="font-semibold">{m.name}</span>
                      <span className="text-xs text-zinc-500">{m.type} • {m.symbol}</span>
                    </div>
                    <button 
                      onClick={() => {
                        setSelectedAsset(m.symbol);
                        setIsModalOpen(false);
                        showToast(`Cambiando a ${m.name}`);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-purple-600/10 text-purple-400 text-xs font-bold opacity-0 group-hover:opacity-100 transition-all hover:bg-purple-600 hover:text-white"
                    >
                      Analizar
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-8 pt-6 border-t border-white/5 flex justify-end">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2 rounded-xl bg-white/5 text-sm font-medium hover:bg-white/10 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
