"use client";

import { useEffect, useState, useMemo, useRef } from "react";
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
  Download,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
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

interface PageData {
  pageNumber: number;
  isFirstPage: boolean;
  isLastPage: boolean;
  transactions: Transaksi[];
  startIndex: number;
  hasKopAndSummary: boolean;
  hasSignature: boolean;
  hasTotals: boolean;
}

function paginateReport(transactions: Transaksi[]): PageData[] {
  const n = transactions.length;

  if (n <= 8) {
    return [
      {
        pageNumber: 1,
        isFirstPage: true,
        isLastPage: true,
        transactions,
        startIndex: 0,
        hasKopAndSummary: true,
        hasSignature: true,
        hasTotals: true,
      },
    ];
  }

  const pages: PageData[] = [];
  const PAGE_1_ROWS = 12;
  const MIDDLE_ROWS = 20;
  const LAST_PAGE_MAX = 14;

  // Page 1
  pages.push({
    pageNumber: 1,
    isFirstPage: true,
    isLastPage: false,
    transactions: transactions.slice(0, PAGE_1_ROWS),
    startIndex: 0,
    hasKopAndSummary: true,
    hasSignature: false,
    hasTotals: false,
  });

  let cur = PAGE_1_ROWS;

  while (cur < n) {
    const remaining = n - cur;
    if (remaining <= LAST_PAGE_MAX) {
      pages.push({
        pageNumber: pages.length + 1,
        isFirstPage: false,
        isLastPage: true,
        transactions: transactions.slice(cur, cur + remaining),
        startIndex: cur,
        hasKopAndSummary: false,
        hasSignature: true,
        hasTotals: true,
      });
      cur += remaining;
    } else {
      const take = Math.min(MIDDLE_ROWS, remaining - 1);
      pages.push({
        pageNumber: pages.length + 1,
        isFirstPage: false,
        isLastPage: false,
        transactions: transactions.slice(cur, cur + take),
        startIndex: cur,
        hasKopAndSummary: false,
        hasSignature: false,
        hasTotals: false,
      });
      cur += take;
    }
  }

  if (pages.length > 0) {
    pages[pages.length - 1].isLastPage = true;
    pages[pages.length - 1].hasSignature = true;
    pages[pages.length - 1].hasTotals = true;
  }

  return pages;
}

type FilterMode = "all" | "range";

export default function ReportPage() {
  const [dbData, setDbData] = useState<DatabaseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterApplied, setFilterApplied] = useState(false);

  // ── Export PDF state ─────────────────────────────────────────────────────
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });

  // ── Preview Zoom state (auto-fits to screen on mobile/HP) ─────────────────
  const [zoom, setZoom] = useState(1);

  const calculateFitZoom = () => {
    if (typeof window === "undefined") return 1;
    const screenW = window.innerWidth;
    if (screenW < 850) {
      // Auto fit with margin for mobile screen
      const fitted = Math.min(1, Math.max(0.25, (screenW - 28) / 794));
      return Math.round(fitted * 100) / 100;
    }
    return 1;
  };

  useEffect(() => {
    const updateZoom = () => setZoom(calculateFitZoom());
    updateZoom();
    window.addEventListener("resize", updateZoom);
    return () => window.removeEventListener("resize", updateZoom);
  }, []);

  const handleZoomIn = () => setZoom((z) => Math.min(1.5, Math.round((z + 0.1) * 100) / 100));
  const handleZoomOut = () => setZoom((z) => Math.max(0.25, Math.round((z - 0.1) * 100) / 100));
  const handleFitScreen = () => setZoom(calculateFitZoom());
  const handleResetZoom = () => setZoom(1);

  // ── Drag to scroll (mouse/trackpad support) ───────────────────────────────
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeftState(scrollContainerRef.current.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeftState - walk;
  };

  const handleMouseUp = () => setIsDragging(false);

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

  // ── Export PDF page-by-page (clean A4 pages without slicing) ───────────────
  const handleExportPDF = async () => {
    setIsExporting(true);

    const UNSUPPORTED_COLOR_RE =
      /\b(okrgba|oklab|oklch|lab|color-mix|light-dark|hwb|device-cmyk)\b/i;

    const sanitizeColor = (val: string): string => {
      if (!val || typeof val !== "string") return val;
      if (!UNSUPPORTED_COLOR_RE.test(val)) return val;
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

    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = function (elt: Element, pseudo?: string | null) {
      return makeColorProxy(originalGetComputedStyle.call(window, elt, pseudo));
    };

    // Save initial window scroll
    const originalScrollX = window.scrollX || window.pageXOffset || 0;
    const originalScrollY = window.scrollY || window.pageYOffset || 0;
    window.scrollTo(0, 0);

    let sandbox: HTMLDivElement | null = null;

    try {
      const { jsPDF } = await import("jspdf");
      const html2canvas = (await import("html2canvas")).default;

      const pageElements = document.querySelectorAll<HTMLElement>(".pdf-page");
      if (!pageElements || pageElements.length === 0) {
        throw new Error("Elemen laporan tidak ditemukan.");
      }

      setExportProgress({ current: 0, total: pageElements.length });

      // Create isolated sandbox container positioned at top 0, left 0
      sandbox = document.createElement("div");
      sandbox.id = "pdf-export-sandbox";
      sandbox.style.position = "fixed";
      sandbox.style.top = "0px";
      sandbox.style.left = "0px";
      sandbox.style.width = "794px";
      sandbox.style.height = "1123px";
      sandbox.style.overflow = "hidden";
      sandbox.style.zIndex = "99990";
      sandbox.style.backgroundColor = "#ffffff";
      sandbox.style.margin = "0";
      sandbox.style.padding = "0";
      sandbox.style.boxSizing = "border-box";
      sandbox.style.pointerEvents = "none";
      document.body.appendChild(sandbox);

      const madrasahName = dbData?.pengaturan.nama_madrasah || "Kas_Madrasah";
      const cleanName = madrasahName.replace(/[^a-zA-Z0-9]/g, "_");
      const dateStr = new Date().toISOString().split("T")[0];
      const fileName = `Laporan_Kas_${cleanName}_${dateStr}.pdf`;

      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      for (let i = 0; i < pageElements.length; i++) {
        setExportProgress({ current: i + 1, total: pageElements.length });
        if (i > 0) pdf.addPage("a4", "portrait");
        const pageEl = pageElements[i];

        // Clone page element into isolated sandbox
        const clone = pageEl.cloneNode(true) as HTMLElement;

        // Strip preview-only styles (rounded corners, shadow, outer border)
        clone.classList.remove("rounded-xl", "border", "border-slate-300", "shadow-2xl", "mx-auto", "p-8", "print-card");
        clone.style.width = "794px";
        clone.style.minWidth = "794px";
        clone.style.maxWidth = "794px";
        clone.style.height = "1123px";
        clone.style.minHeight = "1123px";
        clone.style.maxHeight = "1123px";
        clone.style.boxSizing = "border-box";
        clone.style.padding = "36px 36px 28px 36px";
        clone.style.margin = "0";
        clone.style.borderRadius = "0px";
        clone.style.border = "none";
        clone.style.boxShadow = "none";
        clone.style.transform = "none";
        clone.style.zoom = "1";
        clone.style.backgroundColor = "#ffffff";
        clone.style.overflow = "hidden";

        sandbox.replaceChildren(clone);

        // Ensure all images (logo, etc.) inside the clone are completely ready
        const images = Array.from(clone.querySelectorAll("img"));
        await Promise.all(
          images.map(
            (img) =>
              new Promise((res) => {
                if (img.complete && img.naturalHeight > 0) return res(true);
                img.onload = () => res(true);
                img.onerror = () => res(true);
              })
          )
        );

        // Allow microtask/frame for complete layout computation
        await new Promise((r) => setTimeout(r, 60));

        const canvas = await html2canvas(clone, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          width: 794,
          height: 1123,
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
          windowWidth: 794,
          windowHeight: 1123,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.98);
        pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      }

      pdf.save(fileName);
    } catch (err: any) {
      console.error("PDF export failed:", err);
      alert("Gagal mengunduh PDF: " + (err.message || err));
    } finally {
      if (sandbox && sandbox.parentNode) {
        sandbox.parentNode.removeChild(sandbox);
      }
      window.getComputedStyle = originalGetComputedStyle;
      window.scrollTo(originalScrollX, originalScrollY);
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

  // ── Paginated pages for print & PDF export ──────────────────────────────
  const reportPages = useMemo(() => paginateReport(filteredTransaksi), [filteredTransaksi]);

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
            id="btn-print-pdf"
            onClick={() => window.print()}
            title="Cetak via printer / browser"
            className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:border-slate-600 transition active:scale-95 shadow-md"
          >
            <Printer className="h-4 w-4 text-slate-300" />
            <span>Cetak</span>
          </button>

          <button
            id="btn-export-pdf"
            onClick={handleExportPDF}
            disabled={isExporting}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2.5 sm:px-5 sm:py-2.5 text-xs font-bold text-white shadow-xl shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-500 transition active:scale-95 disabled:opacity-50"
          >
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                <span>Membuat PDF ({reportPages.length} hal)...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4 text-white" />
                <span>Unduh PDF</span>
              </>
            )}
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
                Menampilkan {dbData.transaksi.length} transaksi ({reportPages.length} halaman)
              </span>
            )}
            {filterMode === "range" && filterApplied && (
              <span className="flex items-center gap-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 text-[11px] font-bold text-indigo-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {filteredTransaksi.length} transaksi &bull; {periodeLabel} ({reportPages.length} halaman)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Sticky Zoom Controls Bar (hidden on print) ── */}
      <div className="no-print sticky top-3 z-30 mx-auto max-w-fit mb-4 flex items-center gap-1.5 rounded-full border border-slate-700/80 bg-slate-900/95 px-3.5 py-1.5 shadow-2xl backdrop-blur-md">
        <button
          onClick={handleZoomOut}
          disabled={zoom <= 0.25}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition disabled:opacity-40 active:scale-95"
          title="Perkecil (Zoom Out)"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>

        <span className="min-w-[46px] text-center font-mono text-xs font-bold text-slate-200 tabular-nums select-none">
          {Math.round(zoom * 100)}%
        </span>

        <button
          onClick={handleZoomIn}
          disabled={zoom >= 1.5}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition disabled:opacity-40 active:scale-95"
          title="Perbesar (Zoom In)"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>

        <div className="mx-1 h-4 w-px bg-slate-700" />

        <button
          onClick={handleFitScreen}
          className="flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition active:scale-95"
          title="Paskan ke Layar HP"
        >
          <Maximize2 className="h-3 w-3 text-emerald-400" />
          <span>Fit HP</span>
        </button>

        <button
          onClick={handleResetZoom}
          className="flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition active:scale-95"
          title="Ukuran Asli 100%"
        >
          <RotateCcw className="h-3 w-3 text-indigo-400" />
          <span>100%</span>
        </button>
      </div>

      {/* ── Printable Report Document Container (Pan / Drag / Scroll enabled) ── */}
      <div
        ref={scrollContainerRef}
        className="mx-auto w-full overflow-x-auto pb-8 touch-pan-x cursor-grab active:cursor-grabbing select-none sm:select-auto"
        style={{
          WebkitOverflowScrolling: "touch",
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div style={{ width: "fit-content", minWidth: "100%", display: "flex", justifyContent: "center", padding: "0 16px" }}>
          <div
            className="print-zoom-wrapper flex flex-col items-center gap-8"
            style={{
              zoom: zoom,
              transformOrigin: "top center",
            }}
          >
            {reportPages.map((page) => (
              <div
                key={page.pageNumber}
                id={page.isFirstPage ? "printable-report" : undefined}
                className="pdf-page print-card bg-white text-slate-900 shadow-2xl w-[794px] min-w-[794px] min-h-[1123px] mx-auto rounded-xl border border-slate-300 flex flex-col justify-between"
                style={{
                  boxSizing: "border-box",
                  padding: "36px 36px 28px 36px",
                }}
              >
                {/* Page Content */}
                <div>
                  {/* Page 1: Kop Surat, Summary Cards, Chart */}
                  {page.hasKopAndSummary && (
                    <>
                      {/* Kop Surat / Header */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", borderBottom: "2px solid #0f172a", paddingBottom: "16px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                          <div style={{ width: "56px", height: "56px", borderRadius: "10px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#ffffff", padding: "4px", flexShrink: 0, boxSizing: "border-box" }}>
                            {/* Gunakan tag <img> standar HTML untuk hasil PDF yang lebih aman dari efek zoom */}
                            <img
                              src="/logo/logo.jpeg"
                              alt="Logo Madrasah"
                              style={{ objectFit: "contain", width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%" }}
                            />
                          </div>
                          <div style={{ minWidth: 0, flex: 1, paddingBottom: "2px" }}>
                            <h1 style={{
                              fontSize: "16px",
                              fontWeight: 800,
                              textTransform: "uppercase",
                              color: "#0f172a",
                              margin: 0,
                              lineHeight: "normal", // Ubah dari 1.25 ke normal agar bagian bawah huruf 'J' aman
                              paddingBottom: "4px", // Tambahan ruang bawah khusus untuk huruf berekor
                              fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif",
                              // HAPUS overflow: "hidden" dan whiteSpace: "nowrap" di sini
                            }}>
                              {pengaturan.nama_madrasah}
                            </h1>
                            <p style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.4px", margin: "3px 0 0 0", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
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
                          <span style={{ display: "inline-block", marginTop: "4px", backgroundColor: "#f1f5f9", padding: "3px 8px", borderRadius: "6px", fontWeight: 600, color: "#334155", fontSize: "11px" }}>
                            {filteredTransaksi.length} transaksi
                          </span>
                        </div>
                      </div>

                      {/* ── Executive Summary Cards ── */}
                      <div style={{ marginTop: "18px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
                        <h3 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#64748b", marginBottom: "8px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
                          Ringkasan Keuangan Kas
                        </h3>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                          <div style={{ borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", padding: "10px 12px" }}>
                            <p style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", margin: 0, letterSpacing: "0.5px" }}>Saldo Awal</p>
                            <p style={{ fontSize: "14px", fontWeight: 800, color: "#0f172a", margin: "4px 0 0 0" }}>{formatRupiah(filteredSummary.saldoAwal)}</p>
                          </div>

                          <div style={{ borderRadius: "12px", border: "1px solid #bbf7d0", backgroundColor: "#f0fdf4", padding: "10px 12px" }}>
                            <p style={{ fontSize: "11px", fontWeight: 700, color: "#15803d", textTransform: "uppercase", margin: 0, letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "4px" }}>
                              <ArrowDownLeft className="h-3.5 w-3.5 shrink-0" /> Total Debit
                            </p>
                            <p style={{ fontSize: "14px", fontWeight: 800, color: "#15803d", margin: "4px 0 0 0" }}>{formatRupiah(filteredSummary.totalDebit)}</p>
                          </div>

                          <div style={{ borderRadius: "12px", border: "1px solid #fecdd3", backgroundColor: "#fff1f2", padding: "10px 12px" }}>
                            <p style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", textTransform: "uppercase", margin: 0, letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "4px" }}>
                              <ArrowUpRight className="h-3.5 w-3.5 shrink-0" /> Total Kredit
                            </p>
                            <p style={{ fontSize: "14px", fontWeight: 800, color: "#b91c1c", margin: "4px 0 0 0" }}>{formatRupiah(filteredSummary.totalKredit)}</p>
                          </div>

                          <div style={{ borderRadius: "12px", border: "1px solid #99f6e4", backgroundColor: "#f0fdfa", padding: "10px 12px" }}>
                            <p style={{ fontSize: "11px", fontWeight: 700, color: "#0f766e", textTransform: "uppercase", margin: 0, letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "4px" }}>
                              <Wallet className="h-3.5 w-3.5 shrink-0" /> Saldo Akhir
                            </p>
                            <p style={{ fontSize: "14px", fontWeight: 800, color: "#0f766e", margin: "4px 0 0 0" }}>{formatRupiah(filteredSummary.saldoAkhir)}</p>
                          </div>
                        </div>
                      </div>

                      {/* ── Chart ── */}
                      <div style={{ marginTop: "18px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
                        {filteredCashflow.length > 0 ? (() => {
                          const SVG_W = 740;
                          const SVG_H = 175;
                          const ML = 58;
                          const MR = 16;
                          const MT = 12;
                          const MB = 30;
                          const CW = SVG_W - ML - MR;
                          const CH = SVG_H - MT - MB;

                          const maxVal = Math.max(...filteredCashflow.flatMap((d) => [d.debit, d.kredit]), 1);
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
                            <div style={{ borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", padding: "10px 14px" }}>
                              <h3 style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#334155", marginBottom: "6px", display: "flex", alignItems: "center", gap: "6px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
                                <TrendingUp className="h-3.5 w-3.5 text-emerald-700 shrink-0" /> Grafik Visualisasi Arus Kas Bulanan
                              </h3>
                              <svg
                                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                                width="100%"
                                height={SVG_H}
                                style={{ display: "block", overflow: "visible" }}
                              >
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

                                {filteredCashflow.map((d, i) => {
                                  const slotX = ML + i * slotW;
                                  const centerX = slotX + slotW / 2;
                                  const debitH = (d.debit / yMax) * CH;
                                  const kreditH = (d.kredit / yMax) * CH;
                                  const barBaseY = MT + CH;

                                  return (
                                    <g key={i}>
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
                          <div style={{ borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", padding: "12px", textAlign: "center", fontSize: "11px", color: "#94a3b8" }}>
                            Tidak ada data transaksi pada periode ini untuk ditampilkan grafiknya.
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Page 2+: Running Header */}
                  {!page.hasKopAndSummary && (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", borderBottom: "1.5px solid #0f172a", paddingBottom: "10px", marginBottom: "16px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h2 style={{ fontSize: "13px", fontWeight: 800, textTransform: "uppercase", color: "#0f172a", margin: 0, lineHeight: 1.2 }}>
                          {pengaturan.nama_madrasah}
                        </h2>
                        <p style={{ fontSize: "10.5px", fontWeight: 600, color: "#64748b", margin: "2px 0 0 0" }}>
                          Laporan Pertanggungjawaban Kas &bull; Periode: <strong style={{ color: "#0f172a" }}>{periodeLabel}</strong> (Lanjutan)
                        </p>
                      </div>
                      <div style={{ textAlign: "right", fontSize: "10.5px", color: "#64748b", flexShrink: 0 }}>
                        Tanggal Cetak: {formatTanggal(new Date().toISOString().split("T")[0])}
                      </div>
                    </div>
                  )}

                  {/* ── Table Section on this page ── */}
                  <div style={{ marginTop: page.hasKopAndSummary ? "18px" : "0px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
                    <h3 style={{ fontSize: "12px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#334155", marginBottom: "8px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
                      Rincian Catatan Transaksi Kas {page.isFirstPage ? `(${filteredTransaksi.length} transaksi)` : `(Lanjutan - Hal. ${page.pageNumber})`}
                    </h3>

                    {page.transactions.length === 0 ? (
                      <div style={{ borderRadius: "12px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", padding: "16px", textAlign: "center", fontSize: "11px", color: "#94a3b8" }}>
                        Tidak ada transaksi pada periode yang dipilih.
                      </div>
                    ) : (
                      <div style={{ borderRadius: "10px", border: "1px solid #cbd5e1", overflow: "hidden" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", textAlign: "left", fontSize: "11px", color: "#0f172a", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
                          <colgroup>
                            <col style={{ width: "30px" }} />
                            <col style={{ width: "105px" }} />
                            <col style={{ width: "110px" }} />
                            <col />
                            <col style={{ width: "60px" }} />
                            <col style={{ width: "112px" }} />
                            <col style={{ width: "115px" }} />
                          </colgroup>
                          <thead>
                            <tr style={{ backgroundColor: "#f1f5f9", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#334155", letterSpacing: "0.3px" }}>
                              <th style={{ padding: "7px 4px 7px 6px", border: "1px solid #cbd5e1", textAlign: "center" }}>No</th>
                              <th style={{ padding: "7px 6px", border: "1px solid #cbd5e1", whiteSpace: "nowrap" }}>Tanggal</th>
                              <th style={{ padding: "7px 6px", border: "1px solid #cbd5e1", whiteSpace: "nowrap" }}>Kategori</th>
                              <th style={{ padding: "7px 6px", border: "1px solid #cbd5e1" }}>Keterangan</th>
                              <th style={{ padding: "7px 4px", border: "1px solid #cbd5e1", textAlign: "center" }}>Jenis</th>
                              <th style={{ padding: "7px 6px", border: "1px solid #cbd5e1", textAlign: "right", whiteSpace: "nowrap" }}>Nominal</th>
                              <th style={{ padding: "7px 8px 7px 6px", border: "1px solid #cbd5e1", textAlign: "right", whiteSpace: "nowrap" }}>Saldo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {page.transactions.map((tx, idx) => {
                              const isDebit = tx.jenis === "DEBIT";
                              const rowNumber = page.startIndex + idx + 1;
                              const saldo = runningBalanceMap.get(tx.id) ?? 0;
                              return (
                                <tr key={tx.id} style={{ backgroundColor: idx % 2 === 1 ? "#f8fafc" : "#ffffff", fontSize: "11px" }}>
                                  <td style={{ padding: "6px 4px 6px 6px", border: "1px solid #e2e8f0", color: "#64748b", fontSize: "11px", textAlign: "center" }}>{rowNumber}</td>
                                  <td style={{ padding: "6px", border: "1px solid #e2e8f0", fontWeight: 500, fontSize: "11px", wordBreak: "keep-all" }}>{formatTanggal(tx.tanggal)}</td>
                                  <td style={{ padding: "6px", border: "1px solid #e2e8f0", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: "11px" }}>{tx.kategori_nama || tx.kategori_id}</td>
                                  <td style={{ padding: "6px", border: "1px solid #e2e8f0", lineHeight: "1.35", fontSize: "11px" }}>{tx.keterangan}</td>
                                  <td style={{ padding: "6px 4px", border: "1px solid #e2e8f0", verticalAlign: "middle" }}>
                                    <div data-badge-wrap="jenis" style={{ width: "100%", textAlign: "center" }}>
                                      <span style={{
                                        display: "inline-block",
                                        padding: "2px 6px",
                                        borderRadius: "9999px",
                                        fontSize: "9.5px",
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
                                  <td style={{ padding: "6px", border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700, color: isDebit ? "#15803d" : "#b91c1c", whiteSpace: "nowrap", fontSize: "11px" }}>
                                    {isDebit ? "+" : "-"} {formatRupiah(tx.nominal)}
                                  </td>
                                  <td style={{ padding: "6px 8px 6px 6px", border: "1px solid #e2e8f0", textAlign: "right", fontWeight: 700, whiteSpace: "nowrap", fontSize: "11px" }}>
                                    <span style={{ color: saldo >= 0 ? "#15803d" : "#b91c1c" }}>
                                      {saldo < 0 ? "-" : ""}{formatRupiah(Math.abs(saldo))}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          {page.hasTotals && (
                            <tfoot>
                              <tr style={{ backgroundColor: "#f1f5f9", fontWeight: 700, fontSize: "11px" }}>
                                <td colSpan={4} style={{ padding: "7px 6px", border: "2px solid #cbd5e1", color: "#334155" }}>TOTAL PERIODE</td>
                                <td style={{ padding: "7px 4px", border: "2px solid #cbd5e1", textAlign: "center", color: "#475569", whiteSpace: "nowrap", fontSize: "10px" }}>
                                  {filteredTransaksi.filter((t) => t.jenis === "DEBIT").length}D / {filteredTransaksi.filter((t) => t.jenis === "KREDIT").length}K
                                </td>
                                <td style={{ padding: "7px 6px", border: "2px solid #cbd5e1", textAlign: "right", whiteSpace: "nowrap", fontSize: "11px" }}>
                                  <span style={{ color: "#15803d", display: "block" }}>+{formatRupiah(filteredSummary.totalDebit)}</span>
                                  <span style={{ color: "#b91c1c", display: "block" }}>-{formatRupiah(filteredSummary.totalKredit)}</span>
                                </td>
                                <td style={{ padding: "7px 8px 7px 6px", border: "2px solid #cbd5e1", textAlign: "right", whiteSpace: "nowrap", fontSize: "11px" }}>
                                  <span style={{ color: filteredSummary.saldoAkhir >= 0 ? "#15803d" : "#b91c1c", fontWeight: 800 }}>
                                    {filteredSummary.saldoAkhir < 0 ? "-" : ""}{formatRupiah(Math.abs(filteredSummary.saldoAkhir))}
                                  </span>
                                </td>
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    )}
                  </div>

                  {/* ── Signature Blocks on Last Page ── */}
                  {page.hasSignature && (
                    <div style={{ marginTop: "24px", paddingTop: "14px", borderTop: "1px solid #cbd5e1", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", textAlign: "center", fontSize: "11px", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
                      <div>
                        <p style={{ color: "#64748b", margin: 0, fontSize: "11px" }}>Mengetahui,</p>
                        <p style={{ fontWeight: 700, color: "#0f172a", margin: "2px 0 46px 0", fontSize: "11px" }}>Kepala Madrasah</p>
                        <p style={{ fontWeight: 700, color: "#0f172a", textDecoration: "underline", margin: 0, fontSize: "12px" }}>{pengaturan.nama_kepala_madrasah}</p>
                      </div>

                      <div>
                        <p style={{ color: "#64748b", margin: 0, fontSize: "11px" }}>
                          {formatTanggal(new Date().toISOString().split("T")[0])}
                        </p>
                        <p style={{ fontWeight: 700, color: "#0f172a", margin: "2px 0 46px 0", fontSize: "11px" }}>Bendahara</p>
                        <p style={{ fontWeight: 700, color: "#0f172a", textDecoration: "underline", margin: 0, fontSize: "12px" }}>{pengaturan.nama_bendahara}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Page Footer */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #e2e8f0", paddingTop: "8px", marginTop: "16px", fontSize: "9.5px", color: "#94a3b8", fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
                  <span>{pengaturan.nama_madrasah}</span>
                  <span>Halaman {page.pageNumber} dari {reportPages.length}</span>
                  <span>{formatTanggal(new Date().toISOString().split("T")[0])}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom spacing */}
      <div className="h-12" />

      {/* ── Exporting Loader Modal with Progress Indicator ── */}
      {isExporting && (
        <div
          className="no-print fixed inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-sm"
          style={{ position: "fixed", inset: 0, zIndex: 100000 }}
        >
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900 px-8 py-6 shadow-2xl text-center max-w-sm mx-4">
            <Loader2 className="h-9 w-9 animate-spin text-emerald-400" />
            <p className="text-sm font-bold text-white">Menyusun Dokumen PDF A4...</p>
            <p className="text-xs text-slate-300">
              {exportProgress.total > 0
                ? `Memproses halaman ${exportProgress.current} dari ${exportProgress.total}...`
                : "Menyiapkan data dokumen..."}
            </p>
            <div className="w-48 h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-emerald-500 transition-all duration-200"
                style={{
                  width: exportProgress.total > 0
                    ? `${Math.round((exportProgress.current / exportProgress.total) * 100)}%`
                    : "20%",
                }}
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Pastikan halaman rapi, tanpa potongan dan sesuai standar kertas A4.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
