"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { StatCards } from "@/components/dashboard/stat-cards";
import { CashflowChart } from "@/components/dashboard/cashflow-chart";
import { TransactionTable } from "@/components/dashboard/transaction-table";
import { TransactionModal } from "@/components/modals/transaction-modal";
import { BackupModal } from "@/components/modals/backup-modal";
import { fetchDatabaseAction, deleteTransactionAction } from "@/lib/actions";
import { DatabaseData, Transaksi } from "@/types";
import { PlusCircle, Loader2, RefreshCw, AlertCircle, Database, FileSpreadsheet, FileText } from "lucide-react";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [dbData, setDbData] = useState<DatabaseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaksi | null>(null);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async (showRefreshingSpinner = false) => {
    if (showRefreshingSpinner) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMsg("");

    try {
      const res = await fetchDatabaseAction();
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

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login");
    } else if (status === "authenticated") {
      loadData();
    }
  }, [status, router, loadData]);

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

  if (status === "loading" || (isLoading && !dbData)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm font-semibold">Menyinkronkan dengan Google Sheets...</p>
        <p className="text-xs text-slate-500 mt-1">Membuka `[DB] Kas Madrasah System` di Google Drive Anda</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      <Navbar
        madrasahName={dbData?.pengaturan.nama_madrasah}
        onRefresh={() => loadData(true)}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 space-y-5">
        {/* Header Title & Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Dashboard Keuangan Kas
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Pengelolaan dana masuk (debit) &amp; keluar (kredit) madrasah secara real-time
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2.5">
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
              <span>Catat Transaksi Baru</span>
            </button>
          </div>
        </div>

        {errorMsg && (
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

        {/* Monthly Cashflow Chart */}
        {dbData && <CashflowChart data={dbData.cashflow} />}

        {/* Transactions Table */}
        {dbData && (
          <div>
            <h2 className="text-lg font-bold text-slate-100 mb-3">Daftar Transaksi Terbaru</h2>
            <TransactionTable
              transactions={dbData.transaksi}
              categories={dbData.kategori}
              saldoAwal={dbData.summary.saldoAwal}
              onDelete={handleDelete}
              onEdit={(tx) => {
                setEditingTransaction(tx);
                setIsAddModalOpen(true);
              }}
              isDeletingId={deletingId}
            />
          </div>
        )}
      </main>

      {/* Transaction Modal (Add & Edit) */}
      {dbData && (
        <TransactionModal
          isOpen={isAddModalOpen}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingTransaction(null);
          }}
          categories={dbData.kategori}
          onSuccess={() => loadData(true)}
          editingTransaction={editingTransaction}
        />
      )}

      {/* Backup Import Modal */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onSuccess={() => loadData(true)}
      />
    </div>
  );
}
