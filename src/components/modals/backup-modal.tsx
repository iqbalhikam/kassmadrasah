"use client";

import { useState } from "react";
import { X, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle, RefreshCw, ArrowRight } from "lucide-react";
import { restoreBackupAction } from "@/lib/actions";

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BackupModal({ isOpen, onClose, onSuccess }: BackupModalProps) {
  const [sheetUrl, setSheetUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [report, setReport] = useState<{
    transactionsCount: number;
    categoriesCount: number;
    settingsUpdated: boolean;
  } | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setReport(null);

    if (!sheetUrl.trim()) {
      setErrorMsg("URL atau ID Google Sheets wajib diisi.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await restoreBackupAction(sheetUrl.trim());
      if (res.success && res.report) {
        setReport(res.report);
        onSuccess();
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal mengimpor data backup.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl max-h-[92dvh] flex flex-col">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-700" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">Impor / Restore Data Backup</h2>
              <p className="text-xs text-slate-400">Sinkronkan data dari file Google Sheets cadangan</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {report ? (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-400">
              <CheckCircle2 className="h-6 w-6 shrink-0" />
              <div>
                <h4 className="text-sm font-bold">Sinkronisasi Backup Berhasil!</h4>
                <p className="text-xs text-emerald-300/80 mt-0.5">
                  Data dari Google Sheet cadangan telah disalin ke database aktif Anda.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Transaksi Diimpor:</span>
                <span className="font-bold text-slate-200">{report.transactionsCount} catatan</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-2">
                <span className="text-slate-400">Kategori Diimpor:</span>
                <span className="font-bold text-slate-200">{report.categoriesCount} pos</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Pengaturan Madrasah & Saldo Awal:</span>
                <span className="font-bold text-emerald-400">
                  {report.settingsUpdated ? "Diperbarui" : "Tetap"}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => {
                  setReport(null);
                  setSheetUrl("");
                  onClose();
                }}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-500 transition"
              >
                Selesai & Lihat Dashboard
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                URL atau ID Google Sheets Cadangan
              </label>
              <textarea
                placeholder="Tempelkan URL Google Sheets di sini, contoh: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlb74OgvE2upmsw/edit"
                value={sheetUrl}
                onChange={(e) => setSheetUrl(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                required
              />
              <p className="mt-1.5 text-[11px] text-slate-500 leading-relaxed">
                💡 Cukup salin dan tempelkan alamat URL file Google Sheet cadangan Anda dari address bar browser. Sistem akan otomatis mendeteksi ID sheet.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-400 space-y-1">
              <p className="font-semibold text-slate-300 mb-1">Catatan Penting:</p>
              <p>• File sumber harus memiliki sheet `Transaksi`, `Kategori`, atau `Pengaturan`.</p>
              <p>• Pastikan akun Google Anda memiliki akses untuk membaca file tersebut.</p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Mensinkronkan Data...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    <span>Mulai Impor Backup</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
        </div>
      </div>
    </div>
  );
}
