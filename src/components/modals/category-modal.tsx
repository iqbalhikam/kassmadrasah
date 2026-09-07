"use client";

import { useState } from "react";
import { X, Loader2, PlusCircle, AlertCircle } from "lucide-react";
import { KategoriJenis } from "@/types";
import { createCategoryAction } from "@/lib/actions";
import { ModernSelect } from "@/components/ui/modern-select";

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CategoryModal({ isOpen, onClose, onSuccess }: CategoryModalProps) {
  const [namaKategori, setNamaKategori] = useState("");
  const [jenis, setJenis] = useState<KategoriJenis>("MASUK");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!namaKategori.trim()) {
      setErrorMsg("Nama kategori wajib diisi.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      formData.append("nama_kategori", namaKategori.trim());
      formData.append("jenis", jenis);

      const res = await createCategoryAction(formData);
      if (!res.success) {
        throw new Error(res.error);
      }

      setNamaKategori("");
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membuat kategori.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <h2 className="text-base font-bold text-slate-100">Tambah Kategori Kas</h2>
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
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Jenis Kategori
            </label>
            <ModernSelect
              value={jenis}
              onChange={(val) => setJenis(val as KategoriJenis)}
              options={[
                { value: "MASUK", label: "Pemasukan (MASUK)", badge: "Masuk", badgeColor: "emerald" },
                { value: "KELUAR", label: "Pengeluaran (KELUAR)", badge: "Keluar", badgeColor: "rose" },
              ]}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nama Kategori
            </label>
            <input
              type="text"
              placeholder="Contoh: Infaq Jumat, Biaya Listrik, Dll."
              value={namaKategori}
              onChange={(e) => setNamaKategori(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
              required
            />
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
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlusCircle className="h-4 w-4" />
              )}
              <span>Tambah Kategori</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
