"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { CategoryModal } from "@/components/modals/category-modal";
import { fetchDatabaseAction, deleteCategoryAction } from "@/lib/actions";
import { DatabaseData, Kategori } from "@/types";
import { PlusCircle, Loader2, Trash2, ArrowDownLeft, ArrowUpRight, Tags } from "lucide-react";
import { cn } from "@/lib/utils";

export default function CategoriesPage() {
  const { status } = useSession();
  const router = useRouter();

  const [dbData, setDbData] = useState<DatabaseData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsRefreshing(true);
    else setIsLoading(true);

    try {
      const res = await fetchDatabaseAction();
      if (res.success && res.data) {
        setDbData(res.data);
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

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus kategori ini? Pastikan tidak ada transaksi yang menggunakan kategori ini.")) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await deleteCategoryAction(id);
      if (res.success) {
        loadData(true);
      } else {
        alert(res.error);
      }
    } finally {
      setDeletingId(null);
    }
  };

  if (status === "loading" || (isLoading && !dbData)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm font-semibold">Memuat kategori kas...</p>
      </div>
    );
  }

  const masukCategories = dbData?.kategori.filter((k) => k.jenis === "MASUK") || [];
  const keluarCategories = dbData?.kategori.filter((k) => k.jenis === "KELUAR") || [];

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar
        madrasahName={dbData?.pengaturan.nama_madrasah}
        onRefresh={() => loadData(true)}
        isRefreshing={isRefreshing}
      />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Tags className="h-6 w-6 text-emerald-400" /> Kategori Kas Madrasah
            </h1>
            <p className="text-xs text-slate-400">
              Kelola pos kategori penerimaan (MASUK) dan pengeluaran (KELUAR)
            </p>
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Tambah Kategori</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Pos Pemasukan (MASUK) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <ArrowDownLeft className="h-4 w-4" /> Pos Pemasukan (MASUK)
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {masukCategories.length} kategori
              </span>
            </div>

            <div className="space-y-2">
              {masukCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 hover:border-emerald-500/30 transition"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-200">{cat.nama_kategori}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{cat.id}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    disabled={deletingId === cat.id}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Pos Pengeluaran (KELUAR) */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                <ArrowUpRight className="h-4 w-4" /> Pos Pengeluaran (KELUAR)
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {keluarCategories.length} kategori
              </span>
            </div>

            <div className="space-y-2">
              {keluarCategories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/60 p-3 hover:border-rose-500/30 transition"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-200">{cat.nama_kategori}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{cat.id}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    disabled={deletingId === cat.id}
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => loadData(true)}
      />
    </div>
  );
}
