"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { StatCards } from "@/components/dashboard/stat-cards";
import { fetchDatabaseAction, deleteTransactionAction } from "@/lib/actions";
import { DatabaseData, Transaksi } from "@/types";
import { PlusCircle, Loader2, AlertCircle, FileText, MonitorPlay, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Lazy-load komponen berat ─────────────────────────────────────────────────
const CashflowChart = dynamic(
  () => import("@/components/dashboard/cashflow-chart").then((m) => m.CashflowChart),
  {
    loading: () => (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 h-[340px] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    ),
    ssr: false,
  }
);

const CategoryChart = dynamic(
  () => import("@/components/dashboard/category-chart").then((m) => m.CategoryChart),
  {
    loading: () => (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 h-[340px] flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
      </div>
    ),
    ssr: false,
  }
);

const AIAnalyzer = dynamic(
  () => import("@/components/ai/ai-analyzer").then((m) => m.AIAnalyzer),
  {
    loading: () => (
      <div className="rounded-2xl border border-violet-500/20 bg-slate-900/60 p-4 h-16 flex items-center gap-3">
        <div className="h-8 w-8 rounded-xl bg-violet-500/10 border border-violet-500/20 animate-pulse" />
        <div className="h-3 w-32 rounded bg-slate-800 animate-pulse" />
      </div>
    ),
    ssr: false,
  }
);

const TransactionModal = dynamic(
  () => import("@/components/modals/transaction-modal").then((m) => m.TransactionModal),
  { ssr: false }
);

const BackupModal = dynamic(
  () => import("@/components/modals/backup-modal").then((m) => m.BackupModal),
  { ssr: false }
);

const TransactionTable = dynamic(
  () => import("@/components/dashboard/transaction-table").then((m) => m.TransactionTable),
  {
    loading: () => (
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-800/60 animate-pulse" />
        ))}
      </div>
    ),
    ssr: false,
  }
);
// ────────────────────────────────────────────────────────────────────────────

interface DashboardClientProps {
  initialData: DatabaseData | null;
  initialError?: string;
}

export function DashboardClient({ initialData, initialError = "" }: DashboardClientProps) {
  const [dbData, setDbData] = useState<DatabaseData | null>(initialData);
  const [isLoading, setIsLoading] = useState(!initialData && !initialError);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState(initialError);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaksi | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [isPresentationMode, setIsPresentationMode] = useState(false);

  // Toggle fullscreen API when presentation mode changes
  useEffect(() => {
    if (isPresentationMode) {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(() => {
          // ignore error if fullscreen is not supported
        });
      }
    } else {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    }
  }, [isPresentationMode]);

  // Listen to escape key to exit presentation mode natively
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isPresentationMode) {
        setIsPresentationMode(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [isPresentationMode]);

  const loadData = useCallback(async (showRefreshingSpinner = false) => {
    if (showRefreshingSpinner) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMsg("");

    try {
      const res = await fetchDatabaseAction(showRefreshingSpinner);
      if (res.success && res.data) {
        setDbData(res.data);
      } else {
        setErrorMsg(res.error || "Gagal memuat data dari Google Sheets.");
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan koneksi.");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus catatan transaksi ini dari Google Sheets?")) {
      return;
    }

    setDeletingId(id);
    try {
      const res = await deleteTransactionAction(id);
      if (res.success) {
        loadData(true);
      } else {
        alert(`Gagal menghapus: ${res.error}`);
      }
    } catch (err: any) {
      alert(`Terjadi kesalahan: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading && !dbData) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm font-semibold">Menyinkronkan dengan Google Sheets...</p>
        <p className="text-xs text-slate-500 mt-1">Membuka `[DB] Kas Madrasah System` di Google Drive Anda</p>
      </div>
    );
  }

  return (
    <div className={cn(
      "min-h-screen flex flex-col bg-slate-950 transition-all duration-500",
      isPresentationMode ? "p-0" : ""
    )}>
      {!isPresentationMode && (
        <Navbar
          madrasahName={dbData?.pengaturan.nama_madrasah}
          onRefresh={() => loadData(true)}
          isRefreshing={isRefreshing}
        />
      )}

      {/* Floating Exit Button for Presentation Mode */}
      {isPresentationMode && (
        <button
          onClick={() => setIsPresentationMode(false)}
          className="fixed top-4 right-4 z-50 flex items-center justify-center gap-2 rounded-full bg-slate-800/80 backdrop-blur-md px-4 py-2 text-xs font-bold text-slate-200 border border-slate-700/50 hover:bg-slate-700 hover:text-white transition shadow-2xl animate-in fade-in slide-in-from-top-4"
        >
          <X className="h-4 w-4" /> Keluar Mode Presentasi
        </button>
      )}

      <main className={cn(
        "flex-1 mx-auto w-full transition-all duration-500",
        isPresentationMode ? "max-w-none px-6 py-8 pb-20 space-y-8" : "max-w-7xl px-4 py-5 sm:px-6 space-y-5"
      )}>
        {/* Header Title & Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className={cn(
              "font-black text-white tracking-tight transition-all",
              isPresentationMode ? "text-3xl sm:text-4xl text-center sm:text-left" : "text-xl sm:text-2xl"
            )}>
              Dashboard Keuangan Kas {isPresentationMode && <span className="text-emerald-400">{dbData?.pengaturan.nama_madrasah}</span>}
            </h1>
            <p className={cn(
              "text-slate-400 mt-0.5 transition-all",
              isPresentationMode ? "text-sm text-center sm:text-left" : "text-xs"
            )}>
              Pengelolaan dana masuk (debit) &amp; keluar (kredit) madrasah secara real-time
            </p>
          </div>

          {/* Action buttons (Hidden in Presentation Mode) */}
          {!isPresentationMode && (
            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setIsPresentationMode(true)}
                title="Mode Presentasi (Layar Penuh)"
                className="flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 p-2.5 text-slate-300 hover:bg-slate-800 hover:text-indigo-400 hover:border-indigo-500/40 transition active:scale-95"
              >
                <MonitorPlay className="h-4 w-4" />
              </button>

              <Link
                href="/report"
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl border border-slate-700/80 bg-slate-900 px-4 py-2.5 text-xs font-bold text-teal-300 hover:bg-slate-800 hover:border-teal-500/40 transition active:scale-95 shadow-sm"
              >
                <FileText className="h-4 w-4 text-teal-400" />
                <span>Laporan PDF</span>
              </Link>

              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setIsAddModalOpen(true);
                }}
                id="btn-catat-transaksi"
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-500 transition active:scale-95"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Catat Transaksi</span>
              </button>
            </div>
          )}
        </div>

        {errorMsg && !isPresentationMode && (
          <div className="flex items-center justify-between rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs text-rose-400">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => loadData(true)}
              className="rounded-lg bg-rose-500/20 px-3 py-1 text-xs font-bold hover:bg-rose-500/30 text-rose-300"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {/* Real-time Summary Stat Cards */}
        {dbData && <StatCards summary={dbData.summary} />}

        {/* Charts Section: 2 Columns on Desktop */}
        {dbData && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div className="lg:col-span-2">
              <CashflowChart transactions={dbData.transaksi} />
            </div>
            <div className="hidden lg:block lg:col-span-1">
              <CategoryChart transactions={dbData.transaksi} />
            </div>
          </div>
        )}

        {/* AI Analyzer Panel — Hidden in presentation mode to keep it clean */}
        {dbData && !isPresentationMode && (
          <AIAnalyzer
            dbData={dbData}
            apiKey={dbData.pengaturan.gemini_api_key || ""}
            model={dbData.pengaturan.gemini_model || "gemini-3.7-flash"}
          />
        )}

        {/* Transactions Table */}
        {dbData && (
          <div>
            <h2 className={cn(
              "font-bold text-slate-100 mb-3",
              isPresentationMode ? "text-xl mt-4" : "text-lg"
            )}>Daftar Transaksi Terbaru</h2>
            <TransactionTable
              transactions={dbData.transaksi}
              categories={dbData.kategori}
              saldoAwal={dbData.summary.saldoAwal}
              onDelete={isPresentationMode ? undefined : handleDelete}
              onEdit={isPresentationMode ? undefined : (tx) => {
                setEditingTransaction(tx);
                setIsAddModalOpen(true);
              }}
              isDeletingId={deletingId}
              isPresentationMode={isPresentationMode}
            />
          </div>
        )}
      </main>

      {/* Modals */}
      {dbData && (
        <TransactionModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingTransaction(null);
          }}
          categories={dbData.kategori}
          onSuccess={() => loadData(true)}
          onCategoryCreated={(newCat) => {
            setDbData((prev) => (prev ? { ...prev, kategori: [...prev.kategori, newCat] } : prev));
          }}
          editingTransaction={editingTransaction}
          geminiApiKey={dbData.pengaturan.gemini_api_key || ""}
          geminiModel={dbData.pengaturan.gemini_model || "gemini-3.7-flash"}
        />
      )}

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onSuccess={() => loadData(true)}
      />
    </div>
  );
}
