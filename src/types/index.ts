export type TransaksiJenis = 'DEBIT' | 'KREDIT';
export type KategoriJenis = 'MASUK' | 'KELUAR';

export interface Transaksi {
  id: string;
  tanggal: string; // ISO format: YYYY-MM-DD
  kategori_id: string;
  kategori_nama?: string;
  keterangan: string;
  jenis: TransaksiJenis;
  nominal: number;
  bukti_url?: string;
  created_at: string;
}

export interface Kategori {
  id: string;
  nama_kategori: string;
  jenis: KategoriJenis;
}

export interface Pengaturan {
  nama_madrasah: string;
  nama_bendahara: string;
  nama_kepala_madrasah: string;
  saldo_awal: number;
}

export interface KasSummary {
  totalDebit: number;
  totalKredit: number;
  saldoAwal: number;
  saldoAkhir: number;
  totalTransaksi: number;
}

export interface CashFlowMonthly {
  bulan: string; // "Jan", "Feb", etc.
  debit: number;
  kredit: number;
}

export interface DatabaseData {
  transaksi: Transaksi[];
  kategori: Kategori[];
  pengaturan: Pengaturan;
  summary: KasSummary;
  cashflow: CashFlowMonthly[];
}
