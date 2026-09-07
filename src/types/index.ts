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

export type GeminiModelOption =
  | 'gemini-3.7-flash'
  | 'gemini-3.5-flash'
  | 'gemini-3.5-flash-lite'
  | 'gemini-3.1-pro-preview'
  | 'gemini-2.5-flash';

export interface GeminiModelInfo {
  id: GeminiModelOption;
  label: string;
  description: string;
}

export const GEMINI_MODELS: GeminiModelInfo[] = [
  {
    id: 'gemini-3.7-flash',
    label: 'Gemini 3.7 Flash (Direkomendasikan - Paling Cepat & Responsif)',
    description: 'Paling cepat & responsif, optimal untuk scan nota instan dan transaksi harian.',
  },
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash (Stabil & Cepat)',
    description: 'Stabil & cepat dengan akurasi tinggi untuk pemrosesan data kasir rutin.',
  },
  {
    id: 'gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash-Lite (Hemat & Ringan)',
    description: 'Paling hemat kuota/token dan sangat ringan untuk koneksi terbatas.',
  },
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro (Analisis Kompleks & Reasoning)',
    description: 'Kemampuan reasoning tinggi, cocok untuk analisis laporan keuangan bulanan mendalam.',
  },
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash (Versi Sebelumnya)',
    description: 'Versi stabil sebelumnya untuk kompatibilitas cadangan.',
  },
];

export const DEFAULT_GEMINI_MODEL: GeminiModelOption = 'gemini-3.7-flash';

export interface Pengaturan {
  nama_madrasah: string;
  nama_bendahara: string;
  nama_kepala_madrasah: string;
  saldo_awal: number;
  gemini_api_key?: string;
  gemini_model?: GeminiModelOption;
  ai_analysis_result?: string;
  ai_analysis_hash?: string;
  ai_analysis_updated_at?: string;
}

export interface AIAnalysisResult {
  insight: string;
  trend: string;
  rekomendasi: string[];
  kesimpulan: string;
  error?: string;
}

export interface ScanNotaResult {
  nominal?: number;
  keterangan?: string;
  tanggal?: string;
  jenis?: 'DEBIT' | 'KREDIT';
  error?: string;
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
