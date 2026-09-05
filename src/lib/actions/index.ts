"use server";

import { revalidatePath } from "next/cache";
import {
  getDatabaseData,
  addTransaction,
  deleteTransaction,
  addCategory,
  deleteCategory,
  updateSettings,
} from "@/lib/google/sheets";
import { Transaksi, Kategori, Pengaturan } from "@/types";
import { generateId } from "@/lib/utils";

export async function fetchDatabaseAction() {
  try {
    const data = await getDatabaseData();
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal mengambil data dari Google Sheets." };
  }
}

export async function createTransactionAction(formData: FormData) {
  try {
    const tanggal = formData.get("tanggal") as string;
    const kategori_id = formData.get("kategori_id") as string;
    const keterangan = formData.get("keterangan") as string;
    const jenis = formData.get("jenis") as "DEBIT" | "KREDIT";
    const nominal = parseFloat((formData.get("nominal") as string) || "0");
    const bukti_url = (formData.get("bukti_url") as string) || "";

    if (!tanggal || !kategori_id || !keterangan || !nominal) {
      throw new Error("Mohon lengkapi semua kolom yang wajib diisi.");
    }

    const id = generateId("TX");
    await addTransaction({
      id,
      tanggal,
      kategori_id,
      keterangan,
      jenis,
      nominal,
      bukti_url,
    });

    revalidatePath("/dashboard");
    return { success: true, id };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menambahkan transaksi." };
  }
}

export async function deleteTransactionAction(id: string) {
  try {
    await deleteTransaction(id);
    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghapus transaksi." };
  }
}

export async function createCategoryAction(formData: FormData) {
  try {
    const nama_kategori = formData.get("nama_kategori") as string;
    const jenis = formData.get("jenis") as "MASUK" | "KELUAR";

    if (!nama_kategori) {
      throw new Error("Nama kategori harus diisi.");
    }

    const id = generateId("CAT");
    await addCategory({
      id,
      nama_kategori,
      jenis,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/categories");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal membuat kategori." };
  }
}

export async function deleteCategoryAction(id: string) {
  try {
    await deleteCategory(id);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/categories");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menghapus kategori." };
  }
}

export async function saveSettingsAction(formData: FormData) {
  try {
    const nama_madrasah = formData.get("nama_madrasah") as string;
    const nama_bendahara = formData.get("nama_bendahara") as string;
    const nama_kepala_madrasah = formData.get("nama_kepala_madrasah") as string;
    const saldo_awal = parseFloat((formData.get("saldo_awal") as string) || "0");

    await updateSettings({
      nama_madrasah,
      nama_bendahara,
      nama_kepala_madrasah,
      saldo_awal,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Gagal menyimpan pengaturan." };
  }
}
