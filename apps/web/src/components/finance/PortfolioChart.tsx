"use client";

import { useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { format } from "date-fns";

interface ChartDataPoint {
  date: string;
  close: number;
}

interface PortfolioChartProps {
  data: ChartDataPoint[];
  color?: string;
}

export function PortfolioChart({ data, color = "#a855f7" }: PortfolioChartProps) {
  const chartData = useMemo(() => {
    return data.map((d) => ({
      ...d,
      timestamp: new Date(d.date).getTime(),
    }));
  }, [data]);

  const minVal = useMemo(() => {
    if (!data.length) return 0;
    return Math.min(...data.map(d => d.close)) * 0.95;
  }, [data]);

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="timestamp" 
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(val) => format(new Date(val), "MMM dd")}
            stroke="#52525b" 
            tick={{ fill: '#71717a', fontSize: 12 }} 
            axisLine={false} 
            tickLine={false} 
            minTickGap={30}
          />
          <YAxis 
            domain={[minVal, 'dataMax']}
            hide 
          />
          <Tooltip 
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const date = new Date(payload[0].payload.timestamp);
                return (
                  <div className="rounded-lg border border-white/10 bg-neutral-900/90 p-3 shadow-xl backdrop-blur-md">
                    <p className="text-sm font-medium text-zinc-400">{format(date, "MMM dd, yyyy")}</p>
                    <p className="mt-1 text-lg font-bold text-white">
                      ${Number(payload[0].value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Area 
            type="monotone" 
            dataKey="close" 
            stroke={color} 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorGradient)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
