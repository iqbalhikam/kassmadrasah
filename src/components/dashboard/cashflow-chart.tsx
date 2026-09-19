"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  AreaChart,
  ComposedChart,
  Bar,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Transaksi } from "@/types";
import { formatRupiah, cn } from "@/lib/utils";
import { BarChart3, TrendingUp, LineChart, CalendarDays } from "lucide-react";

interface CashflowChartProps {
  transactions: Transaksi[];
}

type ChartType = "bar" | "area" | "composed";
type TimeRange = "this_month" | "this_year" | "all_time";

interface TooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
}

// Custom Tooltip component
function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (active && payload && payload.length) {
    const debit = payload.find((p) => p.dataKey === "debit")?.value ?? 0;
    const kredit = payload.find((p) => p.dataKey === "kredit")?.value ?? 0;
    const net = payload.find((p) => p.dataKey === "saldo_bersih")?.value ?? (debit - kredit);

    return (
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 p-3.5 shadow-2xl backdrop-blur-xl">
        <p className="text-xs font-bold text-slate-200 mb-2.5 border-b border-slate-800 pb-1.5">
          {label}
        </p>
        <div className="space-y-2 text-xs">
          <p className="flex items-center justify-between gap-6 text-emerald-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-400" /> Pemasukan:
            </span>
            <span className="font-bold">{formatRupiah(debit)}</span>
          </p>
          <p className="flex items-center justify-between gap-6 text-rose-400">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-rose-400" /> Pengeluaran:
            </span>
            <span className="font-bold">{formatRupiah(kredit)}</span>
          </p>
          <div className="h-px w-full bg-slate-800 my-1" />
          <p className={cn(
            "flex items-center justify-between gap-6",
            net >= 0 ? "text-teal-300" : "text-amber-400"
          )}>
            <span className="flex items-center gap-1.5 font-semibold">
              <span className={cn(
                "h-2 w-2 rounded-full",
                net >= 0 ? "bg-teal-400" : "bg-amber-400"
              )} /> 
              Saldo Bersih:
            </span>
            <span className="font-black">{net < 0 ? "-" : "+"}{formatRupiah(Math.abs(net))}</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
}

export function CashflowChart({ transactions }: CashflowChartProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [timeRange, setTimeRange] = useState<TimeRange>("this_year");

  // Aggregate data based on time range
  const chartData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const dataMap = new Map<string, { label: string; debit: number; kredit: number; sortKey: number }>();

    transactions.forEach((tx) => {
      const date = new Date(tx.tanggal);
      const y = date.getFullYear();
      const m = date.getMonth();
      const d = date.getDate();

      let key = "";
      let label = "";
      let sortKey = 0;
      let shouldInclude = false;

      if (timeRange === "this_month") {
        if (y === currentYear && m === currentMonth) {
          key = `day-${d}`;
          label = `Tgl ${d}`;
          sortKey = d;
          shouldInclude = true;
        }
      } else if (timeRange === "this_year") {
        if (y === currentYear) {
          key = `month-${m}`;
          label = new Intl.DateTimeFormat("id-ID", { month: "short" }).format(date);
          sortKey = m;
          shouldInclude = true;
        }
      } else if (timeRange === "all_time") {
        key = `year-${y}`;
        label = `${y}`;
        sortKey = y;
        shouldInclude = true;
      }

      if (shouldInclude) {
        const existing = dataMap.get(key) || { label, debit: 0, kredit: 0, sortKey };
        if (tx.jenis === "DEBIT") {
          existing.debit += tx.nominal;
        } else {
          existing.kredit += tx.nominal;
        }
        dataMap.set(key, existing);
      }
    });

    // Convert map to array and sort
    const aggregated = Array.from(dataMap.values()).sort((a, b) => a.sortKey - b.sortKey);

    // Ensure all days/months are present even if no data, for a continuous chart
    if (timeRange === "this_month") {
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      const filled = [];
      for (let i = 1; i <= daysInMonth; i++) {
        const existing = aggregated.find((a) => a.sortKey === i);
        filled.push(existing || { label: `Tgl ${i}`, debit: 0, kredit: 0, sortKey: i });
      }
      return filled.map(item => ({ ...item, saldo_bersih: item.debit - item.kredit }));
    }

    if (timeRange === "this_year") {
      const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agt", "Sep", "Okt", "Nov", "Des"];
      const filled = months.map((m, i) => {
        const existing = aggregated.find((a) => a.sortKey === i);
        return existing || { label: m, debit: 0, kredit: 0, sortKey: i };
      });
      return filled.map(item => ({ ...item, saldo_bersih: item.debit - item.kredit }));
    }

    return aggregated.map(item => ({ ...item, saldo_bersih: item.debit - item.kredit }));
  }, [transactions, timeRange]);

  const renderGradientDefs = () => (
    <defs>
      <linearGradient id="colorDebit" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
        <stop offset="95%" stopColor="#059669" stopOpacity={0.1} />
      </linearGradient>
      <linearGradient id="colorKredit" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
        <stop offset="95%" stopColor="#e11d48" stopOpacity={0.1} />
      </linearGradient>
    </defs>
  );

  return (
    <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-5 sm:p-6 shadow-xl flex flex-col">
      {/* Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-black text-slate-100 tracking-tight flex items-center gap-2">
            Grafik Arus Kas
          </h2>
          <p className="text-xs text-slate-400 mt-1">Perbandingan Pemasukan, Pengeluaran & Saldo</p>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Time Range Switcher */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              onClick={() => setTimeRange("this_month")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
                timeRange === "this_month" ? "bg-slate-800 text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-300 hover:bg-slate-900"
              )}
            >
              <CalendarDays className="h-3 w-3" /> <span>Bulan Ini</span>
            </button>
            <button
              onClick={() => setTimeRange("this_year")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
                timeRange === "this_year" ? "bg-slate-800 text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-300 hover:bg-slate-900"
              )}
            >
              <CalendarDays className="h-3 w-3" /> <span>Tahun Ini</span>
            </button>
            <button
              onClick={() => setTimeRange("all_time")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
                timeRange === "all_time" ? "bg-slate-800 text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-300 hover:bg-slate-900"
              )}
            >
              <CalendarDays className="h-3 w-3" /> <span>Semua</span>
            </button>
          </div>

          {/* Chart Type Switcher */}
          <div className="inline-flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800">
            <button
              onClick={() => setChartType("bar")}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg transition-all",
                chartType === "bar" ? "bg-slate-800 text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-300 hover:bg-slate-900"
              )}
              title="Bar Chart"
            >
              <BarChart3 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setChartType("area")}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg transition-all",
                chartType === "area" ? "bg-slate-800 text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-300 hover:bg-slate-900"
              )}
              title="Area Chart"
            >
              <LineChart className="h-4 w-4" />
            </button>
            <button
              onClick={() => setChartType("composed")}
              className={cn(
                "flex items-center justify-center w-8 h-8 rounded-lg transition-all",
                chartType === "composed" ? "bg-slate-800 text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-300 hover:bg-slate-900"
              )}
              title="Composed Chart"
            >
              <TrendingUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Chart Area */}
      <div className="h-[280px] sm:h-[320px] w-full mt-2 min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              {renderGradientDefs()}
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.5} />
              <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: number) => `${val / 1000000}M`}
                dx={-10}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b', opacity: 0.4 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="debit" name="Pemasukan" fill="url(#colorDebit)" radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={1000} />
              <Bar dataKey="kredit" name="Pengeluaran" fill="url(#colorKredit)" radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={1000} />
            </BarChart>
          ) : chartType === "area" ? (
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              {renderGradientDefs()}
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.5} />
              <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: number) => `${val / 1000000}M`}
                dx={-10}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Area type="monotone" dataKey="debit" name="Pemasukan" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorDebit)" animationDuration={1000} />
              <Area type="monotone" dataKey="kredit" name="Pengeluaran" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorKredit)" animationDuration={1000} />
            </AreaChart>
          ) : (
            <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              {renderGradientDefs()}
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} opacity={0.5} />
              <XAxis dataKey="label" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} dy={10} />
              <YAxis
                stroke="#64748b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val: number) => `${val / 1000000}M`}
                dx={-10}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#1e293b', opacity: 0.4 }} />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
              <Bar dataKey="debit" name="Pemasukan" fill="url(#colorDebit)" radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={1000} />
              <Bar dataKey="kredit" name="Pengeluaran" fill="url(#colorKredit)" radius={[4, 4, 0, 0]} maxBarSize={32} animationDuration={1000} />
              <Line type="monotone" dataKey="saldo_bersih" name="Saldo Bersih" stroke="#2dd4bf" strokeWidth={3} dot={{ r: 4, fill: '#0f172a', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#2dd4bf' }} animationDuration={1000} />
            </ComposedChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
