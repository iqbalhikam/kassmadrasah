import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { redirect } from "next/navigation";
import { getDatabaseData } from "@/lib/google/sheets";
import { formatRupiah, formatTanggal } from "@/lib/utils";
import { ArrowLeft, School, CheckCircle2 } from "lucide-react";
import { PrintButton } from "@/components/kuitansi/print-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function KuitansiPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const { id } = await params;

  let transaction = null;
  let pengaturan = null;
  let errorMsg = "";

  try {
    const data = await getDatabaseData();
    const found = data.transaksi.find((t) => t.id === id);
    if (found) {
      transaction = found;
      pengaturan = data.pengaturan;
    } else {
      errorMsg = "Transaksi dengan ID tersebut tidak ditemukan.";
    }
  } catch (err: any) {
    errorMsg = err.message || "Gagal memuat dokumen transaksi.";
  }

  if (errorMsg || !transaction || !pengaturan) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-4 text-center">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 max-w-md">
          <h2 className="text-lg font-bold text-rose-400 mb-2">Dokumen Tidak Ditemukan</h2>
          <p className="text-xs text-slate-300 mb-4">{errorMsg || "Data tidak ditemukan."}</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isDebit = transaction.jenis === "DEBIT";

  return (
    <div className="min-h-screen bg-slate-950 py-8 px-4 sm:px-6">
      {/* Top Action Bar (Hidden on Print) */}
      <div className="no-print mx-auto max-w-3xl mb-6 flex items-center justify-between">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition"
        >
          <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
        </Link>

        <PrintButton />
      </div>

      {/* Printable Receipt Card */}
      <div className="print-card mx-auto max-w-3xl rounded-2xl border border-slate-700 bg-white text-slate-900 p-8 shadow-2xl">
        {/* Header Kop Kuitansi */}
        <div className="flex items-center justify-between border-b-2 border-slate-800 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-white font-bold">
              <School className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">
                {pengaturan.nama_madrasah}
              </h1>
              <p className="text-xs text-slate-600">Sistem Keuangan Kas Resmi Madrasah</p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-block rounded-md bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 uppercase tracking-wider">
              {isDebit ? "KUITANSI PENERIMAAN" : "KUITANSI PENGELUARAN"}
            </span>
            <p className="mt-1 text-[11px] font-mono text-slate-500">NO: {transaction.id}</p>
          </div>
        </div>

        {/* Details Table */}
        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-3">
            <span className="font-semibold text-slate-500">Telah {isDebit ? "Diterima Dari / Untuk" : "Diserahkan Kepada / Untuk"}</span>
            <span className="col-span-2 font-bold text-slate-900">{transaction.keterangan}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-3">
            <span className="font-semibold text-slate-500">Tanggal Transaksi</span>
            <span className="col-span-2 text-slate-800">{formatTanggal(transaction.tanggal)}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-3">
            <span className="font-semibold text-slate-500">Pos Kategori Kas</span>
            <span className="col-span-2 text-slate-800 font-medium">{transaction.kategori_nama || transaction.kategori_id}</span>
          </div>

          <div className="grid grid-cols-3 gap-2 border-b border-slate-200 pb-3 items-center">
            <span className="font-semibold text-slate-500">Jumlah Uang</span>
            <div className="col-span-2">
              <span className="inline-block rounded-xl bg-slate-100 px-4 py-2 text-xl font-black text-emerald-700 border border-slate-300">
                {formatRupiah(transaction.nominal)}
              </span>
            </div>
          </div>
        </div>

        {/* Signature Blocks */}
        <div className="mt-12 grid grid-cols-2 gap-8 text-center text-xs">
          <div>
            <p className="text-slate-500">Mengetahui,</p>
            <p className="font-bold text-slate-900 mb-16">Kepala Madrasah</p>
            <p className="font-bold text-slate-900 underline">{pengaturan.nama_kepala_madrasah}</p>
          </div>

          <div>
            <p className="text-slate-500">
              {formatTanggal(new Date().toISOString().split("T")[0])}
            </p>
            <p className="font-bold text-slate-900 mb-16">Bendahara</p>
            <p className="font-bold text-slate-900 underline">{pengaturan.nama_bendahara}</p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 pt-4 border-t border-dashed border-slate-300 text-center text-[10px] text-slate-400 flex items-center justify-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          <span>Dokumen ini diterbitkan secara elektronik &amp; tersimpan aman di Google Drive Kas Madrasah</span>
        </div>
      </div>
    </div>
  );
}
