"use client";

import { ArrowDownLeft, ArrowUpRight, Wallet, Landmark, ReceiptText } from "lucide-react";
import { formatRupiah } from "@/lib/utils";
import { KasSummary } from "@/types";

interface StatCardsProps {
  summary: KasSummary;
}

export function StatCards({ summary }: StatCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Real-time Balance Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-900/40 via-slate-900 to-slate-900 p-5 border border-emerald-500/30 shadow-xl shadow-emerald-950/20">
        <div className="absolute top-0 right-0 -mt-2 -mr-2 h-24 w-24 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            Saldo Kas Real-Time
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300">
            <Wallet className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-2xl font-black text-white tracking-tight">
            {formatRupiah(summary.saldoAkhir)}
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Termasuk Saldo Awal: <span className="text-slate-300 font-medium">{formatRupiah(summary.saldoAwal)}</span>
          </p>
        </div>
      </div>

      {/* Total Debit (Penerimaan) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-teal-400">
            Total Pemasukan (Debit)
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20">
            <ArrowDownLeft className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-2xl font-bold text-teal-300 tracking-tight">
            {formatRupiah(summary.totalDebit)}
          </h3>
          <p className="mt-1 text-xs text-slate-400">Total penerimaan kas terkini</p>
        </div>
      </div>

      {/* Total Kredit (Pengeluaran) */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
            Total Pengeluaran (Kredit)
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <ArrowUpRight className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-2xl font-bold text-rose-400 tracking-tight">
            {formatRupiah(summary.totalKredit)}
          </h3>
          <p className="mt-1 text-xs text-slate-400">Total pengeluaran kas terkini</p>
        </div>
      </div>

      {/* Total Transaksi Count */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
            Total Transaksi
          </span>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <ReceiptText className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3">
          <h3 className="text-2xl font-bold text-slate-100 tracking-tight">
            {summary.totalTransaksi} <span className="text-sm font-normal text-slate-400">catatan</span>
          </h3>
          <p className="mt-1 text-xs text-slate-400">Transaksi tercatat di Sheets</p>
        </div>
      </div>
    </div>
  );
}
