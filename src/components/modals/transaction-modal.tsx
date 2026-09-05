"use client";

import { useState } from "react";
import { X, Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Kategori, TransaksiJenis } from "@/types";
import { createTransactionAction } from "@/lib/actions";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Kategori[];
  onSuccess: () => void;
}

export function TransactionModal({
  isOpen,
  onClose,
  categories,
  onSuccess,
}: TransactionModalProps) {
  const [jenis, setJenis] = useState<TransaksiJenis>("DEBIT");
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [kategoriId, setKategoriId] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [nominal, setNominal] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const filteredCategories = categories.filter(
    (c) => c.jenis === (jenis === "DEBIT" ? "MASUK" : "KELUAR")
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!tanggal || !kategoriId || !keterangan || !nominal) {
      setErrorMsg("Harap isi semua kolom wajib.");
      return;
    }

    setIsSubmitting(true);

    try {
      let buktiUrl = "";

      // 1. Upload receipt to Drive if file is attached
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

      // 2. Append transaction to Google Sheet
      const actionFormData = new FormData();
      actionFormData.append("tanggal", tanggal);
      actionFormData.append("kategori_id", kategoriId);
      actionFormData.append("keterangan", keterangan);
      actionFormData.append("jenis", jenis);
      actionFormData.append("nominal", nominal);
      actionFormData.append("bukti_url", buktiUrl);

      const result = await createTransactionAction(actionFormData);
      if (!result.success) {
        throw new Error(result.error);
      }

      // Reset form & close modal
      setKeterangan("");
      setNominal("");
      setFile(null);
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Terjadi kesalahan saat menyimpan transaksi.");
    } finally {
      setIsSubmitting(false);
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
          <h2 className="text-lg font-bold text-slate-100">Tambah Transaksi Kas Baru</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Jenis Transaksi Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Jenis Transaksi
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setJenis("DEBIT");
                  setKategoriId("");
                }}
                className={`py-2 rounded-lg text-xs font-bold transition ${
                  jenis === "DEBIT"
                    ? "bg-emerald-600 text-white shadow-md"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                + DEBIT (Pemasukan)
              </button>
              <button
                type="button"
                onClick={() => {
                  setJenis("KREDIT");
                  setKategoriId("");
                }}
                className={`py-2 rounded-lg text-xs font-bold transition ${
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
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Kategori</label>
              <select
                value={kategoriId}
                onChange={(e) => setKategoriId(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
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
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm font-semibold text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              min="1"
              required
            />
          </div>

          {/* Keterangan */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Keterangan</label>
            <textarea
              placeholder="Rincian transaksi kas..."
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              rows={2}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          {/* Upload Nota ke Drive */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Unggah Bukti / Nota (Opsional)
            </label>
            <div className="relative border border-dashed border-slate-700 rounded-xl p-3 bg-slate-950/50 text-center hover:border-emerald-500 transition">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                <Upload className="h-4 w-4 text-emerald-400" />
                <span>{file ? file.name : "Klik untuk pilih foto/pdf bukti nota"}</span>
              </div>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">
              Berkas akan diunggah otomatis ke Google Drive Anda di folder `[Nota Kas Madrasah]`.
            </p>
          </div>

          {/* Action Buttons */}
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
                  <span>{isUploading ? "Mengunggah Nota..." : "Menyimpan..."}</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Simpan Transaksi</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
