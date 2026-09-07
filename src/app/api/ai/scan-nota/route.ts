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

    // Validate model option safely via Zod, fallback to DEFAULT_GEMINI_MODEL
    const modelParsed = geminiModelSchema.safeParse(model);
    const activeModel: GeminiModelOption = modelParsed.success ? modelParsed.data : DEFAULT_GEMINI_MODEL;

    const prompt = `Kamu adalah asisten OCR untuk nota/kuitansi keuangan madrasah. Baca gambar nota/kuitansi/struk ini dan ekstrak informasinya.

Kembalikan HANYA JSON (tanpa markdown) dengan format:
{"nominal":angka_tanpa_titik_koma,"keterangan":"deskripsi singkat transaksi","tanggal":"YYYY-MM-DD atau kosong jika tidak ada","jenis":"DEBIT atau KREDIT"}

Aturan:
- nominal: angka saja, tanpa Rp, titik, atau koma
- keterangan: ringkasan singkat isi nota (maks 80 karakter)
- tanggal: format YYYY-MM-DD, kosongkan jika tidak terdeteksi
- jenis: KREDIT (pengeluaran/pembelian) atau DEBIT (penerimaan/pembayaran masuk)
- Jika tidak bisa membaca, kembalikan: {"error":"Tidak dapat membaca nota"}`;

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
