"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  ExternalLink,
  Printer,
  Trash2,
  FileText,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { Transaksi, Kategori } from "@/types";
import { formatRupiah, formatTanggal, cn } from "@/lib/utils";

interface TransactionTableProps {
  transactions: Transaksi[];
  categories: Kategori[];
  onDelete: (id: string) => void;
  isDeletingId?: string | null;
}

export function TransactionTable({
  transactions,
  categories,
  onDelete,
  isDeletingId,
}: TransactionTableProps) {
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedJenis, setSelectedJenis] = useState("ALL");

  const filteredTransactions = transactions.filter((t) => {
    const matchSearch =
      t.keterangan.toLowerCase().includes(search.toLowerCase()) ||
      t.id.toLowerCase().includes(search.toLowerCase()) ||
      (t.kategori_nama && t.kategori_nama.toLowerCase().includes(search.toLowerCase()));

    const matchCategory = selectedCategory === "ALL" || t.kategori_id === selectedCategory;
    const matchJenis = selectedJenis === "ALL" || t.jenis === selectedJenis;

    return matchSearch && matchCategory && matchJenis;
  });

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm">
      {/* Controls: Search & Filters */}
      <div className="flex flex-col md:flex-row gap-3 justify-between items-stretch mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari transaksi, ID, atau keterangan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Jenis Filter */}
          <select
            value={selectedJenis}
            onChange={(e) => setSelectedJenis(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs font-medium text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">Semua Jenis</option>
            <option value="DEBIT">Debit (Pemasukan)</option>
            <option value="KREDIT">Kredit (Pengeluaran)</option>
          </select>

          {/* Kategori Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs font-medium text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.nama_kategori}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950/90 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">ID / Kategori</th>
              <th className="px-4 py-3">Keterangan</th>
              <th className="px-4 py-3 text-right">Nominal</th>
              <th className="px-4 py-3 text-center">Bukti / Nota</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
            {filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  <FileText className="mx-auto h-8 w-8 mb-2 opacity-40" />
                  Belum ada catatan transaksi yang sesuai.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => {
                const isDebit = tx.jenis === "DEBIT";
                return (
                  <tr key={tx.id} className="hover:bg-slate-800/40 transition">
                    <td className="px-4 py-3 whitespace-nowrap text-xs font-medium text-slate-300">
                      {formatTanggal(tx.tanggal)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-200">
                          {tx.kategori_nama || tx.kategori_id}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">{tx.id}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300 max-w-xs truncate">
                      {tx.keterangan}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div
                        className={cn(
                          "inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md",
                          isDebit
                            ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/20"
                            : "text-rose-400 bg-rose-500/10 border border-rose-500/20"
                        )}
                      >
                        {isDebit ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                        {isDebit ? "+" : "-"} {formatRupiah(tx.nominal)}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {tx.bukti_url ? (
                        <a
                          href={tx.bukti_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-teal-400 hover:text-teal-300 hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> Lihat
                        </a>
                      ) : (
                        <span className="text-xs text-slate-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Print Receipt Button */}
                        <Link
                          href={`/kuitansi/${tx.id}`}
                          title="Cetak Kuitansi Resmi"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-emerald-400 transition"
                        >
                          <Printer className="h-4 w-4" />
                        </Link>
                        {/* Delete Button */}
                        <button
                          onClick={() => onDelete(tx.id)}
                          disabled={isDeletingId === tx.id}
                          title="Hapus Transaksi"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 transition disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
