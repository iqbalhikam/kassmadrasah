"use client";

import { useState, useCallback } from "react";
import { useCurrencyInput } from "@/hooks/useCurrencyInput";
import { Navbar } from "@/components/navbar";
import { BackupModal } from "@/components/modals/backup-modal";
import { fetchDatabaseAction, saveSettingsAction, saveGeminiAiSettingsAction } from "@/lib/actions";
import { DatabaseData, GeminiModelOption, GEMINI_MODELS, DEFAULT_GEMINI_MODEL } from "@/types";
import {
  Settings, Save, Loader2, CheckCircle2, AlertCircle, School, User,
  Wallet, FileSpreadsheet, Sparkles, Key, Eye, EyeOff, ExternalLink, Trash2,
  Cpu, Info
} from "lucide-react";
import { ModernSelect } from "@/components/ui/modern-select";

interface SettingsClientProps {
  initialData: DatabaseData | null;
  initialError?: string;
}

export function SettingsClient({ initialData, initialError = "" }: SettingsClientProps) {
  const [dbData, setDbData] = useState<DatabaseData | null>(initialData);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState(initialError);

  const [namaMadrasah, setNamaMadrasah] = useState(initialData?.pengaturan.nama_madrasah || "MA Universal Indonesia");
  const [namaBendahara, setNamaBendahara] = useState(initialData?.pengaturan.nama_bendahara || "Bendahara");
  const [namaKepala, setNamaKepala] = useState(initialData?.pengaturan.nama_kepala_madrasah || "Kepala Madrasah");
  const saldoAwalInput = useCurrencyInput({
    initial: initialData?.pengaturan.saldo_awal?.toString() || "0",
  });

  // AI Settings State
  const initialApiKey = initialData?.pengaturan.gemini_api_key || "";
  const initialModel = initialData?.pengaturan.gemini_model || DEFAULT_GEMINI_MODEL;

  const [geminiApiKey, setGeminiApiKey] = useState(initialApiKey);
  const [apiKeyInput, setApiKeyInput] = useState(initialApiKey);
  const [savedModel, setSavedModel] = useState<GeminiModelOption>(initialModel);
  const [selectedModel, setSelectedModel] = useState<GeminiModelOption>(initialModel);

  const [showApiKey, setShowApiKey] = useState(false);
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [keySuccess, setKeySuccess] = useState("");
  const [keyError, setKeyError] = useState("");

  const loadData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);

    try {
      const res = await fetchDatabaseAction(showSpinner);
      if (res.success && res.data) {
        setDbData(res.data);
        setNamaMadrasah(res.data.pengaturan.nama_madrasah);
        setNamaBendahara(res.data.pengaturan.nama_bendahara);
        setNamaKepala(res.data.pengaturan.nama_kepala_madrasah);
        saldoAwalInput.setFromRaw(res.data.pengaturan.saldo_awal.toString());
        const savedKey = res.data.pengaturan.gemini_api_key || "";
        const currentModel = res.data.pengaturan.gemini_model || DEFAULT_GEMINI_MODEL;
        setGeminiApiKey(savedKey);
        setApiKeyInput(savedKey);
        setSavedModel(currentModel);
        setSelectedModel(currentModel);
      }
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("nama_madrasah", namaMadrasah);
      formData.append("nama_bendahara", namaBendahara);
      formData.append("nama_kepala_madrasah", namaKepala);
      formData.append("saldo_awal", saldoAwalInput.rawValue || "0");

      const res = await saveSettingsAction(formData);
      if (res.success) {
        setSuccessMsg("Pengaturan madrasah berhasil diperbarui di Google Sheets!");
        loadData(true);
      } else {
        throw new Error(res.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan pengaturan.";
      setErrorMsg(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAiSettings = async () => {
    setIsSavingAiSettings(true);
    setKeySuccess("");
    setKeyError("");
    try {
      const res = await saveGeminiAiSettingsAction(apiKeyInput.trim(), selectedModel);
      if (res.success) {
        setGeminiApiKey(apiKeyInput.trim());
        setSavedModel(selectedModel);
        setKeySuccess("Pengaturan Gemini AI (API Key & Model) berhasil disimpan ke Google Sheets!");
      } else {
        throw new Error(res.error);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menyimpan Pengaturan Gemini AI.";
      setKeyError(msg);
    } finally {
      setIsSavingAiSettings(false);
    }
  };

  const handleTestApiKey = async () => {
    if (!apiKeyInput.trim()) return;
    setIsTesting(true);
    setKeySuccess("");
    setKeyError("");
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKeyInput.trim()}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: "Balas dengan kata: OK" }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });
      if (res.ok) {
        setKeySuccess(`✅ API Key valid dan terhubung dengan model ${selectedModel}!`);
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(err?.error?.message || `Model ${selectedModel} tidak dapat diakses dengan API Key ini.`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "API Key atau model tidak valid.";
      setKeyError(`❌ ${msg}`);
    } finally {
      setIsTesting(false);
    }
  };

  const handleDeleteApiKey = async () => {
    if (!confirm("Hapus Gemini API Key dari sistem?")) return;
    setIsSavingAiSettings(true);
    try {
      const res = await saveGeminiAiSettingsAction("", DEFAULT_GEMINI_MODEL);
      if (res.success) {
        setGeminiApiKey("");
        setApiKeyInput("");
        setSelectedModel(DEFAULT_GEMINI_MODEL);
        setSavedModel(DEFAULT_GEMINI_MODEL);
        setKeySuccess("Pengaturan Gemini AI berhasil dihapus.");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal menghapus Pengaturan Gemini AI.";
      setKeyError(msg);
    } finally {
      setIsSavingAiSettings(false);
    }
  };

  const activeModelMeta = GEMINI_MODELS.find((m) => m.id === selectedModel) || GEMINI_MODELS[0];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar
        madrasahName={dbData?.pengaturan.nama_madrasah}
        onRefresh={() => loadData(true)}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 space-y-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Settings className="h-6 w-6 text-emerald-400" /> Pengaturan Madrasah &amp; Saldo Awal
          </h1>
          <p className="text-xs text-slate-400">
            Atur identitas lembaga, pejabat penandatangan kuitansi, model AI Gemini, dan restore data backup.
          </p>
        </div>

        {successMsg && (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-xs text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="flex items-center gap-2 rounded-2xl bg-rose-500/10 border border-rose-500/20 p-4 text-xs text-rose-400">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Profil Lembaga & Saldo */}
        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm shadow-sm">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <School className="h-4 w-4 text-emerald-400" /> Nama Lembaga / Madrasah
            </label>
            <input
              type="text"
              value={namaMadrasah}
              onChange={(e) => setNamaMadrasah(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="h-4 w-4 text-teal-400" /> Nama Bendahara Kas
              </label>
              <input
                type="text"
                value={namaBendahara}
                onChange={(e) => setNamaBendahara(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <User className="h-4 w-4 text-indigo-400" /> Nama Kepala Madrasah
              </label>
              <input
                type="text"
                value={namaKepala}
                onChange={(e) => setNamaKepala(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-emerald-400" /> Saldo Awal Kas
            </label>
            <div className="relative">
              <input
                type="text"
                inputMode="numeric"
                placeholder="Rp 0"
                value={saldoAwalInput.displayValue}
                onChange={saldoAwalInput.handleChange}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-bold text-slate-100 focus:border-emerald-500 focus:outline-none tracking-wide"
                required
              />
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Saldo awal kas madrasah sebelum transaksi pertama dicatat.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition disabled:opacity-50 active:scale-95"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </form>

        {/* Card Impor & Restore Data Backup */}
        <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-slate-900/90 to-slate-950 p-6 backdrop-blur-sm space-y-4 shadow-lg shadow-emerald-950/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-100">
                  Impor &amp; Restore Backup Google Sheets
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 max-w-lg">
                  Impor data transaksi, daftar kategori, dan pengaturan kas dari link Google Sheets cadangan/backup Anda.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsBackupModalOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600/20 border border-emerald-500/30 px-4 py-2.5 text-xs font-bold text-emerald-300 hover:bg-emerald-600/30 hover:text-emerald-200 transition shrink-0 active:scale-95"
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
              <span>Impor Data Backup</span>
            </button>
          </div>
        </div>

        {/* ─── AI Settings Card (Gemini API Key & Dynamic Model Selector) ─── */}
        <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/20 to-slate-950 p-6 backdrop-blur-sm space-y-5 shadow-lg">
          <div className="flex items-start gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/10 text-violet-400 border border-violet-500/20 shrink-0">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-100">Pengaturan AI (Google Gemini)</h3>
              <p className="text-xs text-slate-400 mt-0.5 max-w-lg">
                Konfigurasikan API Key dan pilih model AI Gemini yang akan digunakan untuk analisis kas, scan nota dengan kamera, dan input suara.
              </p>
            </div>
          </div>

          {keySuccess && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{keySuccess}</span>
            </div>
          )}

          {keyError && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{keyError}</span>
            </div>
          )}

          {geminiApiKey && (
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 p-3 text-xs">
              <CheckCircle2 className="h-4 w-4 text-violet-400 shrink-0" />
              <span className="text-violet-300 font-semibold">Status AI Aktif</span>
              <span className="text-slate-500 font-mono">
                Key: {geminiApiKey.slice(0, 8)}...{geminiApiKey.slice(-4)}
              </span>
              <span className="text-slate-600">•</span>
              <span className="rounded-md bg-violet-500/20 px-2 py-0.5 font-mono text-[11px] text-violet-200">
                Model: {savedModel}
              </span>
            </div>
          )}

          {/* Model Selector Dropdown */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-violet-400" /> Pilihan Model Gemini AI
              </span>
              <span className="text-[10px] text-slate-500">Standar Resmi Gemini API</span>
            </label>

            <ModernSelect
              accentColor="violet"
              value={selectedModel}
              onChange={(val) => {
                setSelectedModel(val as GeminiModelOption);
                setKeySuccess("");
                setKeyError("");
              }}
              options={GEMINI_MODELS.map((model) => ({
                value: model.id,
                label: model.label,
                badge: model.badge,
                badgeColor: "violet",
                description: model.description,
              }))}
            />

            {/* Selected Model Description Banner */}
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-[11px] text-slate-300 space-y-1.5">
              <div className="flex items-center gap-1.5 text-violet-400 font-semibold">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>Karakteristik Model {activeModelMeta.id}:</span>
              </div>
              <p className="text-slate-400 pl-5">
                {activeModelMeta.description}
              </p>
            </div>

            {/* Quick guide comparison */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
              <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-2.5">
                <p className="font-semibold text-emerald-400">⚡ Flash Models (3.7 / 3.5 / 2.5 / Lite)</p>
                <p className="text-slate-400 mt-0.5">
                  Optimal untuk transaksi kasir cepat, OCR scan nota kamera, dan speech-to-text hemat kuota.
                </p>
              </div>
              <div className="rounded-lg border border-slate-800/80 bg-slate-900/40 p-2.5">
                <p className="font-semibold text-indigo-400">🧠 Pro Models (3.1 Pro Preview)</p>
                <p className="text-slate-400 mt-0.5">
                  Dirancang untuk penalaran mendalam, analisis komprehensif laporan kas bulanan, dan evaluasi anggaran.
                </p>
              </div>
            </div>
          </div>

          {/* Gemini API Key Input */}
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <label className="block text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Key className="h-3.5 w-3.5 text-violet-400" /> Gemini API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={apiKeyInput}
                onChange={(e) => { setApiKeyInput(e.target.value); setKeySuccess(""); setKeyError(""); }}
                placeholder="AIzaSy..."
                id="input-gemini-api-key"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 pr-10 text-sm font-mono text-slate-100 focus:border-violet-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition"
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Dapatkan API Key gratis di{" "}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 underline underline-offset-2 inline-flex items-center gap-0.5"
              >
                Google AI Studio <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={handleTestApiKey}
              disabled={!apiKeyInput.trim() || isTesting}
              id="btn-test-gemini"
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition disabled:opacity-50 active:scale-95"
            >
              {isTesting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 text-teal-400" />}
              Test Model {selectedModel}
            </button>

            <button
              type="button"
              onClick={handleSaveAiSettings}
              disabled={!apiKeyInput.trim() || isSavingAiSettings}
              id="btn-save-ai-settings"
              className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-5 py-2 text-xs font-bold text-white shadow-md shadow-violet-600/30 hover:bg-violet-500 transition disabled:opacity-50 active:scale-95"
            >
              {isSavingAiSettings ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Simpan Pengaturan AI
            </button>

            {geminiApiKey && (
              <button
                type="button"
                onClick={handleDeleteApiKey}
                disabled={isSavingAiSettings}
                id="btn-delete-gemini"
                className="flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus
              </button>
            )}
          </div>
        </div>
      </main>

      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        onSuccess={() => loadData(true)}
      />
    </div>
  );
}
