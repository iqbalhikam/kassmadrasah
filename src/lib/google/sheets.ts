import { google } from "googleapis";
import { getGoogleAuthClient } from "./auth";
import { DatabaseData, Transaksi, Kategori, Pengaturan, CashFlowMonthly } from "@/types";

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

const DEFAULT_SETTINGS = ["MA Universal Indonesia", "Bendahara Kas", "Kepala Madrasah", "0"];

export async function getOrInitSpreadsheetId(): Promise<string> {
  const auth = await getGoogleAuthClient();
  const drive = google.drive({ version: "v3", auth });
  const sheets = google.sheets({ version: "v4", auth });

  // 1. Search for existing database file in user's Drive
  const searchRes = await drive.files.list({
    q: `name = '${DB_FILE_NAME}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (searchRes.data.files && searchRes.data.files.length > 0) {
    return searchRes.data.files[0].id!;
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
          range: "Pengaturan!A1:D1",
          values: [["nama_madrasah", "nama_bendahara", "nama_kepala_madrasah", "saldo_awal"]],
        },
        {
          range: "Pengaturan!A2:D2",
          values: [DEFAULT_SETTINGS],
        },
      ],
    },
  });

  return spreadsheetId;
}

export async function getDatabaseData(): Promise<DatabaseData> {
  const auth = await getGoogleAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = await getOrInitSpreadsheetId();

  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId,
    ranges: ["Transaksi!A2:H1000", "Kategori!A2:C100", "Pengaturan!A2:D2"],
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
  })).sort((a: Transaksi, b: Transaksi) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());

  // Parse Pengaturan
  const pengaturanRow = valueRanges[2]?.values?.[0] || DEFAULT_SETTINGS;
  const pengaturan: Pengaturan = {
    nama_madrasah: pengaturanRow[0] || "MA Universal Indonesia",
    nama_bendahara: pengaturanRow[1] || "Bendahara Kas",
    nama_kepala_madrasah: pengaturanRow[2] || "Kepala Madrasah",
    saldo_awal: parseFloat(pengaturanRow[3] || "0") || 0,
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

  return {
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
}

export async function updateSettings(p: Pengaturan): Promise<void> {
  const auth = await getGoogleAuthClient();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = await getOrInitSpreadsheetId();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: "Pengaturan!A2:D2",
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[p.nama_madrasah, p.nama_bendahara, p.nama_kepala_madrasah, p.saldo_awal]],
    },
  });
}

async function getSheetIdByName(spreadsheetId: string, sheetName: string, auth: any): Promise<number> {
  const sheets = google.sheets({ version: "v4", auth });
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = res.data.sheets?.find((s: any) => s.properties?.title === sheetName);
  return sheet?.properties?.sheetId || 0;
}
