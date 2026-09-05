"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { School, Database, ShieldCheck, FileSpreadsheet, Lock, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center bg-slate-950 px-4 py-12 text-slate-100 overflow-hidden">
      {/* Background Gradients & Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 w-full max-w-md text-center">
        {/* Header Logo */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 shadow-2xl shadow-emerald-500/30 mb-6">
          <School className="h-8 w-8 text-white" />
        </div>

        <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
          Kas Madrasah <span className="text-emerald-400">Universal</span>
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Sistem Manajemen Keuangan Kas Madrasah Berbasis Database On-User Google Drive
        </p>

        {/* Feature Highlights */}
        <div className="my-8 space-y-3 text-left">
          <div className="flex items-start gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <Database className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">Database Milik Sendiri</h4>
              <p className="text-[11px] text-slate-400">
                Data otomatis dibuat dan disimpan di Google Sheets akun Google Anda sendiri (`[DB] Kas Madrasah System`).
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500/10 text-teal-400">
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">Arsip Nota di Google Drive</h4>
              <p className="text-[11px] text-slate-400">
                Foto bukti transaksi & kwitansi tersimpan rapi secara privat di folder Google Drive Anda.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-3.5 backdrop-blur-sm">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-200">100% Privat & Gratis</h4>
              <p className="text-[11px] text-slate-400">
                Tidak ada server pihak ketiga yang menyimpan data keuangan madrasah Anda.
              </p>
            </div>
          </div>
        </div>

        {/* Login Button */}
        <button
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="group relative flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-4 text-sm font-bold text-white shadow-xl shadow-emerald-600/30 hover:from-emerald-500 hover:to-teal-500 transition-all duration-200 active:scale-[0.98]"
        >
          <svg className="h-5 w-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Masuk Dengan Google Account</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>

        <p className="mt-6 text-xs text-slate-500">
          Dengan masuk, Anda mengizinkan aplikasi ini mengelola file `[DB] Kas Madrasah System` di Google Drive Anda.
        </p>
      </div>
    </div>
  );
}
