"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { fetchDatabaseAction, saveSettingsAction } from "@/lib/actions";
import { DatabaseData } from "@/types";
import { Settings, Save, Loader2, CheckCircle2, AlertCircle, School, User, Wallet } from "lucide-react";

export default function SettingsPage() {
  const { status } = useSession();
  const router = useRouter();

  const [dbData, setDbData] = useState<DatabaseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const [namaMadrasah, setNamaMadrasah] = useState("");
  const [namaBendahara, setNamaBendahara] = useState("");
  const [namaKepala, setNamaKepala] = useState("");
  const [saldoAwal, setSaldoAwal] = useState("");

  const loadData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await fetchDatabaseAction();
      if (res.success && res.data) {
        setDbData(res.data);
        setNamaMadrasah(res.data.pengaturan.nama_madrasah);
        setNamaBendahara(res.data.pengaturan.nama_bendahara);
        setNamaKepala(res.data.pengaturan.nama_kepala_madrasah);
        setSaldoAwal(res.data.pengaturan.saldo_awal.toString());
      }
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
      formData.append("saldo_awal", saldoAwal);

      const res = await saveSettingsAction(formData);
      if (res.success) {
        setSuccessMsg("Pengaturan madrasah berhasil diperbarui di Google Sheets!");
        loadData(true);
      } else {
        throw new Error(res.error);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal menyimpan pengaturan.");
    } finally {
      setIsSaving(false);
    }
  };

  if (status === "loading" || (isLoading && !dbData)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm font-semibold">Memuat pengaturan madrasah...</p>
      </div>
    );
  }

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
            <Settings className="h-6 w-6 text-emerald-400" /> Pengaturan Madrasah & Saldo Awal
          </h1>
          <p className="text-xs text-slate-400">
            Atur identitas lembaga, pejabat penandatangan kuitansi, dan saldo awal kas.
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

        <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-6 backdrop-blur-sm">
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
              <Wallet className="h-4 w-4 text-emerald-400" /> Saldo Awal Kas (Rp)
            </label>
            <input
              type="number"
              value={saldoAwal}
              onChange={(e) => setSaldoAwal(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm font-bold text-slate-100 focus:border-emerald-500 focus:outline-none"
              min="0"
              required
            />
            <p className="mt-1 text-[11px] text-slate-500">
              Saldo awal kas madrasah sebelum transaksi pertama dicatat.
            </p>
          </div>

          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition disabled:opacity-50"
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
      </main>
    </div>
  );
}
