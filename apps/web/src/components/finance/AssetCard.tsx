import { ReactNode } from "react";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface AssetCardProps {
  name: string;
  symbol: string;
  price: number;
  changePercent: number;
  marketCap?: string;
  icon?: ReactNode;
  onClick?: () => void;
  formatPrice?: (value: number) => string;
}

export function AssetCard({ name, symbol, price, changePercent, marketCap, icon, onClick, formatPrice }: AssetCardProps) {
  const isPositive = changePercent >= 0;
  
  return (
    <div onClick={onClick} className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/5 p-5 backdrop-blur-xl transition-all hover:border-purple-500/40 hover:bg-white/10 hover:shadow-[0_0_30px_-5px_rgba(168,85,247,0.15)] group cursor-pointer">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {icon ? (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/20 text-purple-400">
              {icon}
            </div>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 font-bold">
              {symbol[0]}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-zinc-100">{name} <span className="text-sm font-normal text-zinc-500">({symbol})</span></h3>
            {marketCap && <p className="text-xs text-zinc-500">{marketCap}</p>}
          </div>
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-zinc-400 group-hover:bg-purple-500/20 group-hover:text-purple-400 transition-colors">
          <ArrowUpRight className="h-4 w-4" />
        </div>
      </div>
      
      <div className="mt-6 flex items-end justify-between">
        <div className="text-2xl font-bold tracking-tight text-white">
          {formatPrice 
            ? formatPrice(price)
            : `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        </div>
        <div className={cn(
          "flex items-center gap-1 text-sm font-medium px-2 py-0.5 rounded-full",
          isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
        )}>
          {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isPositive ? "+" : ""}{changePercent.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}
