"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import { CashFlowMonthly } from "@/types";
import { formatRupiah } from "@/lib/utils";

interface CashflowChartProps {
  data: CashFlowMonthly[];
}

export function CashflowChart({ data }: CashflowChartProps) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-slate-700 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md">
          <p className="text-xs font-bold text-slate-300 mb-2 border-b border-slate-800 pb-1">
            Bulan {label}
          </p>
          <div className="space-y-1 text-xs">
            <p className="flex items-center justify-between gap-4 text-emerald-400">
              <span>Pemasukan (Debit):</span>
              <span className="font-semibold">{formatRupiah(payload[0].value)}</span>
            </p>
            <p className="flex items-center justify-between gap-4 text-rose-400">
              <span>Pengeluaran (Kredit):</span>
              <span className="font-semibold">{formatRupiah(payload[1].value)}</span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h2 className="text-base font-bold text-slate-100">Grafik Arus Kas Bulanan</h2>
          <p className="text-xs text-slate-400">Visualisasi debit dan kredit tahun {new Date().getFullYear()}</p>
        </div>
        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-emerald-500" />
            <span className="text-slate-300">Debit</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-sm bg-rose-500" />
            <span className="text-slate-300">Kredit</span>
          </div>
        </div>
      </div>

      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis dataKey="bulan" stroke="#64748b" fontSize={11} tickLine={false} />
            <YAxis
              stroke="#64748b"
              fontSize={10}
              tickLine={false}
              tickFormatter={(val: number) => `${val / 1000000}M`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="debit" name="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="kredit" name="Pengeluaran" fill="#f43f5e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
