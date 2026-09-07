import { z } from "zod";

export const transactionSchema = z.object({
  tanggal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD"),
  kategori_id: z.string().min(1, "Kategori harus dipilih"),
  keterangan: z.string().min(1, "Keterangan harus diisi"),
  jenis: z.enum(["DEBIT", "KREDIT"]),
  nominal: z.number().positive("Nominal harus lebih dari 0"),
  bukti_url: z.string().url("Format URL bukti tidak valid").or(z.literal("")).optional().default(""),
});

export const categorySchema = z.object({
  nama_kategori: z.string().min(1, "Nama kategori harus diisi").trim(),
  jenis: z.enum(["MASUK", "KELUAR"]),
});

export const settingsSchema = z.object({
  nama_madrasah: z.string().min(1, "Nama madrasah harus diisi"),
  nama_bendahara: z.string().min(1, "Nama bendahara harus diisi"),
  nama_kepala_madrasah: z.string().min(1, "Nama kepala madrasah harus diisi"),
  saldo_awal: z.number().nonnegative("Saldo awal tidak boleh negatif"),
});
