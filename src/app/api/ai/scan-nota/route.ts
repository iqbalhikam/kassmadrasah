import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { callGemini } from "@/lib/ai/gemini";
import { geminiModelSchema } from "@/lib/validations/ai";
import { DEFAULT_GEMINI_MODEL, GeminiModelOption, ScanNotaResult } from "@/types";

interface ScanNotaRequestBody {
  apiKey: string;
  imageBase64: string;
  mimeType?: string;
  model?: GeminiModelOption;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Silakan login terlebih dahulu." }, { status: 401 });
    }

    const body = (await req.json()) as ScanNotaRequestBody;
    const { apiKey, imageBase64, mimeType = "image/jpeg", model } = body;

    if (!apiKey) {
      return NextResponse.json({ error: "API Key Gemini belum diset. Silakan atur di Pengaturan." }, { status: 400 });
    }
    if (!imageBase64) {
      return NextResponse.json({ error: "Gambar nota tidak ditemukan." }, { status: 400 });
    }

    const modelParsed = geminiModelSchema.safeParse(model);
    const activeModel: GeminiModelOption = modelParsed.success ? modelParsed.data : DEFAULT_GEMINI_MODEL;

    const prompt = `Kamu adalah asisten OCR untuk nota/kuitansi keuangan madrasah. Baca gambar nota/kuitansi/struk ini dan ekstrak SEMUA item transaksi yang ada.

Kembalikan HANYA JSON (tanpa markdown, tanpa penjelasan) dengan format persis:
{
  "tanggal": "YYYY-MM-DD atau string kosong jika tidak ada",
  "jenis": "DEBIT atau KREDIT",
  "items": [
    {"keterangan": "nama/deskripsi item", "nominal": 50000, "jenis": "KREDIT"},
    {"keterangan": "nama/deskripsi item 2", "nominal": 25000, "jenis": "KREDIT"}
  ],
  "nominal_total": 75000,
  "keterangan": "ringkasan singkat keseluruhan nota maksimal 80 karakter"
}

Aturan penting:
- Ekstrak SETIAP baris item yang ada di nota (nama barang, harga satuan x qty, subtotal dsb.)
- nominal: angka integer saja, TANPA Rp, titik, atau koma desimal
- Jika nota hanya 1 item atau tidak ada rincian, tetap gunakan format items (array 1 elemen)
- tanggal: format YYYY-MM-DD, string kosong jika tidak terdeteksi
- jenis KREDIT = pengeluaran/pembelian/keluar, DEBIT = penerimaan/pemasukan/masuk
- Jika gambar tidak terbaca atau bukan nota: {"error": "Tidak dapat membaca nota", "items": [], "nominal_total": 0, "keterangan": "", "tanggal": "", "jenis": "KREDIT"}`;

    const text = await callGemini(apiKey, activeModel, [
      { text: prompt },
      { inlineData: { mimeType, data: imageBase64 } },
    ]);

    let parsed: ScanNotaResult;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch {
      parsed = { error: "Gagal memproses hasil scan dari AI." };
    }

    return NextResponse.json({ success: true, result: parsed, modelUsed: activeModel });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memproses gambar.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}