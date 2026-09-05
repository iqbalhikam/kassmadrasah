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
  Download,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";



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
  const [isExporting, setIsExporting] = useState(false);

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

  // ── Export PDF directly using html2pdf.js ─────────────────────────────────
  const handleExportPDF = async () => {
    setIsExporting(true);

    // Regex to detect CSS color functions unsupported by html2canvas
    const UNSUPPORTED_COLOR_RE =
      /\b(okrgba|oklab|oklch|lab|color-mix|light-dark|hwb|device-cmyk)\b/i;

    const sanitizeColor = (val: string): string => {
      if (!val || typeof val !== "string") return val;
      if (!UNSUPPORTED_COLOR_RE.test(val)) return val;
      // Return solid dark fallback so text stays visible
      return "rgb(15, 23, 42)";
    };

    const makeColorProxy = (style: CSSStyleDeclaration) =>
      new Proxy(style, {
        get(target, prop) {
          const raw = Reflect.get(target, prop, target);
          if (typeof raw === "string") return sanitizeColor(raw);
          if (typeof raw === "function") {
            return (...args: any[]) => {
              const result = (raw as Function).apply(target, args);
              return typeof result === "string" ? sanitizeColor(result) : result;
            };
          }
          return raw;
        },
      });

    // Patch window.getComputedStyle so html2canvas never sees unsupported colors
    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function (elt: Element, pseudo?: string | null) {
      return makeColorProxy(originalGetComputedStyle.call(window, elt, pseudo));
    };

    try {
      const html2pdf = (await import("html2pdf.js")).default;
      const element = document.getElementById("printable-report");
      if (!element) throw new Error("Elemen laporan tidak ditemukan.");

      const madrasahName = dbData?.pengaturan.nama_madrasah || "Kas_Madrasah";
      const cleanName = madrasahName.replace(/[^a-zA-Z0-9]/g, "_");
      const dateStr = new Date().toISOString().split("T")[0];
      const fileName = `Laporan_Kas_${cleanName}_${dateStr}.pdf`;

      const opt = {
        margin: [10, 10, 10, 10] as [number, number, number, number],
        filename: fileName,
        image: { type: "jpeg" as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          windowWidth: 850,
          onclone: (clonedDoc: Document) => {
            // Patch getComputedStyle on the cloned window too
            if (clonedDoc.defaultView) {
              const origClone = clonedDoc.defaultView.getComputedStyle;
              clonedDoc.defaultView.getComputedStyle = function (elt: Element, pseudo?: string | null) {
                return makeColorProxy(origClone.call(clonedDoc.defaultView, elt, pseudo));
              };
            }

            // Set fixed A4 dimensions on the printable root
            const reportEl = clonedDoc.getElementById("printable-report");
            if (reportEl) {
              reportEl.style.width = "794px";
              reportEl.style.minWidth = "794px";
              reportEl.style.maxWidth = "794px";
              reportEl.style.padding = "32px";
              reportEl.style.margin = "0 auto";
              reportEl.style.boxSizing = "border-box";
              reportEl.style.borderRadius = "0px";
              reportEl.style.backgroundColor = "#ffffff";
              reportEl.style.color = "#0f172a";
            }

            // Sanitize CSS custom properties on inline styles (but keep all <style>/<link> tags)
            clonedDoc.querySelectorAll<HTMLElement>("*").forEach((el) => {
              try {
                if (!el.style || el.style.length === 0) return;
                for (let i = el.style.length - 1; i >= 0; i--) {
                  const prop = el.style[i];
                  if (!prop || !prop.startsWith("--")) continue;
                  const val = el.style.getPropertyValue(prop);
                  if (UNSUPPORTED_COLOR_RE.test(val)) el.style.removeProperty(prop);
                }
              } catch {}
            });

            // Sanitize text inside inline <style> blocks (don't remove them)
            clonedDoc.querySelectorAll("style").forEach((styleEl) => {
              try {
                const orig = styleEl.textContent || "";
                const sanitized = orig.replace(
                  /:\s*(?:okrgba|oklab|oklch|lab|color-mix|light-dark|hwb|device-cmyk)\s*\([^;{}]*\)/gi,
                  ": rgb(15, 23, 42)"
                );
                if (sanitized !== orig) styleEl.textContent = sanitized;
              } catch {}
            });

            // Force centering on badge wrapper divs via setProperty (works with !important)
            clonedDoc.querySelectorAll<HTMLElement>("div[data-badge-wrap='jenis']").forEach((div) => {
              div.style.setProperty("text-align", "center", "important");
              div.style.setProperty("width", "100%", "important");
              div.style.setProperty("display", "block", "important");
              const span = div.querySelector("span");
              if (span instanceof HTMLElement) {
                span.style.setProperty("display", "inline-block", "important");
              }
            });
          },
        },
        jsPDF: {
          unit: "mm" as const,
          format: "a4" as const,
          orientation: "portrait" as const,
        },
        pagebreak: { mode: ["avoid-all", "css", "legacy"], avoid: ["tr"] },
      };

      await html2pdf().set(opt).from(element).save();
    } catch (err: any) {
      console.error("PDF export failed:", err);
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
      setIsExporting(false);
    }
  };

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

  // ── Running balance map for PDF report (all transactions, chronological) ──
  const runningBalanceMap = useMemo(() => {
    if (!dbData) return new Map<string, number>();
    const saldoAwal = dbData.summary.saldoAwal ?? 0;
    const sorted = [...dbData.transaksi].sort((a, b) => {
      const dateA = new Date(a.tanggal).getTime();
      const dateB = new Date(b.tanggal).getTime();
      if (dateA !== dateB) return dateA - dateB;
      const cA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const cB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return cA - cB;
    });
    let running = saldoAwal;
    const map = new Map<string, number>();
    sorted.forEach((t) => {
      running += t.jenis === "DEBIT" ? t.nominal : -t.nominal;
      map.set(t.id, running);
    });
    return map;
  }, [dbData]);

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

        <div className="flex items-center gap-2">
          <button
            id="btn-export-pdf"
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 sm:px-6 sm:py-2.5 text-xs font-bold text-white shadow-xl shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-500 transition active:scale-95 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Mengunduh PDF...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4 text-white" />
                <span>DOWNLOAD / EXPORT PDF</span>
              </>
            )}
          </button>

          <button
            id="btn-print-pdf"
            onClick={() => window.print()}
            title="Cetak via browser"
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
          >
            <Printer className="h-4 w-4" />
          </button>
        </div>
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
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                filterMode === "all"
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
              className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${
                filterMode === "range"
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
          id="printable-report"
          className={cn(
            "print-card bg-white text-slate-900 shadow-2xl transition-all duration-200",
            previewViewMode === "a4"
              ? "w-[794px] min-w-[794px] p-8 mx-auto rounded-none border border-slate-300"
              : "w-full rounded-2xl border border-slate-700/80 p-4 sm:p-8 space-y-5"
          )}
        >
          {/* Kop Surat / Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", borderBottom: "2px solid #0f172a", paddingBottom: "16px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", minWidth: 0 }}>
              <div style={{ width: "60px", height: "60px", borderRadius: "12px", border: "1px solid #e2e8f0", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff", padding: "4px", flexShrink: 0 }}>
                <Image
                  src="/logo/logo.jpeg"
                  alt="Logo Madrasah"
                  width={60}
                  height={60}
                  style={{ objectFit: "contain", width: "100%", height: "100%" }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <h1 style={{ fontSize: "18px", fontWeight: 800, textTransform: "uppercase", color: "#0f172a", margin: 0, lineHeight: 1.2, fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
                  {pengaturan.nama_madrasah}
                </h1>
                <p style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", margin: "4px 0 0 0", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
                  LAPORAN PERTANGGUNGJAWABAN KEUANGAN KAS
                </p>
                <p style={{ fontSize: "11px", color: "#64748b", margin: "2px 0 0 0", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
                  Periode: <strong style={{ color: "#0f172a" }}>{periodeLabel}</strong>
                </p>
              </div>
            </div>

            <div style={{ textAlign: "right", fontSize: "11px", color: "#475569", flexShrink: 0, fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
              <p style={{ margin: 0 }}>
                <strong style={{ color: "#0f172a" }}>Tanggal Cetak: </strong>
                {formatTanggal(new Date().toISOString().split("T")[0])}
              </p>
              <span style={{ display: "inline-block", marginTop: "4px", backgroundColor: "#f1f5f9", padding: "3px 8px", borderRadius: "6px", fontWeight: 600, color: "#334155", fontSize: "10px" }}>
                {filteredTransaksi.length} transaksi
              </span>
            </div>
          </div>

          {/* ── Executive Summary Cards ── */}
          <div style={{ marginTop: "20px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif", pageBreakInside: "avoid", breakInside: "avoid" }}>
            <h3 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#64748b", marginBottom: "8px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
              Ringkasan Keuangan Kas
            </h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
              <div style={{ borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", padding: "12px 14px" }}>
                <p style={{ fontSize: "9.5px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", margin: 0, letterSpacing: "0.5px" }}>Saldo Awal</p>
                <p style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", margin: "4px 0 0 0" }}>{formatRupiah(filteredSummary.saldoAwal)}</p>
              </div>

              <div style={{ borderRadius: "12px", border: "1px solid #bbf7d0", backgroundColor: "#f0fdf4", padding: "12px 14px" }}>
                <p style={{ fontSize: "9.5px", fontWeight: 700, color: "#15803d", textTransform: "uppercase", margin: 0, letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <ArrowDownLeft className="h-3 w-3 shrink-0" /> Total Debit
                </p>
                <p style={{ fontSize: "15px", fontWeight: 800, color: "#15803d", margin: "4px 0 0 0" }}>{formatRupiah(filteredSummary.totalDebit)}</p>
              </div>

              <div style={{ borderRadius: "12px", border: "1px solid #fecdd3", backgroundColor: "#fff1f2", padding: "12px 14px" }}>
                <p style={{ fontSize: "9.5px", fontWeight: 700, color: "#b91c1c", textTransform: "uppercase", margin: 0, letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <ArrowUpRight className="h-3 w-3 shrink-0" /> Total Kredit
                </p>
                <p style={{ fontSize: "15px", fontWeight: 800, color: "#b91c1c", margin: "4px 0 0 0" }}>{formatRupiah(filteredSummary.totalKredit)}</p>
              </div>

              <div style={{ borderRadius: "12px", border: "1px solid #99f6e4", backgroundColor: "#f0fdfa", padding: "12px 14px" }}>
                <p style={{ fontSize: "9.5px", fontWeight: 700, color: "#0f766e", textTransform: "uppercase", margin: 0, letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Wallet className="h-3 w-3 shrink-0" /> Saldo Akhir
                </p>
                <p style={{ fontSize: "15px", fontWeight: 800, color: "#0f766e", margin: "4px 0 0 0" }}>{formatRupiah(filteredSummary.saldoAkhir)}</p>
              </div>
            </div>
          </div>

          {/* ── Chart ── */}
          <div style={{ marginTop: "20px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif", pageBreakInside: "avoid", breakInside: "avoid" }}>
            {filteredCashflow.length > 0 ? (() => {
              // ── Pure SVG chart (html2canvas-safe) ──
              const SVG_W = 740;
              const SVG_H = 200;
              const ML = 58; // margin left
              const MR = 16; // margin right
              const MT = 14; // margin top
              const MB = 34; // margin bottom (room for X labels + legend)
              const CW = SVG_W - ML - MR;
              const CH = SVG_H - MT - MB;

              const maxVal = Math.max(...filteredCashflow.flatMap((d) => [d.debit, d.kredit]), 1);
              // Round up to a nice number
              const rawStep = maxVal / 4;
              const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
              const niceStep = Math.ceil(rawStep / magnitude) * magnitude;
              const yMax = niceStep * 5;
              const yTicks = [0, 1, 2, 3, 4, 5].map((i) => i * niceStep);

              const formatY = (v: number) => {
                if (v >= 1_000_000) return `${(v / 1_000_000 % 1 === 0 ? v / 1_000_000 : (v / 1_000_000).toFixed(1))}jt`;
                if (v >= 1_000) return `${Math.round(v / 1_000)}rb`;
                return `${v}`;
              };

              const n = filteredCashflow.length;
              const slotW = CW / n;
              const barW = Math.min(slotW * 0.28, 22);
              const gap = 3;

              return (
                <div style={{ borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", padding: "12px 16px" }}>
                  <h3 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#334155", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-700 shrink-0" /> Grafik Visualisasi Arus Kas Bulanan
                  </h3>
                  <svg
                    viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                    width="100%"
                    height={SVG_H}
                    style={{ display: "block", overflow: "visible" }}
                  >
                    {/* Grid lines & Y-axis labels */}
                    {yTicks.map((tick, i) => {
                      const y = MT + CH - (tick / yMax) * CH;
                      return (
                        <g key={i}>
                          <line
                            x1={ML} y1={y} x2={ML + CW} y2={y}
                            stroke={tick === 0 ? "#94a3b8" : "#e2e8f0"}
                            strokeWidth={tick === 0 ? 1.2 : 0.8}
                            strokeDasharray={tick === 0 ? "0" : "3 3"}
                          />
                          <text
                            x={ML - 6} y={y + 3.5}
                            textAnchor="end"
                            fontSize={7.5}
                            fill="#94a3b8"
                            fontFamily="Inter, sans-serif"
                          >
                            {formatY(tick)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Bars */}
                    {filteredCashflow.map((d, i) => {
                      const slotX = ML + i * slotW;
                      const centerX = slotX + slotW / 2;
                      const debitH = (d.debit / yMax) * CH;
                      const kreditH = (d.kredit / yMax) * CH;
                      const barBaseY = MT + CH;

                      return (
                        <g key={i}>
                          {/* Debit bar */}
                          {d.debit > 0 && (
                            <rect
                              x={centerX - gap / 2 - barW}
                              y={barBaseY - debitH}
                              width={barW}
                              height={debitH}
                              fill="#059669"
                              rx={3}
                              ry={3}
                            />
                          )}
                          {/* Kredit bar */}
                          {d.kredit > 0 && (
                            <rect
                              x={centerX + gap / 2}
                              y={barBaseY - kreditH}
                              width={barW}
                              height={kreditH}
                              fill="#e11d48"
                              rx={3}
                              ry={3}
                            />
                          )}
                          {/* X label */}
                          <text
                            x={centerX}
                            y={barBaseY + 12}
                            textAnchor="middle"
                            fontSize={8.5}
                            fill="#64748b"
                            fontFamily="Inter, sans-serif"
                          >
                            {d.bulan}
                          </text>
                        </g>
                      );
                    })}

                    {/* Legend */}
                    <g transform={`translate(${ML + CW / 2 - 70}, ${SVG_H - 10})`}>
                      <rect x={0} y={-7} width={8} height={8} fill="#059669" rx={1.5} />
                      <text x={11} y={0} fontSize={8} fill="#475569" fontFamily="Inter, sans-serif">Debit (Penerimaan)</text>
                      <rect x={120} y={-7} width={8} height={8} fill="#e11d48" rx={1.5} />
                      <text x={131} y={0} fontSize={8} fill="#475569" fontFamily="Inter, sans-serif">Kredit (Pengeluaran)</text>
                    </g>
                  </svg>
                </div>
              );
            })() : (
              <div style={{ borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", padding: "16px", textAlign: "center", fontSize: "12px", color: "#94a3b8" }}>
                Tidak ada data transaksi pada periode ini untuk ditampilkan grafiknya.
              </div>
            )}
          </div>


          {/* ── Rincian Transaksi Table ── */}
          <div style={{ marginTop: "20px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
            <h3 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#334155", marginBottom: "8px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
              Rincian Catatan Transaksi Kas ({filteredTransaksi.length} transaksi)
            </h3>
            {filteredTransaksi.length === 0 ? (
              <div style={{ borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", padding: "16px", textAlign: "center", fontSize: "12px", color: "#94a3b8" }}>
                Tidak ada transaksi pada periode yang dipilih.
              </div>
            ) : (
              <div style={{ borderRadius: "10px", border: "1px solid #cbd5e1", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", textAlign: "left", fontSize: "9.5px", color: "#0f172a", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
                  <colgroup>
                    <col style={{ width: "26px" }} />
                    <col style={{ width: "95px" }} />
                    <col style={{ width: "100px" }} />
                    <col />
                    <col style={{ width: "52px" }} />
                    <col style={{ width: "100px" }} />
                    <col style={{ width: "100px" }} />
                  </colgroup>
                  <thead>
                    <tr style={{ backgroundColor: "#f1f5f9", fontSize: "8.5px", fontWeight: 700, textTransform: "uppercase", color: "#475569", letterSpacing: "0.4px", pageBreakInside: "avoid", breakInside: "avoid" }}>
                      <th style={{ padding: "6px 5px 6px 8px", border: "1px solid #cbd5e1" }}>No</th>
                      <th style={{ padding: "6px 5px", border: "1px solid #cbd5e1", whiteSpace: "nowrap" }}>Tanggal</th>
                      <th style={{ padding: "6px 5px", border: "1px solid #cbd5e1", whiteSpace: "nowrap" }}>Kategori</th>
                      <th style={{ padding: "6px 5px", border: "1px solid #cbd5e1" }}>Keterangan</th>
                      <th style={{ padding: "6px 5px", border: "1px solid #cbd5e1", textAlign: "center" }}>Jenis</th>
                      <th style={{ padding: "6px 5px", border: "1px solid #cbd5e1", textAlign: "right", whiteSpace: "nowrap" }}>Nominal</th>
                      <th style={{ padding: "6px 8px 6px 5px", border: "1px solid #cbd5e1", textAlign: "right", whiteSpace: "nowrap" }}>Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransaksi.map((tx, idx) => {
                      const isDebit = tx.jenis === "DEBIT";
                      return (
                        <tr key={tx.id} style={{ pageBreakInside: "avoid", breakInside: "avoid", backgroundColor: idx % 2 === 1 ? "#f8fafc" : "#ffffff" }}>
                          <td style={{ padding: "5px 5px 5px 8px", border: "1px solid #e2e8f0", color: "#94a3b8", fontSize: "8.5px" }}>{idx + 1}</td>
                          <td style={{ padding: "5px", border: "1px solid #e2e8f0", fontWeight: 500, fontSize: "9px", wordBreak: "keep-all" }}>{formatTanggal(tx.tanggal)}</td>
                          <td style={{ padding: "5px", border: "1px solid #e2e8f0", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.kategori_nama || tx.kategori_id}</td>
                          <td style={{ padding: "5px", border: "1px solid #e2e8f0", lineHeight: "1.4", overflow: "hidden" }}>{tx.keterangan}</td>
                          <td style={{ padding: "5px", border: "1px solid #e2e8f0", verticalAlign: "middle" }}>
                            <div data-badge-wrap="jenis" style={{ width: "100%", textAlign: "center" }}>
                              <span style={{
                                display: "inline-block",
                                padding: "2px 6px",
                                borderRadius: "9999px",
                                fontSize: "7.5px",
                                fontWeight: 700,
                                letterSpacing: "0.3px",
                                backgroundColor: isDebit ? "#dcfce7" : "#ffe4e6",
                                color: isDebit ? "#166534" : "#9f1239",
                                border: isDebit ? "1px solid #86efac" : "1px solid #fca5a5",
                              }}>
                                {isDebit ? "DEBIT" : "KREDIT"}
                              </span>
                            </div>
                          </td>
                          <td style={{ padding: "5px 5px 5px 5px", border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700, color: isDebit ? "#15803d" : "#b91c1c", whiteSpace: "nowrap", fontSize: "9px" }}>
                            {isDebit ? "+" : "-"} {formatRupiah(tx.nominal)}
                          </td>
                          <td style={{ padding: "5px 8px 5px 5px", border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", fontSize: "9px" }}>
                            {(() => {
                              const saldo = runningBalanceMap.get(tx.id) ?? 0;
                              return (
                                <span style={{ color: saldo >= 0 ? "#15803d" : "#b91c1c" }}>
                                  {saldo < 0 ? "-" : ""}{formatRupiah(Math.abs(saldo))}
                                </span>
                              );
                            })()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: "#f1f5f9", fontWeight: 700, fontSize: "9px", pageBreakInside: "avoid", breakInside: "avoid" }}>
                      <td colSpan={4} style={{ padding: "6px 5px 6px 8px", border: "2px solid #cbd5e1", color: "#334155" }}>TOTAL PERIODE</td>
                      <td style={{ padding: "6px 5px", border: "2px solid #cbd5e1", textAlign: "center", color: "#475569", whiteSpace: "nowrap", fontSize: "8px" }}>
                        {filteredTransaksi.filter((t) => t.jenis === "DEBIT").length}D / {filteredTransaksi.filter((t) => t.jenis === "KREDIT").length}K
                      </td>
                      <td style={{ padding: "6px 5px", border: "2px solid #cbd5e1", textAlign: "right", whiteSpace: "nowrap", fontSize: "8.5px" }}>
                        <span style={{ color: "#15803d", display: "block" }}>+{formatRupiah(filteredSummary.totalDebit)}</span>
                        <span style={{ color: "#b91c1c", display: "block" }}>-{formatRupiah(filteredSummary.totalKredit)}</span>
                      </td>
                      <td style={{ padding: "6px 8px 6px 5px", border: "2px solid #cbd5e1", textAlign: "right", whiteSpace: "nowrap", fontSize: "8.5px" }}>
                        <span style={{ color: filteredSummary.saldoAkhir >= 0 ? "#15803d" : "#b91c1c", fontWeight: 800 }}>
                          {filteredSummary.saldoAkhir < 0 ? "-" : ""}{formatRupiah(Math.abs(filteredSummary.saldoAkhir))}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ── Signature Blocks ── */}
          <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #cbd5e1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", textAlign: "center", fontSize: "11px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif", pageBreakInside: "avoid", breakInside: "avoid" }}>
            <div>
              <p style={{ color: "#64748b", margin: 0 }}>Mengetahui,</p>
              <p style={{ fontWeight: 700, color: "#0f172a", margin: "2px 0 48px 0" }}>Kepala Madrasah</p>
              <p style={{ fontWeight: 700, color: "#0f172a", textDecoration: "underline", margin: 0 }}>{pengaturan.nama_kepala_madrasah}</p>
            </div>

            <div>
              <p style={{ color: "#64748b", margin: 0 }}>
                {formatTanggal(new Date().toISOString().split("T")[0])}
              </p>
              <p style={{ fontWeight: 700, color: "#0f172a", margin: "2px 0 48px 0" }}>Bendahara</p>
              <p style={{ fontWeight: 700, color: "#0f172a", textDecoration: "underline", margin: 0 }}>{pengaturan.nama_bendahara}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-12" />
    </div>
  );
}
