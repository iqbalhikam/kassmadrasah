"use client";

import { useEffect, useState, useMemo } from "react";
import { fetchDatabaseAction } from "@/lib/actions";
import { DatabaseData, Transaksi } from "@/types";
import { formatRupiah, formatTanggal } from "@/lib/utils";
import {
  Printer,
  ArrowLeft,
  Loader2,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight,
  TrendingUp,
  CalendarRange,
  CalendarCheck2,
  SlidersHorizontal,
  CheckCircle2,
  Filter,
  Eye,
  Smartphone,
  FileText,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

// ─── Helper: compute cashflow per month from transactions ───────────────────
function buildCashflow(transaksi: Transaksi[]) {
  const monthMap: Record<string, { debit: number; kredit: number }> = {};
  transaksi.forEach((tx) => {
    if (!tx.tanggal) return;
    const d = new Date(tx.tanggal);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthMap[key]) monthMap[key] = { debit: 0, kredit: 0 };
    if (tx.jenis === "DEBIT") monthMap[key].debit += tx.nominal;
    else monthMap[key].kredit += tx.nominal;
  });
  const BULAN_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  return Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => {
      const [, month] = key.split("-");
      return { bulan: BULAN_ID[parseInt(month, 10) - 1], ...val };
    });
}

type FilterMode = "all" | "range";
type PreviewViewMode = "fit" | "a4";

export default function ReportPage() {
  const [dbData, setDbData] = useState<DatabaseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterApplied, setFilterApplied] = useState(false);

  // ── Preview View Mode state (Fit HP vs Paper A4) ──────────────────────────
  const [previewViewMode, setPreviewViewMode] = useState<PreviewViewMode>("fit");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetchDatabaseAction();
        if (res.success && res.data) {
          setDbData(res.data);
          // Set default date range from first/last transaction
          const txDates = res.data.transaksi.map((t: Transaksi) => t.tanggal).filter(Boolean).sort();
          if (txDates.length > 0) {
            setDateFrom(txDates[0]);
            setDateTo(txDates[txDates.length - 1]);
          }
        } else {
          setErrorMsg(res.error || "Gagal memuat data laporan dari Google Sheets.");
        }
      } catch (err: unknown) {
        const e = err as Error;
        setErrorMsg(e.message || "Gagal memuat laporan.");
      } finally {
        setIsLoading(false);
      }
    }
    loadData();
  }, []);

  // ── Filtered transactions (only after Apply) ──────────────────────────────
  const filteredTransaksi = useMemo(() => {
    if (!dbData) return [];
    if (filterMode === "all" || !filterApplied) return dbData.transaksi;
    return dbData.transaksi.filter((tx) => {
      if (!tx.tanggal) return false;
      const d = tx.tanggal;
      return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    });
  }, [dbData, filterMode, filterApplied, dateFrom, dateTo]);

  // ── Recalculate summary from filtered transactions ────────────────────────
  const filteredSummary = useMemo(() => {
    const totalDebit = filteredTransaksi.filter((t) => t.jenis === "DEBIT").reduce((s, t) => s + t.nominal, 0);
    const totalKredit = filteredTransaksi.filter((t) => t.jenis === "KREDIT").reduce((s, t) => s + t.nominal, 0);
    const saldoAwal = dbData?.summary.saldoAwal ?? 0;
    return {
      totalDebit,
      totalKredit,
      saldoAwal,
      saldoAkhir: saldoAwal + totalDebit - totalKredit,
    };
  }, [filteredTransaksi, dbData]);

  const filteredCashflow = useMemo(() => buildCashflow(filteredTransaksi), [filteredTransaksi]);

  // ── Period label for the report header ───────────────────────────────────
  const periodeLabel = useMemo(() => {
    if (filterMode === "all" || !filterApplied) return "Semua Periode";
    const from = dateFrom ? formatTanggal(dateFrom) : "—";
    const to = dateTo ? formatTanggal(dateTo) : "—";
    return `${from} s/d ${to}`;
  }, [filterMode, filterApplied, dateFrom, dateTo]);

  function handleApplyFilter() {
    setFilterApplied(true);
  }

  function handleResetFilter() {
    setFilterMode("all");
    setFilterApplied(false);
  }

  // ── Loading / Error states ─────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm font-semibold">Menyiapkan Laporan PDF &amp; Grafik...</p>
      </div>
    );
  }

  if (errorMsg || !dbData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 text-center">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 max-w-md">
          <h2 className="text-lg font-bold text-rose-400 mb-2">Gagal Memuat Laporan</h2>
          <p className="text-xs text-slate-300 mb-4">{errorMsg}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const { pengaturan } = dbData;

  return (
    <div className="min-h-screen bg-slate-950 py-4 px-3 sm:py-8 sm:px-6">

      {/* ── Top Action Bar (hidden on print) ── */}
      <div className="no-print mx-auto max-w-4xl mb-4 flex items-center justify-between gap-2.5">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
        >
          <ArrowLeft className="h-4 w-4" /> <span className="hidden xs:inline">Kembali</span>
        </Link>

        <button
          id="btn-print-pdf"
          onClick={() => window.print()}
          className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 sm:px-6 sm:py-2.5 text-xs font-bold text-white shadow-xl shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-500 transition active:scale-95"
        >
          <Printer className="h-4 w-4" /> <span>CETAK / SAVE PDF</span>
        </button>
      </div>

      {/* ── Filter Panel (hidden on print) ── */}
      <div className="no-print mx-auto max-w-4xl mb-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl p-4 sm:p-5 backdrop-blur-md">
          {/* Panel Header */}
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 border border-indigo-500/20 shrink-0">
              <SlidersHorizontal className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-bold text-slate-200">Pengaturan Periode Laporan</p>
              <p className="text-[10px] sm:text-[11px] text-slate-400">Pilih periode transaksi yang ingin di-export ke PDF</p>
            </div>
          </div>

          {/* Mode Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3.5">
            <button
              id="filter-mode-all"
              onClick={() => { setFilterMode("all"); setFilterApplied(false); }}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${filterMode === "all"
                  ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                  : "border-slate-800 bg-slate-950/50 hover:bg-slate-800/80"
                }`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${filterMode === "all" ? "bg-emerald-600" : "bg-slate-800"}`}>
                <CalendarCheck2 className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-bold ${filterMode === "all" ? "text-emerald-300" : "text-slate-300"}`}>Export Semua Periode</p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">Semua data transaksi kas</p>
              </div>
              {filterMode === "all" && <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto shrink-0" />}
            </button>

            <button
              id="filter-mode-range"
              onClick={() => { setFilterMode("range"); setFilterApplied(false); }}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${filterMode === "range"
                  ? "border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/30"
                  : "border-slate-800 bg-slate-950/50 hover:bg-slate-800/80"
                }`}
            >
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${filterMode === "range" ? "bg-indigo-600" : "bg-slate-800"}`}>
                <CalendarRange className="h-4 w-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-bold ${filterMode === "range" ? "text-indigo-300" : "text-slate-300"}`}>Pilih Rentang Tanggal</p>
                <p className="text-[10px] text-slate-400 mt-0.5 truncate">Filter tanggal spesifik</p>
              </div>
              {filterMode === "range" && <CheckCircle2 className="h-4 w-4 text-indigo-400 ml-auto shrink-0" />}
            </button>
          </div>

          {/* Date Inputs (shown only in range mode) */}
          {filterMode === "range" && (
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/30 p-3.5 mb-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="date-from" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Dari Tanggal
                  </label>
                  <input
                    id="date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setFilterApplied(false); }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label htmlFor="date-to" className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Sampai Tanggal
                  </label>
                  <input
                    id="date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setFilterApplied(false); }}
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {dateFrom && dateTo && !filterApplied && (
                <p className="mt-2 text-[10px] text-indigo-300 flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  Pratinjau: {dbData.transaksi.filter((tx) => tx.tanggal && tx.tanggal >= dateFrom && tx.tanggal <= dateTo).length} transaksi cocok
                </p>
              )}
            </div>
          )}

          {/* Action Row */}
          <div className="flex items-center gap-2 flex-wrap">
            {filterMode === "range" && (
              <button
                id="btn-apply-filter"
                onClick={handleApplyFilter}
                disabled={!dateFrom || !dateTo}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-500 transition active:scale-95 disabled:opacity-50"
              >
                <Filter className="h-3.5 w-3.5" /> Terapkan Filter
              </button>
            )}

            {(filterMode === "range" && filterApplied) && (
              <button
                id="btn-reset-filter"
                onClick={handleResetFilter}
                className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
              >
                Reset
              </button>
            )}

            {filterMode === "all" && (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-[11px] font-bold text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Menampilkan {dbData.transaksi.length} transaksi
              </span>
            )}
            {filterMode === "range" && filterApplied && (
              <span className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-[11px] font-bold text-indigo-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {filteredTransaksi.length} transaksi &bull; {periodeLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile Preview View Mode Selector (hidden on print) ── */}
      <div className="no-print mx-auto max-w-4xl mb-3 flex items-center justify-between px-1">
        <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5">
          <Eye className="h-3.5 w-3.5 text-emerald-400" /> Mode Preview Laporan:
        </span>
        <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setPreviewViewMode("fit")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition",
              previewViewMode === "fit"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <Smartphone className="h-3.5 w-3.5" />
            <span>Fit HP</span>
          </button>
          <button
            onClick={() => setPreviewViewMode("a4")}
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition",
              previewViewMode === "a4"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            )}
          >
            <FileText className="h-3.5 w-3.5" />
            <span>Kertas A4</span>
          </button>
        </div>
      </div>

      {/* ── Printable Report Document Container ── */}
      <div className={cn("mx-auto max-w-4xl", previewViewMode === "a4" && "overflow-x-auto pb-4")}>
        <div
          className={cn(
            "print-card bg-white text-slate-900 shadow-2xl transition-all duration-200",
            previewViewMode === "a4"
              ? "w-[794px] min-w-[794px] p-8 mx-auto rounded-none border border-slate-300"
              : "w-full rounded-2xl border border-slate-700/80 p-4 sm:p-8 space-y-5"
          )}
        >
          {/* Kop Surat / Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-slate-900 pb-4">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <div className="flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-xl sm:rounded-2xl overflow-hidden bg-white shadow-md border border-slate-200 shrink-0">
                <Image
                  src="/logo/logo.jpeg"
                  alt="Logo Madrasah"
                  width={64}
                  height={64}
                  className="object-contain w-full h-full p-0.5 sm:p-1"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-2xl font-black uppercase tracking-tight text-slate-900 leading-tight truncate">
                  {pengaturan.nama_madrasah}
                </h1>
                <p className="text-[10px] sm:text-xs font-semibold text-slate-600 uppercase tracking-wider sm:tracking-widest mt-0.5 truncate">
                  LAPORAN PERTANGGUNGJAWABAN KEUANGAN KAS
                </p>
                <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">
                  Periode: <span className="font-semibold text-slate-800">{periodeLabel}</span>
                </p>
              </div>
            </div>

            <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200 text-[10px] sm:text-xs text-slate-600 shrink-0">
              <div>
                <span className="font-bold text-slate-800">Tanggal Cetak: </span>
                <span>{formatTanggal(new Date().toISOString().split("T")[0])}</span>
              </div>
              <span className="mt-0.5 rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                {filteredTransaksi.length} transaksi
              </span>
            </div>
          </div>

          {/* ── Executive Summary Cards ── */}
          <div className="mt-4">
            <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Ringkasan Keuangan Kas
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 text-slate-900">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 sm:p-3">
                <p className="text-[9px] sm:text-[10px] font-semibold text-slate-500 uppercase">Saldo Awal</p>
                <p className="text-xs sm:text-base font-black text-slate-800 mt-0.5 truncate">{formatRupiah(filteredSummary.saldoAwal)}</p>
              </div>

              <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-2.5 sm:p-3">
                <p className="text-[9px] sm:text-[10px] font-semibold text-emerald-700 uppercase flex items-center gap-1">
                  <ArrowDownLeft className="h-3 w-3 shrink-0" /> Total Debit
                </p>
                <p className="text-xs sm:text-base font-black text-emerald-700 mt-0.5 truncate">{formatRupiah(filteredSummary.totalDebit)}</p>
              </div>

              <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-2.5 sm:p-3">
                <p className="text-[9px] sm:text-[10px] font-semibold text-rose-700 uppercase flex items-center gap-1">
                  <ArrowUpRight className="h-3 w-3 shrink-0" /> Total Kredit
                </p>
                <p className="text-xs sm:text-base font-black text-rose-700 mt-0.5 truncate">{formatRupiah(filteredSummary.totalKredit)}</p>
              </div>

              <div className="rounded-xl border border-teal-300 bg-teal-50 p-2.5 sm:p-3">
                <p className="text-[9px] sm:text-[10px] font-semibold text-teal-800 uppercase flex items-center gap-1">
                  <Wallet className="h-3 w-3 shrink-0" /> Saldo Akhir
                </p>
                <p className="text-xs sm:text-base font-black text-teal-900 mt-0.5 truncate">{formatRupiah(filteredSummary.saldoAkhir)}</p>
              </div>
            </div>
          </div>

          {/* ── Chart ── */}
          <div className="mt-4">
            {filteredCashflow.length > 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-700 shrink-0" /> Grafik Visualisasi Arus Kas Bulanan
                </h3>
                <div className="h-[180px] sm:h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredCashflow} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="bulan" stroke="#475569" fontSize={9} tickLine={false} />
                      <YAxis
                        stroke="#475569"
                        fontSize={8}
                        tickLine={false}
                        tickFormatter={(val: number) => `${val / 1000000}M`}
                      />
                      <Tooltip
                        formatter={(value: unknown) => formatRupiah(Number(value))}
                        contentStyle={{ backgroundColor: "#ffffff", borderRadius: "8px", borderColor: "#cbd5e1", fontSize: "11px" }}
                      />
                      <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "6px" }} />
                      <Bar dataKey="debit" name="Debit (Penerimaan)" fill="#059669" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="kredit" name="Kredit (Pengeluaran)" fill="#e11d48" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400">
                Tidak ada data transaksi pada periode ini untuk ditampilkan grafiknya.
              </div>
            )}
          </div>

          {/* ── Rincian Transaksi Table ── */}
          <div className="mt-4">
            <h3 className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Rincian Catatan Transaksi Kas ({filteredTransaksi.length} transaksi)
            </h3>
            {filteredTransaksi.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400">
                Tidak ada transaksi pada periode yang dipilih.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-sm">
                <table className="w-full text-left text-[11px] sm:text-xs text-slate-800">
                  <thead className="bg-slate-100 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-700 border-b border-slate-300">
                    <tr>
                      <th className="px-2.5 py-2 whitespace-nowrap">No</th>
                      <th className="px-2.5 py-2 whitespace-nowrap">Tanggal</th>
                      <th className="px-2.5 py-2 whitespace-nowrap">Kategori</th>
                      <th className="px-2.5 py-2 min-w-[120px]">Keterangan</th>
                      <th className="px-2.5 py-2 text-center whitespace-nowrap">Jenis</th>
                      <th className="px-2.5 py-2 text-right whitespace-nowrap">Nominal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredTransaksi.map((tx, idx) => {
                      const isDebit = tx.jenis === "DEBIT";
                      return (
                        <tr key={tx.id} className="hover:bg-slate-50">
                          <td className="px-2.5 py-2 text-slate-500 font-mono text-[10px] sm:text-xs">{idx + 1}</td>
                          <td className="px-2.5 py-2 font-medium whitespace-nowrap">{formatTanggal(tx.tanggal)}</td>
                          <td className="px-2.5 py-2 font-semibold whitespace-nowrap">{tx.kategori_nama || tx.kategori_id}</td>
                          <td className="px-2.5 py-2 leading-tight">{tx.keterangan}</td>
                          <td className="px-2.5 py-2 text-center font-bold whitespace-nowrap">
                            <span className={cn("px-2 py-0.5 rounded-full text-[10px]", isDebit ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-rose-100 text-rose-800 border border-rose-300")}>
                              {isDebit ? "DEBIT" : "KREDIT"}
                            </span>
                          </td>
                          <td className={cn("px-2.5 py-2 text-right font-bold whitespace-nowrap", isDebit ? "text-emerald-700" : "text-rose-700")}>
                            {isDebit ? "+" : "-"} {formatRupiah(tx.nominal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {/* Totals row */}
                  <tfoot className="border-t-2 border-slate-400 bg-slate-100 font-bold text-[11px] sm:text-xs">
                    <tr>
                      <td colSpan={4} className="px-2.5 py-2 font-bold text-slate-700">TOTAL PERIODE</td>
                      <td className="px-2.5 py-2 text-center text-slate-600 whitespace-nowrap">
                        {filteredTransaksi.filter((t) => t.jenis === "DEBIT").length}D &nbsp;/&nbsp; {filteredTransaksi.filter((t) => t.jenis === "KREDIT").length}K
                      </td>
                      <td className="px-2.5 py-2 text-right whitespace-nowrap">
                        <span className="text-emerald-700">+{formatRupiah(filteredSummary.totalDebit)}</span>
                        {" / "}
                        <span className="text-rose-700">-{formatRupiah(filteredSummary.totalKredit)}</span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ── Signature Blocks ── */}
          <div className="pt-6 sm:pt-8 border-t border-slate-300 grid grid-cols-2 gap-4 text-center text-[10px] sm:text-xs mt-6">
            <div>
              <p className="text-slate-500">Mengetahui,</p>
              <p className="font-bold text-slate-900 mb-12 sm:mb-16">Kepala Madrasah</p>
              <p className="font-bold text-slate-900 underline truncate">{pengaturan.nama_kepala_madrasah}</p>
            </div>

            <div>
              <p className="text-slate-500">
                {formatTanggal(new Date().toISOString().split("T")[0])}
              </p>
              <p className="font-bold text-slate-900 mb-12 sm:mb-16">Bendahara Kas</p>
              <p className="font-bold text-slate-900 underline truncate">{pengaturan.nama_bendahara}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-12" />
    </div>
  );
}
