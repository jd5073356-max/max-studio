"use client";

import { useEffect, useState, useMemo } from "react";
import { ArrowRight, Lock, Send, ArrowLeftRight, Activity, DollarSign, Wallet, CreditCard, Building2, Briefcase } from "lucide-react";
import { AssetCard } from "@/components/finance/AssetCard";
import { PortfolioChart } from "@/components/finance/PortfolioChart";

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

// Genera datos simulados de los ultimos 6 meses
function generateMockHistory(section: string): { date: string; close: number }[] {
  const now = new Date();
  const points: { date: string; close: number }[] = [];

  const baselines: Record<string, number[]> = {
    proyectos: [3200, 3500, 3800, 4100, 4200, 4500],
    gastos:    [1800, 1500, 1900, 1600, 1400, 1200],
    liquidez:  [5000, 5500, 6200, 7000, 7800, 8500],
  };

  const values = baselines[section] || baselines.liquidez;

  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
    points.push({
      date: d.toISOString().split("T")[0],
      close: values[i],
    });
  }
  return points;
}

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
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "COP">("USD");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<PersonalSection>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const personalChartData = useMemo(() => {
    if (!selectedSection) return [];
    return generateMockHistory(selectedSection);
  }, [selectedSection]);

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

  const portfolioValue = 
    (quotes["BTC-USD"]?.price || 0) * 0.15 + 
    (quotes["ETH-USD"]?.price || 0) * 1.5 + 
    (quotes["SOL-USD"]?.price || 0) * 20;

  const conversionRate = displayCurrency === "COP" ? (quotes["COP=X"]?.price || 3900) : 1;

  const formatPrice = (val: number) => {
    const converted = val * conversionRate;
    if (displayCurrency === "COP") {
      return `$${converted.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} COP`;
    }
    return `$${converted.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
              onClick={() => setDisplayCurrency("USD")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${displayCurrency === "USD" ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              USD
            </button>
            <button 
              onClick={() => setDisplayCurrency("COP")}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all ${displayCurrency === "COP" ? "bg-white/10 text-white shadow-sm" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              COP
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
                    formatPrice={formatPrice}
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
            onClick={() => setSelectedSection(selectedSection === "proyectos" ? null : "proyectos")}
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
              {formatPrice(4500)}
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between rounded-xl bg-white/5 p-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Desarrollo Web - Cliente A</span>
                  <span className="text-xs text-zinc-500">Facturado mensual</span>
                </div>
                <span className="font-semibold text-emerald-400">{formatPrice(2000)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/5 p-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Asesoría Tecnológica</span>
                  <span className="text-xs text-zinc-500">Recurrente</span>
                </div>
                <span className="font-semibold text-emerald-400">{formatPrice(1500)}</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-white/5 p-4 opacity-70">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Venta de Software (Beta)</span>
                  <span className="text-xs text-zinc-500">Cierre estimado en 15d</span>
                </div>
                <span className="font-semibold text-zinc-300">{formatPrice(1000)}</span>
              </div>
            </div>
          </div>

          {/* Gastos y Presupuesto (Barras de progreso) */}
          <div 
            onClick={() => setSelectedSection(selectedSection === "gastos" ? null : "gastos")}
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
              {formatPrice(1200)} <span className="text-sm font-normal text-zinc-500">/ {formatPrice(2000)}</span>
            </div>

            <div className="flex flex-col gap-5">
              {/* Gasto 1 */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-zinc-300">Vivienda & Servicios</span>
                  <span className="font-medium">85%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: '85%' }}></div>
                </div>
              </div>
              
              {/* Gasto 2 */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-zinc-300">Tecnología & Licencias</span>
                  <span className="font-medium">40%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: '40%' }}></div>
                </div>
              </div>

              {/* Gasto 3 */}
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-zinc-300">Alimentación & Ocio</span>
                  <span className="font-medium">60%</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* Liquidez / Cuentas */}
          <div 
            onClick={() => setSelectedSection(selectedSection === "liquidez" ? null : "liquidez")}
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
              {formatPrice(8500)}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white/5 p-4 border border-white/5">
                <Building2 className="h-5 w-5 text-zinc-400 mb-2" />
                <p className="text-xs text-zinc-500 mb-1">Bancolombia</p>
                <p className="font-semibold text-sm">{formatPrice(6000)}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4 border border-white/5">
                <Building2 className="h-5 w-5 text-zinc-400 mb-2" />
                <p className="text-xs text-zinc-500 mb-1">Nequi</p>
                <p className="font-semibold text-sm">{formatPrice(500)}</p>
              </div>
              <div className="rounded-2xl bg-white/5 p-4 border border-white/5 col-span-2">
                <DollarSign className="h-5 w-5 text-emerald-400 mb-2" />
                <p className="text-xs text-zinc-500 mb-1">Cuenta USD (Stripe/Payoneer)</p>
                <p className="font-semibold text-sm">{formatPrice(2000)}</p>
              </div>
            </div>
          </div>
          
        </div>

        {/* Grafica de la seccion seleccionada */}
        {selectedSection && (
          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-2xl mt-6">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {SECTION_LABELS[selectedSection]} - Tendencia 6 Meses
              </h3>
              <button 
                onClick={() => setSelectedSection(null)}
                className="text-xs text-zinc-400 hover:text-white transition-colors rounded-full bg-white/5 px-3 py-1"
              >
                Cerrar
              </button>
            </div>
            <PortfolioChart 
              data={personalChartData} 
              color={SECTION_COLORS[selectedSection]} 
              formatPrice={formatPrice} 
            />
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
