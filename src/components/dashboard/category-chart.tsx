"use client";

import { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { Transaksi } from "@/types";
import { formatRupiah, cn } from "@/lib/utils";
import { CalendarDays, PieChart as PieChartIcon } from "lucide-react";

interface CategoryChartProps {
  transactions: Transaksi[];
}

type TimeRange = "this_month" | "this_year" | "all_time";

// Vibrant colors for the donut chart
const COLORS = [
  "#3b82f6", // blue-500
  "#8b5cf6", // violet-500
  "#ec4899", // pink-500
  "#f97316", // orange-500
  "#14b8a6", // teal-500
  "#eab308", // yellow-500
  "#64748b", // slate-500 (for Others)
];

// Custom Tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="rounded-xl border border-slate-700/80 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-xl">
        <p className="text-xs font-bold text-slate-200 mb-1.5 flex items-center gap-2">
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: data.fill }}
          />
          {data.name}
        </p>
        <p className="text-sm font-black text-slate-100">
          {formatRupiah(data.value)}
        </p>
        <p className="text-[10px] text-slate-400 mt-1">
          {data.percentage}% dari pengeluaran
        </p>
      </div>
    );
  }
  return null;
};

export function CategoryChart({ transactions }: CategoryChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("this_year");

  const chartData = useMemo(() => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const categoryMap = new Map<string, number>();
    let totalPengeluaran = 0;

    transactions.forEach((tx) => {
      // Hanya ambil pengeluaran (KREDIT)
      if (tx.jenis !== "KREDIT") return;

      const date = new Date(tx.tanggal);
      const y = date.getFullYear();
      const m = date.getMonth();

      let shouldInclude = false;
      if (timeRange === "this_month") {
        if (y === currentYear && m === currentMonth) shouldInclude = true;
      } else if (timeRange === "this_year") {
        if (y === currentYear) shouldInclude = true;
      } else if (timeRange === "all_time") {
        shouldInclude = true;
      }

      if (shouldInclude) {
        const catName = tx.kategori_nama || tx.kategori_id;
        const current = categoryMap.get(catName) || 0;
        categoryMap.set(catName, current + tx.nominal);
        totalPengeluaran += tx.nominal;
      }
    });

    if (totalPengeluaran === 0) return { data: [], total: 0 };

    // Urutkan dari terbesar ke terkecil
    const sorted = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        value,
        percentage: ((value / totalPengeluaran) * 100).toFixed(1),
      }));

    // Ambil Top 5, sisanya gabung ke "Lainnya"
    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);

    if (others.length > 0) {
      const othersTotal = others.reduce((sum, item) => sum + item.value, 0);
      top5.push({
        name: "Lainnya",
        value: othersTotal,
        percentage: ((othersTotal / totalPengeluaran) * 100).toFixed(1),
      });
    }

    return { data: top5, total: totalPengeluaran };
  }, [transactions, timeRange]);

  return (
    <div className="rounded-3xl border border-slate-800/80 bg-slate-900/40 p-5 sm:p-6 shadow-xl flex flex-col h-full min-h-[380px]">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-black text-slate-100 tracking-tight flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-indigo-400" />
            Distribusi Kategori
          </h2>
          <p className="text-xs text-slate-400 mt-1">Alokasi dana pengeluaran kas</p>
        </div>

        {/* Time Range Switcher */}
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 self-start">
          <button
            onClick={() => setTimeRange("this_month")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
              timeRange === "this_month" ? "bg-slate-800 text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-300 hover:bg-slate-900"
            )}
          >
            <CalendarDays className="h-3 w-3" /> <span className="hidden sm:inline">Bulan Ini</span>
          </button>
          <button
            onClick={() => setTimeRange("this_year")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
              timeRange === "this_year" ? "bg-slate-800 text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-300 hover:bg-slate-900"
            )}
          >
            <CalendarDays className="h-3 w-3" /> <span className="hidden sm:inline">Tahun Ini</span>
          </button>
          <button
            onClick={() => setTimeRange("all_time")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all",
              timeRange === "all_time" ? "bg-slate-800 text-slate-100 shadow-sm" : "text-slate-400 hover:text-slate-300 hover:bg-slate-900"
            )}
          >
            <CalendarDays className="h-3 w-3" /> <span className="hidden sm:inline">Semua</span>
          </button>
        </div>
      </div>

      <div className="flex-1 w-full min-h-[250px] relative">
        {chartData.data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip content={<CustomTooltip />} />
              <Pie
                data={chartData.data}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
                animationDuration={1200}
                animationEasing="ease-out"
              >
                {chartData.data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.name === "Lainnya" ? COLORS[6] : COLORS[index % (COLORS.length - 1)]} 
                  />
                ))}
              </Pie>
              <Legend
                iconType="circle"
                layout="horizontal"
                verticalAlign="bottom"
                align="center"
                wrapperStyle={{ fontSize: '11px', paddingTop: '20px' }}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
            <PieChartIcon className="h-10 w-10 mb-2 opacity-20" />
            <p className="text-xs font-medium">Belum ada pengeluaran</p>
          </div>
        )}
        
        {/* Center Text for Total */}
        {chartData.data.length > 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Total</span>
            <span className="text-sm font-black text-slate-100 mt-0.5">
              {formatRupiah(chartData.total)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
