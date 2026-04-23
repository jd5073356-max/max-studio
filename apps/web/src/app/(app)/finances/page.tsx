"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Lock, Send, ArrowLeftRight, Activity } from "lucide-react";
import { AssetCard } from "@/components/finance/AssetCard";
import { PortfolioChart } from "@/components/finance/PortfolioChart";
import { apiFetch } from "@/lib/api";

const ASSETS = [
  { symbol: "BTC-USD", name: "Bitcoin" },
  { symbol: "ETH-USD", name: "Ethereum" },
  { symbol: "SOL-USD", name: "Solana" },
  { symbol: "AAPL", name: "Apple Inc." }
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

  useEffect(() => {
    async function loadData() {
      try {
        const quotePromises = ASSETS.map(asset => 
          apiFetch(`/finance/quote/${asset.symbol}`)
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

        const histRes = await apiFetch("/finance/history/BTC-USD?period=1mo");
        const histData = histRes as { history?: HistoryData[] };
        if (histData && histData.history) {
          setHistory(histData.history);
        }
      } catch (err) {
        console.error("Failed to load finance data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const portfolioValue = 
    (quotes["BTC-USD"]?.price || 0) * 0.15 + 
    (quotes["ETH-USD"]?.price || 0) * 1.5 + 
    (quotes["SOL-USD"]?.price || 0) * 20 + 
    (quotes["AAPL"]?.price || 0) * 10;

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-neutral-950 px-6 py-8 pb-24 text-white">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Finance & Portfolio</h1>
        <div className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm font-medium border border-white/5 backdrop-blur-md">
          <Activity className="h-4 w-4 text-purple-400" />
          <span className="text-zinc-300">Live Market</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="flex flex-col gap-6 xl:col-span-2">
          
          <div className="flex flex-col gap-6 rounded-3xl border border-white/5 bg-white/[0.02] p-8 backdrop-blur-2xl">
            <div>
              <p className="text-zinc-400">Total Portfolio Value</p>
              <div className="mt-2 flex items-end gap-4">
                <h2 className="text-5xl font-bold tracking-tight">
                  ${loading ? "---" : portfolioValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h2>
                <div className="mb-2 flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-sm font-medium text-emerald-400">
                  +1.24% <span className="text-xs text-emerald-400/70">Last 24h</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 mt-2">
              <button className="flex items-center gap-2 rounded-full bg-purple-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-purple-500 shadow-[0_0_20px_-5px_rgba(168,85,247,0.5)]">
                <Lock className="h-4 w-4" /> Buy Asset
              </button>
              <button className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 hover:border-purple-500/30">
                <Send className="h-4 w-4" /> Send
              </button>
              <button className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 hover:border-purple-500/30">
                <ArrowRight className="h-4 w-4" /> Receive
              </button>
              <button className="flex items-center gap-2 rounded-full bg-white/5 border border-white/10 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10 hover:border-purple-500/30">
                <ArrowLeftRight className="h-4 w-4" /> Swap
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/5 bg-white/[0.02] p-6 backdrop-blur-2xl">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Portfolio Overview (BTC)</h3>
              <div className="flex gap-2 rounded-full bg-white/5 p-1">
                {["Day", "Week", "Month", "Year"].map(t => (
                  <button key={t} className={`rounded-full px-4 py-1 text-xs font-medium ${t === 'Month' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            {loading ? (
              <div className="flex h-[300px] items-center justify-center text-zinc-500">Loading chart data...</div>
            ) : (
              <PortfolioChart data={history} color="#a855f7" />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Top Tokens & Assets</h3>
            <button className="text-sm text-purple-400 hover:text-purple-300 transition-colors">View more &rarr;</button>
          </div>
          
          <div className="grid gap-4">
            {ASSETS.map((asset) => {
              const quote = quotes[asset.symbol];
              return (
                <AssetCard
                  key={asset.symbol}
                  name={asset.name}
                  symbol={asset.symbol}
                  price={quote?.price || 0}
                  changePercent={quote?.changePercent || 0}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
