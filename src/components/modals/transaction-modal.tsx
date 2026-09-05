"use client";

import { useState, useEffect } from "react";
import { X, Upload, Loader2, CheckCircle2, AlertCircle, Edit3 } from "lucide-react";
import { Kategori, Transaksi, TransaksiJenis } from "@/types";
import { createTransactionAction, updateTransactionAction } from "@/lib/actions";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Kategori[];
  onSuccess: () => void;
  editingTransaction?: Transaksi | null;
}

export function TransactionModal({
  isOpen,
  onClose,
  categories,
  onSuccess,
  editingTransaction,
}: TransactionModalProps) {
  const [jenis, setJenis] = useState<TransaksiJenis>("DEBIT");
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [kategoriId, setKategoriId] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [nominal, setNominal] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [existingBuktiUrl, setExistingBuktiUrl] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (editingTransaction) {
      setJenis(editingTransaction.jenis || "DEBIT");
      setTanggal(editingTransaction.tanggal || new Date().toISOString().split("T")[0]);
      setKategoriId(editingTransaction.kategori_id || "");
      setKeterangan(editingTransaction.keterangan || "");
      setNominal(editingTransaction.nominal ? editingTransaction.nominal.toString() : "");
      setExistingBuktiUrl(editingTransaction.bukti_url || "");
      setFile(null);
    } else {
      setJenis("DEBIT");
      setTanggal(new Date().toISOString().split("T")[0]);
      setKategoriId("");
      setKeterangan("");
      setNominal("");
      setExistingBuktiUrl("");
      setFile(null);
    }
    setErrorMsg("");
  }, [editingTransaction, isOpen]);

  if (!isOpen) return null;

  const filteredCategories = categories.filter(
    (c) => c.jenis === (jenis === "DEBIT" ? "MASUK" : "KELUAR")
  );

  const isEditMode = !!editingTransaction;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!tanggal || !kategoriId || !keterangan || !nominal) {
      setErrorMsg("Harap isi semua kolom wajib.");
      return;
    }

    setIsSubmitting(true);

    try {
      let buktiUrl = existingBuktiUrl;

      if (file) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/drive/upload", {
          method: "POST",
          body: formData,
        });

        const uploadResult = await res.json();
        if (!res.ok || uploadResult.error) {
          throw new Error(uploadResult.error || "Gagal mengunggah nota ke Google Drive.");
        }
        buktiUrl = uploadResult.url;
        setIsUploading(false);
      }

      const actionFormData = new FormData();
      actionFormData.append("tanggal", tanggal);
      actionFormData.append("kategori_id", kategoriId);
      actionFormData.append("keterangan", keterangan);
      actionFormData.append("jenis", jenis);
      actionFormData.append("nominal", nominal);
      actionFormData.append("bukti_url", buktiUrl);

      let result;
      if (isEditMode && editingTransaction) {
        result = await updateTransactionAction(editingTransaction.id, actionFormData);
      } else {
        result = await createTransactionAction(actionFormData);
      }

      if (!result.success) {
        throw new Error(result.error);
      }

      setKeterangan("");
      setNominal("");
      setFile(null);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const e = err as Error;
      setErrorMsg(e.message || "Terjadi kesalahan saat menyimpan transaksi.");
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
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
            {isEditMode && <Edit3 className="h-5 w-5 text-amber-400" />}
            <h2 className="text-base font-bold text-slate-100">
              {isEditMode ? `Edit Transaksi Kas (${editingTransaction.id})` : "Tambah Transaksi Kas Baru"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form id="tx-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Jenis Transaksi Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Jenis Transaksi
              </label>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => { setJenis("DEBIT"); setKategoriId(""); }}
                  className={`py-2.5 rounded-lg text-xs font-bold transition ${
                    jenis === "DEBIT"
                      ? "bg-emerald-600 text-white shadow-md"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  + DEBIT (Pemasukan)
                </button>
                <button
                  type="button"
                  onClick={() => { setJenis("KREDIT"); setKategoriId(""); }}
                  className={`py-2.5 rounded-lg text-xs font-bold transition ${
                    jenis === "KREDIT"
                      ? "bg-rose-600 text-white shadow-md"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  - KREDIT (Pengeluaran)
                </button>
              </div>
            </div>

            {/* Tanggal & Kategori */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tanggal</label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Kategori</label>
                <select
                  value={kategoriId}
                  onChange={(e) => setKategoriId(e.target.value)}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                  required
                >
                  <option value="">-- Pilih Kategori --</option>
                  {filteredCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nama_kategori}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Nominal */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nominal Transaksi (Rp)
              </label>
              <input
                type="number"
                placeholder="Contoh: 500000"
                value={nominal}
                onChange={(e) => setNominal(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                min="1"
                required
                inputMode="numeric"
              />
            </div>

            {/* Keterangan */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Keterangan</label>
              <textarea
                placeholder="Rincian transaksi kas..."
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none resize-none"
                required
              />
            </div>

            {/* Upload Nota ke Drive */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Unggah Bukti / Nota {isEditMode ? "(Ganti Nota jika ingin diubah)" : "(Opsional)"}
              </label>
              <div className="relative border border-dashed border-slate-700 rounded-xl p-4 bg-slate-950/50 text-center hover:border-emerald-500 transition active:scale-[0.99]">
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center gap-1.5 text-xs text-slate-400 pointer-events-none">
                  <Upload className="h-5 w-5 text-emerald-400" />
                  <span className="font-medium">
                    {file
                      ? file.name
                      : existingBuktiUrl
                      ? "Bukti nota sudah ada (ketuk untuk ganti berkas)"
                      : "Ketuk untuk pilih foto / PDF bukti nota"}
                  </span>
                  {file && (
                    <span className="text-[10px] text-emerald-400">
                      {(file.size / 1024).toFixed(0)} KB
                    </span>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>

        {/* Sticky Footer Buttons */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-800 bg-slate-900">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
          >
            Batal
          </button>
          <button
            type="submit"
            form="tx-form"
            disabled={isSubmitting}
            className={`flex items-center gap-2 rounded-xl px-6 py-2.5 text-xs font-bold text-white shadow-lg transition disabled:opacity-50 active:scale-95 ${
              isEditMode
                ? "bg-amber-600 shadow-amber-600/30 hover:bg-amber-500"
                : "bg-emerald-600 shadow-emerald-600/30 hover:bg-emerald-500"
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{isUploading ? "Mengunggah Nota..." : "Menyimpan..."}</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>{isEditMode ? "Perbarui Transaksi" : "Simpan Transaksi"}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
