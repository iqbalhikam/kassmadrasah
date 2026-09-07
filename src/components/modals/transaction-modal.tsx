"use client";

import { useState, useEffect } from "react";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { X, Upload, Loader2, CheckCircle2, AlertCircle, Edit3, ScanLine, Plus, PlusCircle, Check } from "lucide-react";
import { Kategori, KategoriJenis, Transaksi, TransaksiJenis, ScanNotaResult, GeminiModelOption } from "@/types";
import { createTransactionAction, updateTransactionAction, createCategoryAction } from "@/lib/actions";
import { VoiceInputBtn } from "@/components/ai/voice-input-btn";
import { CameraScanModal } from "@/components/ai/camera-scan-modal";
import { AIInputSuggester } from "@/components/ai/ai-input-suggester";
import { ModernDatePicker } from "@/components/ui/modern-date-picker";
import { ModernSelect } from "@/components/ui/modern-select";

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Kategori[];
  onSuccess: () => void;
  editingTransaction?: Transaksi | null;
  geminiApiKey?: string;
  geminiModel?: GeminiModelOption;
  onCategoryCreated?: (newCategory: Kategori) => void;
}

export function TransactionModal({
  isOpen,
  onClose,
  categories,
  onSuccess,
  editingTransaction,
  geminiApiKey = "",
  geminiModel,
  onCategoryCreated,
}: TransactionModalProps) {
  const [jenis, setJenis] = useState<TransaksiJenis>("DEBIT");
  const [tanggal, setTanggal] = useState(new Date().toISOString().split("T")[0]);
  const [kategoriId, setKategoriId] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const nominalInput = useCurrencyInput({ initial: "" });

  // Categories state with local updates for instant category creation
  const [localCategories, setLocalCategories] = useState<Kategori[]>(categories);
  const [showNewCategoryInline, setShowNewCategoryInline] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryJenis, setNewCategoryJenis] = useState<KategoriJenis>("MASUK");
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [categorySuccessMsg, setCategorySuccessMsg] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [existingBuktiUrl, setExistingBuktiUrl] = useState("");
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Sync with incoming categories
  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  useEffect(() => {
    if (editingTransaction) {
      setJenis(editingTransaction.jenis || "DEBIT");
      setTanggal(editingTransaction.tanggal || new Date().toISOString().split("T")[0]);
      setKategoriId(editingTransaction.kategori_id || "");
      setKeterangan(editingTransaction.keterangan || "");
      nominalInput.setFromRaw(editingTransaction.nominal ? editingTransaction.nominal.toString() : "");
      setExistingBuktiUrl(editingTransaction.bukti_url || "");
      setFile(null);
    } else {
      setJenis("DEBIT");
      setTanggal(new Date().toISOString().split("T")[0]);
      setKategoriId("");
      setKeterangan("");
      nominalInput.reset();
      setExistingBuktiUrl("");
      setFile(null);
    }
    setErrorMsg("");
    setShowNewCategoryInline(false);
    setCategorySuccessMsg("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTransaction, isOpen]);

  // Handle direct category creation (from inline form or from AI recommendation)
  const handleCreateCategory = async (nama: string, jenisKategori: KategoriJenis) => {
    if (!nama.trim()) return;
    setIsCreatingCategory(true);
    setErrorMsg("");
    try {
      const formData = new FormData();
      formData.append("nama_kategori", nama.trim());
      formData.append("jenis", jenisKategori);

      const res = await createCategoryAction(formData);
      if (!res.success || !res.category) {
        throw new Error(res.error || "Gagal membuat kategori.");
      }

      const createdCat = res.category;
      setLocalCategories((prev) => {
        if (prev.some((c) => c.id === createdCat.id)) return prev;
        return [...prev, createdCat];
      });

      // Align transaction jenis if needed and select the new category
      setJenis(createdCat.jenis === "MASUK" ? "DEBIT" : "KREDIT");
      setKategoriId(createdCat.id);
      setNewCategoryName("");
      setShowNewCategoryInline(false);
      setCategorySuccessMsg(`Kategori "${createdCat.nama_kategori}" berhasil dibuat & dipilih!`);
      setTimeout(() => setCategorySuccessMsg(""), 3500);

      onCategoryCreated?.(createdCat);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal membuat kategori.";
      setErrorMsg(msg);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  if (!isOpen) return null;

  const filteredCategories = localCategories.filter(
    (c) => c.jenis === (jenis === "DEBIT" ? "MASUK" : "KELUAR")
  );

  const isEditMode = !!editingTransaction;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!tanggal || !kategoriId || !keterangan || !nominalInput.rawValue) {
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
      actionFormData.append("nominal", nominalInput.rawValue);
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
      nominalInput.reset();
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

  const handleScanResult = (result: ScanNotaResult) => {
    if (result.nominal) nominalInput.setFromRaw(result.nominal.toString());
    if (result.keterangan) setKeterangan(result.keterangan);
    if (result.tanggal) setTanggal(result.tanggal);
    if (result.jenis) setJenis(result.jenis);
    setIsScanModalOpen(false);
  };

  return (
    <>
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
          <div className="flex items-center gap-2">
            {geminiApiKey && (
              <button
                type="button"
                onClick={() => setIsScanModalOpen(true)}
                title="Scan nota/kuitansi dengan AI"
                className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-violet-300 hover:bg-violet-500/20 transition active:scale-95"
              >
                <ScanLine className="h-3.5 w-3.5" />
                <span className="hidden xs:inline">Scan Nota</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
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
                <label className="block text-xs font-semibold text-slate-300 mb-1">Tanggal Transaksi</label>
                <ModernDatePicker
                  value={tanggal}
                  onChange={(val) => setTanggal(val)}
                  placeholder="Pilih Tanggal"
                  required
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">Kategori Kas</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewCategoryInline(!showNewCategoryInline);
                      setNewCategoryJenis(jenis === "DEBIT" ? "MASUK" : "KELUAR");
                    }}
                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 transition"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Kategori Baru</span>
                  </button>
                </div>
                <ModernSelect
                  value={kategoriId}
                  onChange={(val) => setKategoriId(val)}
                  placeholder="-- Pilih Kategori --"
                  searchable={true}
                  options={filteredCategories.map((c) => ({
                    value: c.id,
                    label: c.nama_kategori,
                    badge: c.jenis === "MASUK" ? "Masuk" : "Keluar",
                    badgeColor: c.jenis === "MASUK" ? "emerald" : "rose",
                  }))}
                />
              </div>
            </div>

            {/* Inline Mini-Form: Tambah Kategori Baru Langsung */}
            {showNewCategoryInline && (
              <div className="rounded-xl border border-emerald-500/30 bg-slate-950 p-3 space-y-2.5 animate-in fade-in slide-in-from-top-1 shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                    <PlusCircle className="h-3.5 w-3.5 text-emerald-400" />
                    Buat Kategori Kas Baru Langsung
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowNewCategoryInline(false)}
                    className="text-slate-400 hover:text-slate-200 text-xs px-1"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-2">
                    <input
                      type="text"
                      placeholder="Nama kategori (contoh: Pemeliharaan Sarpras)"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div>
                    <ModernSelect
                      size="sm"
                      value={newCategoryJenis}
                      onChange={(val) => setNewCategoryJenis(val as KategoriJenis)}
                      options={[
                        { value: "MASUK", label: "MASUK (Pemasukan)", badge: "Masuk", badgeColor: "emerald" },
                        { value: "KELUAR", label: "KELUAR (Pengeluaran)", badge: "Keluar", badgeColor: "rose" },
                      ]}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewCategoryInline(false)}
                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isCreatingCategory || !newCategoryName.trim()}
                    onClick={() => handleCreateCategory(newCategoryName, newCategoryJenis)}
                    className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 active:scale-95"
                  >
                    {isCreatingCategory ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      <>
                        <Check className="h-3 w-3" />
                        <span>Simpan & Pilih</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Notification if category was just created */}
            {categorySuccessMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 text-xs text-emerald-300 animate-in fade-in">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{categorySuccessMsg}</span>
              </div>
            )}

            {/* Nominal */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nominal Transaksi
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Rp 0"
                  value={nominalInput.displayValue}
                  onChange={nominalInput.handleChange}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm font-semibold text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none tracking-wide"
                  required
                />
                {nominalInput.rawValue && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                    {parseInt(nominalInput.rawValue).toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {[50000, 100000, 250000, 500000, 1000000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => nominalInput.setFromRaw(val.toString())}
                    className="rounded-lg border border-slate-800 bg-slate-950/80 px-2 py-0.5 text-[10px] font-medium text-slate-400 hover:border-emerald-500/40 hover:text-emerald-300 transition active:scale-95"
                  >
                    +Rp {(val / 1000).toLocaleString("id-ID")}rb
                  </button>
                ))}
              </div>
            </div>

            {/* Keterangan & Auto Kategori AI */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">Keterangan Transaksi</label>
                <VoiceInputBtn
                  onResult={(transcript) => setKeterangan(transcript)}
                  onNominalDetected={(val) => nominalInput.setFromRaw(val.toString())}
                  size="sm"
                />
              </div>

              {/* Textarea Keterangan (Bersih, Responsif & Cepat) */}
              <textarea
                placeholder="Rincian transaksi kas... atau gunakan Voice untuk input suara"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm leading-relaxed text-slate-100 placeholder-slate-600 focus:border-emerald-500 focus:outline-none resize-none transition"
                required
              />

              {/* Auto Category Detector & New Category Recommendation */}
              <AIInputSuggester
                keterangan={keterangan}
                currentJenis={jenis}
                currentKategoriId={kategoriId}
                categories={localCategories}
                apiKey={geminiApiKey}
                model={geminiModel}
                onApplyCategory={(catId, suggestedJenis) => {
                  if (suggestedJenis) setJenis(suggestedJenis);
                  setKategoriId(catId);
                }}
                onApplyKeterangan={(text) => setKeterangan(text)}
                onRequestCreateCategory={(suggestedName, suggestedJenis) => {
                  handleCreateCategory(
                    suggestedName,
                    suggestedJenis === "DEBIT" ? "MASUK" : "KELUAR"
                  );
                }}
                isCreatingCategory={isCreatingCategory}
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

    {/* Camera Scan Modal */}
    {geminiApiKey && (
      <CameraScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        apiKey={geminiApiKey}
        model={geminiModel}
        onScanResult={handleScanResult}
      />
    )}
    </>
  );
}
