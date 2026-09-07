"use server";

import { revalidatePath } from "next/cache";
import {
  getDatabaseData,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  addCategory,
  deleteCategory,
  updateSettings,
  importBackupFromSpreadsheet,
  updateGeminiApiKey,
  updateGeminiAiSettings,
  getGeminiApiKey,
} from "@/lib/google/sheets";
import {  Kategori } from "@/types";
import { generateId, extractSpreadsheetId } from "@/lib/utils";
import { aiSettingsSchema } from "@/lib/validations/ai";

export async function fetchDatabaseAction(forceRefresh = false) {
  try {
    const data = await getDatabaseData(forceRefresh);
    revalidatePath("/dashboard");
    revalidatePath("/report");
    revalidatePath("/dashboard/categories");
    revalidatePath("/dashboard/settings");
    return { success: true, data };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal mengambil data dari Google Sheets.";
    return { success: false, error: errorMessage };
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
    revalidatePath("/report");
    return { success: true, id };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal menambahkan transaksi.";
    return { success: false, error: errorMessage };
  }
}

export async function updateTransactionAction(id: string, formData: FormData) {
  try {
    const tanggal = formData.get("tanggal") as string;
    const kategori_id = formData.get("kategori_id") as string;
    const keterangan = formData.get("keterangan") as string;
    const jenis = formData.get("jenis") as "DEBIT" | "KREDIT";
    const nominal = parseFloat((formData.get("nominal") as string) || "0");
    const bukti_url = (formData.get("bukti_url") as string) || "";

    if (!id || !tanggal || !kategori_id || !keterangan || !nominal) {
      throw new Error("Mohon lengkapi semua kolom yang wajib diisi.");
    }

    await updateTransaction({
      id,
      tanggal,
      kategori_id,
      keterangan,
      jenis,
      nominal,
      bukti_url,
    });

    revalidatePath("/dashboard");
    revalidatePath("/report");
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal memperbarui transaksi.";
    return { success: false, error: errorMessage };
  }
}

export async function deleteTransactionAction(id: string) {
  try {
    await deleteTransaction(id);
    revalidatePath("/dashboard");
    revalidatePath("/report");
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal menghapus transaksi.";
    return { success: false, error: errorMessage };
  }
}

export async function createCategoryAction(formData: FormData) {
  try {
    const nama_kategori = formData.get("nama_kategori") as string;
    const jenis = formData.get("jenis") as "MASUK" | "KELUAR";

    if (!nama_kategori || !nama_kategori.trim()) {
      throw new Error("Nama kategori harus diisi.");
    }

    const id = generateId("CAT");
    const newCategory: Kategori = {
      id,
      nama_kategori: nama_kategori.trim(),
      jenis,
    };

    await addCategory(newCategory);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/categories");
    return { success: true, id, category: newCategory };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal membuat kategori.";
    return { success: false, error: errorMessage };
  }
}

export async function deleteCategoryAction(id: string) {
  try {
    await deleteCategory(id);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/categories");
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal menghapus kategori.";
    return { success: false, error: errorMessage };
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
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal menyimpan pengaturan.";
    return { success: false, error: errorMessage };
  }
}

export async function restoreBackupAction(sheetUrl: string) {
  try {
    const spreadsheetId = extractSpreadsheetId(sheetUrl);

    if (!spreadsheetId) {
      throw new Error("URL atau ID Google Sheets tidak valid. Contoh valid: https://docs.google.com/spreadsheets/d/1BxiMVs.../edit");
    }

    const result = await importBackupFromSpreadsheet(spreadsheetId);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/categories");
    revalidatePath("/dashboard/settings");

    return {
      success: true,
      report: result,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal melakukan impor/restore backup dari Google Sheets.";
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function saveGeminiAiSettingsAction(apiKey: string, model: string) {
  try {
    const validated = aiSettingsSchema.parse({ apiKey, model });
    await updateGeminiAiSettings(validated.apiKey, validated.model);
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/settings");
    return { success: true, model: validated.model };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal menyimpan Pengaturan Gemini AI.";
    return { success: false, error: errorMessage };
  }
}

export async function saveGeminiApiKeyAction(apiKey: string) {
  try {
    await updateGeminiApiKey(apiKey);
    revalidatePath("/dashboard/settings");
    return { success: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal menyimpan Gemini API Key.";
    return { success: false, error: errorMessage };
  }
}

export async function getGeminiApiKeyAction() {
  try {
    const apiKey = await getGeminiApiKey();
    return { success: true, apiKey };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Gagal mengambil Gemini API Key.";
    return { success: false, error: errorMessage, apiKey: "" };
  }
}
