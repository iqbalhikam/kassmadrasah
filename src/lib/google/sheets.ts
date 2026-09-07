import { google } from "googleapis";
import { getGoogleAuthClient } from "./auth";
import { DatabaseData, Transaksi, Kategori, Pengaturan, CashFlowMonthly, GeminiModelOption, DEFAULT_GEMINI_MODEL } from "@/types";
import { generateId } from "@/lib/utils";

const DB_FILE_NAME = "[DB] Kas Madrasah System";

const DEFAULT_CATEGORIES: Array<[string, string, string]> = [
  ["CAT-SPP", "SPP / Uang Sekolah", "MASUK"],
  ["CAT-BOS", "Dana BOS", "MASUK"],
  ["CAT-INFAQ", "Infaq / Sedekah / Hibah", "MASUK"],
  ["CAT-LAIN-IN", "Penerimaan Lainnya", "MASUK"],
  ["CAT-GAJI", "Gaji & Honorarium Guru/Staf", "KELUAR"],
  ["CAT-ATK", "Operasional & ATK", "KELUAR"],
  ["CAT-SARPRAS", "Pemeliharaan Gedung & Sarpras", "KELUAR"],
  ["CAT-KEGIATAN", "Kegiatan Kesiswaan & PHBI", "KELUAR"],
  ["CAT-LAIN-OUT", "Pengeluaran Lainnya", "KELUAR"],
];

const DEFAULT_SETTINGS = ["MA Universal Indonesia", "Bendahara", "Kepala Madrasah", "0", "", "gemini-3.7-flash"];

// In-memory cache for user's spreadsheet ID (1 hour TTL) - avoids slow Drive file search
const spreadsheetIdCache = new Map<string, { id: string; timestamp: number }>();

// In-memory cache for user's DatabaseData (30s TTL) - gives instant SSR and sub-page navigations
const databaseCache = new Map<string, { data: DatabaseData; timestamp: number }>();

export function invalidateDatabaseCache(userEmail?: string) {
  if (userEmail) {
    databaseCache.delete(userEmail);
  } else {
    databaseCache.clear();
  }
}

export async function getOrInitSpreadsheetId(): Promise<string> {
  const auth = await getGoogleAuthClient();
  const userEmail = auth.userEmail || "default";

  // Check cache first (1 hour TTL)
  const cached = spreadsheetIdCache.get(userEmail);
  if (cached && Date.now() - cached.timestamp < 3600_000) {
    return cached.id;
  }

  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });

  // 1. Search for existing database file in user's Drive
  const searchRes = await drive.files.list({
    q: `name = '${DB_FILE_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (searchRes.data.files && searchRes.data.files.length > 0) {
    const foundId = searchRes.data.files[0].id!;
    spreadsheetIdCache.set(userEmail, { id: foundId, timestamp: Date.now() });
    return foundId;
  }

  // 2. If not found, create new Spreadsheet
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: DB_FILE_NAME,
      },
      sheets: [
        { properties: { title: "Transaksi" } },
        { properties: { title: "Kategori" } },
        { properties: { title: "Pengaturan" } },
      ],
    },
  });

  const spreadsheetId = createRes.data.spreadsheetId!;

  // 3. Populate headers and default data
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: [
        {
          range: "Transaksi!A1:H1",
          values: [["id", "tanggal", "kategori_id", "keterangan", "jenis", "nominal", "bukti_url", "created_at"]],
        },
        {
          range: "Kategori!A1:C1",
          values: [["id", "nama_kategori", "jenis"]],
        },
        {
          range: "Kategori!A2:C10",
          values: DEFAULT_CATEGORIES,
        },
        {
          range: "Pengaturan!A1:F1",
          values: [["nama_madrasah", "nama_bendahara", "nama_kepala_madrasah", "saldo_awal", "gemini_api_key", "gemini_model"]],
        },
        {
          range: "Pengaturan!A2:F2",
          values: [DEFAULT_SETTINGS],
        },
      ],
    },
  });

  spreadsheetIdCache.set(userEmail, { id: spreadsheetId, timestamp: Date.now() });
  return spreadsheetId;
}

export async function getDatabaseData(forceRefresh = false): Promise<DatabaseData> {
  const auth = await getGoogleAuthClient();
  const userEmail = auth.userEmail || "default";

  // If not forcing refresh, check 30-second memory cache
  if (!forceRefresh) {
    const cached = databaseCache.get(userEmail);
    if (cached && Date.now() - cached.timestamp < 30_000) {
      return cached.data;
    }
  }

  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = await getOrInitSpreadsheetId();

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: ["Transaksi!A2:H1000", "Kategori!A2:C100", "Pengaturan!A2:I2"],
  });

  const valueRanges = response.data.valueRanges || [];

  // Parse Kategori
  const kategoriRows = valueRanges[1]?.values || [];
  const kategoriMap = new Map<string, string>();
  const kategori: Kategori[] = kategoriRows.map((row: string[]) => {
    const id = row[0] || "";
    const nama = row[1] || "";
    kategoriMap.set(id, nama);
    return {
      id,
      nama_kategori: nama,
      jenis: (row[2] as any) || "MASUK",
    };
  });

  // Parse Transaksi
  const transaksiRows = valueRanges[0]?.values || [];
  const transaksi: Transaksi[] = transaksiRows.map((row: string[]) => ({
    id: row[0] || "",
    tanggal: row[1] || "",
    kategori_id: row[2] || "",
    kategori_nama: kategoriMap.get(row[2]) || row[2] || "Lainnya",
    keterangan: row[3] || "",
    jenis: (row[4] as any) || "DEBIT",
    nominal: parseFloat(row[5] || "0") || 0,
    bukti_url: row[6] || "",
    created_at: row[7] || "",
  })).sort((a: Transaksi, b: Transaksi) => {
    const dateA = new Date(a.tanggal).getTime();
    const dateB = new Date(b.tanggal).getTime();
    if (dateA !== dateB) return dateB - dateA;
    // Tiebreaker: created_at untuk presisi detik jika tanggal sama
    const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return createdB - createdA;
  });

  // Parse Pengaturan
  const pengaturanRow = valueRanges[2]?.values?.[0] || DEFAULT_SETTINGS;
  const rawModel = pengaturanRow[5];
  const validModels: GeminiModelOption[] = [
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-pro-preview",
    "gemini-2.5-flash",
  ];
  const gemini_model: GeminiModelOption = validModels.includes(rawModel as GeminiModelOption)
    ? (rawModel as GeminiModelOption)
    : DEFAULT_GEMINI_MODEL;

  const pengaturan: Pengaturan = {
    nama_madrasah: pengaturanRow[0] || "MA Universal Indonesia",
    nama_bendahara: pengaturanRow[1] || "Bendahara",
    nama_kepala_madrasah: pengaturanRow[2] || "Kepala Madrasah",
    saldo_awal: parseFloat(pengaturanRow[3] || "0") || 0,
    gemini_api_key: pengaturanRow[4] || "",
    gemini_model,
    ai_analysis_result: pengaturanRow[6] || "",
    ai_analysis_hash: pengaturanRow[7] || "",
    ai_analysis_updated_at: pengaturanRow[8] || "",
  };

  // Calculate Summary
  let totalDebit = 0;
  let totalKredit = 0;

  transaksi.forEach((t) => {
    if (t.jenis === "DEBIT") {
      totalDebit += t.nominal;
    } else {
      totalKredit += t.nominal;
    }
  });

  const saldoAkhir = pengaturan.saldo_awal + totalDebit - totalKredit;

  // Monthly Cash Flow data for Chart
  const monthsMap = new Map<string, { debit: number; kredit: number }>();
  const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  
  // Initialize last 6 months or current year
  const currentYear = new Date().getFullYear();
  months.forEach((m) => monthsMap.set(m, { debit: 0, kredit: 0 }));

  transaksi.forEach((t) => {
    if (!t.tanggal) return;
    const date = new Date(t.tanggal);
    if (date.getFullYear() === currentYear) {
      const monthName = months[date.getMonth()];
      const current = monthsMap.get(monthName) || { debit: 0, kredit: 0 };
      if (t.jenis === "DEBIT") {
        current.debit += t.nominal;
      } else {
        current.kredit += t.nominal;
      }
      monthsMap.set(monthName, current);
    }
  });

  const cashflow: CashFlowMonthly[] = Array.from(monthsMap.entries()).map(([bulan, val]) => ({
    bulan,
    debit: val.debit,
    kredit: val.kredit,
  }));

  const result: DatabaseData = {
    transaksi,
    kategori,
    pengaturan,
    summary: {
      totalDebit,
      totalKredit,
      saldoAwal: pengaturan.saldo_awal,
      saldoAkhir,
      totalTransaksi: transaksi.length,
    },
    cashflow,
  };

  databaseCache.set(userEmail, { data: result, timestamp: Date.now() });
  return result;
}

export async function addTransaction(t: Omit<Transaksi, "created_at">): Promise<void> {
  const auth = await getGoogleAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = await getOrInitSpreadsheetId();

  const createdAt = new Date().toISOString();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Transaksi!A:H",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[t.id, t.tanggal, t.kategori_id, t.keterangan, t.jenis, t.nominal, t.bukti_url || "", createdAt]],
    },
  });

  invalidateDatabaseCache(auth.userEmail);
}

export async function updateTransaction(t: Omit<Transaksi, "created_at"> & { created_at?: string }): Promise<void> {
  const auth = await getGoogleAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = await getOrInitSpreadsheetId();

  // Read all transaction rows to find matching row index by ID
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Transaksi!A:H",
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === t.id);

  if (rowIndex === -1) {
    throw new Error(`Transaksi ID ${t.id} tidak ditemukan.`);
  }

  const existingRow = rows[rowIndex];
  const createdAt = existingRow[7] || new Date().toISOString();

  // Sheet row is 1-based (rowIndex 0 is header row 1)
  const sheetRow = rowIndex + 1;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `Transaksi!A${sheetRow}:H${sheetRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[t.id, t.tanggal, t.kategori_id, t.keterangan, t.jenis, t.nominal, t.bukti_url || "", createdAt]],
    },
  });

  invalidateDatabaseCache(auth.userEmail);
}

export async function deleteTransaction(id: string): Promise<void> {
  const auth = await getGoogleAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = await getOrInitSpreadsheetId();

  // Read all transaction IDs to find matching row index
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Transaksi!A:A",
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === id);

  if (rowIndex === -1) {
    throw new Error("Transaksi tidak ditemukan.");
  }

  // Row index in Sheets is 1-based, sheet header is row 1
  const sheetId = await getSheetIdByName(spreadsheetId, "Transaksi", auth);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });

  invalidateDatabaseCache(auth.userEmail);
}

export async function addCategory(k: Kategori): Promise<void> {
  const auth = await getGoogleAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = await getOrInitSpreadsheetId();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: "Kategori!A:C",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[k.id, k.nama_kategori, k.jenis]],
    },
  });

  invalidateDatabaseCache(auth.userEmail);
}

export async function deleteCategory(id: string): Promise<void> {
  const auth = await getGoogleAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = await getOrInitSpreadsheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Kategori!A:A",
  });

  const rows = res.data.values || [];
  const rowIndex = rows.findIndex((row: any[]) => row[0] === id);

  if (rowIndex === -1) {
    throw new Error("Kategori tidak ditemukan.");
  }

  const sheetId = await getSheetIdByName(spreadsheetId, "Kategori", auth);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex: rowIndex,
              endIndex: rowIndex + 1,
            },
          },
        },
      ],
    },
  });

  invalidateDatabaseCache(auth.userEmail);
}

export async function updateSettings(p: Pengaturan): Promise<void> {
  const auth = await getGoogleAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = await getOrInitSpreadsheetId();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Pengaturan!A2:F2",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[
        p.nama_madrasah,
        p.nama_bendahara,
        p.nama_kepala_madrasah,
        p.saldo_awal,
        p.gemini_api_key || "",
        p.gemini_model || DEFAULT_GEMINI_MODEL,
      ]],
    },
  });

  invalidateDatabaseCache(auth.userEmail);
}

export async function updateGeminiAiSettings(apiKey: string, model: GeminiModelOption): Promise<void> {
  const auth = await getGoogleAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = await getOrInitSpreadsheetId();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Pengaturan!E2:F2",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[apiKey, model]],
    },
  });

  invalidateDatabaseCache(auth.userEmail);
}

export async function updateAIAnalysisCache(
  resultJson: string,
  hash: string,
  updatedAt: string
): Promise<void> {
  const auth = await getGoogleAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = await getOrInitSpreadsheetId();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Pengaturan!G2:I2",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[resultJson, hash, updatedAt]],
    },
  });

  invalidateDatabaseCache(auth.userEmail);
}

export async function updateGeminiApiKey(apiKey: string): Promise<void> {
  const auth = await getGoogleAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = await getOrInitSpreadsheetId();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Pengaturan!E2",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[apiKey]],
    },
  });

  invalidateDatabaseCache(auth.userEmail);
}

export async function getGeminiApiKey(): Promise<string> {
  const auth = await getGoogleAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = await getOrInitSpreadsheetId();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "Pengaturan!E2",
  });

  return res.data.values?.[0]?.[0] || "";
}

export async function importBackupFromSpreadsheet(sourceSpreadsheetId: string): Promise<{
  transactionsCount: number;
  categoriesCount: number;
  settingsUpdated: boolean;
}> {
  const auth = await getGoogleAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const targetSpreadsheetId = await getOrInitSpreadsheetId();

  // 1. Fetch metadata to inspect available tabs
  let spreadsheetInfo;
  try {
    spreadsheetInfo = await sheets.spreadsheets.get({ spreadsheetId: sourceSpreadsheetId });
  } catch (err: any) {
    throw new Error("Gagal membaca Google Sheet sumber. Pastikan ID/URL benar dan izin akses sudah publik/diberikan (Siapa saja yang memiliki link).");
  }

  const sheetTabs = spreadsheetInfo.data.sheets || [];
  const tabNames = sheetTabs.map((s: any) => s.properties?.title || "");

  if (tabNames.length === 0) {
    throw new Error("Google Sheet sumber tidak memiliki lembar kerja (sheet).");
  }

  let finalTransaksiRows: any[][] = [];
  let finalKategoriRows: any[][] = [];
  let finalPengaturanRow: any[] | null = null;

  const hasStandardTransaksi = tabNames.includes("Transaksi");
  const hasStandardKategori = tabNames.includes("Kategori");

  if (hasStandardTransaksi || hasStandardKategori) {
    // === Case A: Standard System Backup Format ===
    const rangesToFetch: string[] = [];
    if (hasStandardTransaksi) rangesToFetch.push("Transaksi!A2:H2000");
    if (hasStandardKategori) rangesToFetch.push("Kategori!A2:C200");
    if (tabNames.includes("Pengaturan")) rangesToFetch.push("Pengaturan!A2:D2");

    const batchRes = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: sourceSpreadsheetId,
      ranges: rangesToFetch,
    });

    const valueRanges = batchRes.data.valueRanges || [];
    let rangeIdx = 0;
    if (hasStandardTransaksi) {
      finalTransaksiRows = valueRanges[rangeIdx++]?.values || [];
    }
    if (hasStandardKategori) {
      finalKategoriRows = valueRanges[rangeIdx++]?.values || [];
    }
    if (tabNames.includes("Pengaturan")) {
      finalPengaturanRow = valueRanges[rangeIdx++]?.values?.[0] || null;
    }
  } else {
    // === Case B: Custom/Legacy Google Sheet Format (e.g. Sheet1 with TGL, Keterangan, Debit, Kredit, ID) ===
    const firstTabName = tabNames[0];
    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sourceSpreadsheetId,
      range: `'${firstTabName}'!A1:Z3000`,
    });

    const allRows = sheetRes.data.values || [];
    if (allRows.length > 1) {
      const headerRow = allRows[0].map((h: any) => String(h || "").toLowerCase().trim());

      // Auto-detect column indices by header text
      const tglCol = headerRow.findIndex((h: string) => /tgl|tanggal|date/.test(h));
      const ketCol = headerRow.findIndex((h: string) => /keterangan|ket|description|uraian/.test(h));
      const debitCol = headerRow.findIndex((h: string) => /debit|pemasukan|masuk/.test(h));
      const kreditCol = headerRow.findIndex((h: string) => /kredit|pengeluaran|keluar/.test(h));
      const idCol = headerRow.findIndex((h: string) => /id|kode|no/.test(h));

      const createdAt = new Date().toISOString();

      for (let i = 1; i < allRows.length; i++) {
        const row = allRows[i];
        if (!row || row.length === 0) continue;

        const rawDate = tglCol !== -1 ? row[tglCol] : "";
        const keterangan = ketCol !== -1 ? (row[ketCol] || "") : "Transaksi Impor";
        const rawDebit = debitCol !== -1 ? parseCleanNumber(row[debitCol]) : 0;
        const rawKredit = kreditCol !== -1 ? parseCleanNumber(row[kreditCol]) : 0;

        // Skip rows with no date and zero nominals
        if (!rawDate && rawDebit === 0 && rawKredit === 0) continue;

        const tanggal = parseCleanDate(rawDate);
        const jenis = rawDebit > 0 ? "DEBIT" : "KREDIT";
        const nominal = rawDebit > 0 ? rawDebit : rawKredit;
        const kategori_id = jenis === "DEBIT" ? "CAT-LAIN-IN" : "CAT-LAIN-OUT";
        const txId = idCol !== -1 && row[idCol] ? String(row[idCol]).trim() : generateId("TX");

        finalTransaksiRows.push([
          txId,
          tanggal,
          kategori_id,
          keterangan,
          jenis,
          nominal,
          "",
          createdAt,
        ]);
      }
    }
  }

  // 2. Clear target ranges in active database before updating
  await sheets.spreadsheets.values.clear({
    spreadsheetId: targetSpreadsheetId,
    range: "Transaksi!A2:H3000",
  });

  if (finalKategoriRows.length > 0) {
    await sheets.spreadsheets.values.clear({
      spreadsheetId: targetSpreadsheetId,
      range: "Kategori!A2:C200",
    });
  }

  // 3. Write imported data into active target database
  if (finalTransaksiRows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: targetSpreadsheetId,
      range: `Transaksi!A2:H${1 + finalTransaksiRows.length}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: finalTransaksiRows,
      },
    });
  }

  if (finalKategoriRows.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: targetSpreadsheetId,
      range: `Kategori!A2:C${1 + finalKategoriRows.length}`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: finalKategoriRows,
      },
    });
  }

  let settingsUpdated = false;
  if (finalPengaturanRow && finalPengaturanRow.length >= 4) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: targetSpreadsheetId,
      range: "Pengaturan!A2:D2",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [finalPengaturanRow],
      },
    });
    settingsUpdated = true;
  }

  invalidateDatabaseCache(auth.userEmail);

  return {
    transactionsCount: finalTransaksiRows.length,
    categoriesCount: finalKategoriRows.length,
    settingsUpdated,
  };
}

function parseCleanNumber(val: any): number {
  if (!val) return 0;
  if (typeof val === "number") return val;
  const str = String(val).replace(/[^0-9.-]/g, "");
  return parseFloat(str) || 0;
}

function parseCleanDate(dateStr: any): string {
  if (!dateStr) return new Date().toISOString().split("T")[0];
  const trimmed = String(dateStr).trim();
  if (!trimmed) return new Date().toISOString().split("T")[0];

  // DD/MM/YYYY or DD-MM-YYYY (e.g. 30/01/2024 -> 2024-01-30)
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD or YYYY/MM/DD
  const yyyymmdd = trimmed.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const month = yyyymmdd[2].padStart(2, "0");
    const day = yyyymmdd[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  } catch {}

  return new Date().toISOString().split("T")[0];
}

async function getSheetIdByName(spreadsheetId: string, sheetName: string, auth: any): Promise<number> {
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = res.data.sheets?.find((s: any) => s.properties?.title === sheetName);
  return sheet?.properties?.sheetId || 0;
}
