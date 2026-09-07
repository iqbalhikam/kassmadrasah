import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { callGemini } from "@/lib/ai/gemini";
import { geminiModelSchema } from "@/lib/validations/ai";
import { DEFAULT_GEMINI_MODEL, GeminiModelOption, Kategori, TransaksiJenis } from "@/types";

interface SuggestRequestBody {
  apiKey: string;
  model?: GeminiModelOption;
  keterangan: string;
  nominal?: number | string;
  currentJenis?: TransaksiJenis;
  categories: Kategori[];
}

export interface AISuggestionResponse {
  isExistingMatch: boolean;
  suggestedKategoriId?: string | null;
  suggestedKategoriNama?: string | null;
  suggestedNewCategory?: string | null;
  suggestedJenis?: TransaksiJenis;
  explanation: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Silakan login terlebih dahulu." }, { status: 401 });
    }

    const body = (await req.json()) as SuggestRequestBody;
    const { apiKey, model, keterangan, nominal, currentJenis, categories } = body;

    if (!apiKey) {
      return NextResponse.json({ error: "API Key Gemini belum diset." }, { status: 400 });
    }

    if (!keterangan || !keterangan.trim()) {
      return NextResponse.json({ error: "Mohon isi keterangan transaksi terlebih dahulu." }, { status: 400 });
    }

    const modelParsed = geminiModelSchema.safeParse(model);
    const activeModel: GeminiModelOption = modelParsed.success ? modelParsed.data : DEFAULT_GEMINI_MODEL;

    // Build category list for AI prompt
    const catList = categories && categories.length > 0
      ? categories
          .map((c) => `- ID: "${c.id}" | Nama: "${c.nama_kategori}" | Pos: ${c.jenis === "MASUK" ? "DEBIT (Pemasukan)" : "KREDIT (Pengeluaran)"}`)
          .join("\n")
      : "(Belum ada kategori yang terdaftar)";

    const prompt = `Kamu adalah asisten AI akuntansi madrasah. Analisis transaksi berikut untuk menentukan KATEGORI kas yang paling tepat.

DAFTAR KATEGORI KAS SAAT INI:
${catList}

INPUT TRANSAKSI:
- Keterangan: "${keterangan.trim()}"
- Jenis saat ini: ${currentJenis || "(belum ditentukan)"}

ATURAN ANALISIS:
1. Periksa apakah ada kategori dalam daftar yang RELEVAN dan COCOK dengan transaksi ini.
2. JIKA ADA KATEGORI YANG COCOK:
   - "isExistingMatch": true
   - "suggestedKategoriId": ID persis dari kategori yang cocok di daftar
   - "suggestedNewCategory": null
   - "suggestedJenis": "DEBIT" (jika uang masuk/penerimaan) atau "KREDIT" (jika uang keluar/belanja/gaji)
   - "explanation": "alasan singkat kenapa kategori ini cocok"
3. JIKA TIDAK ADA KATEGORI YANG COCOK / RELEVAN:
   - "isExistingMatch": false
   - "suggestedKategoriId": null
   - "suggestedNewCategory": "Nama Kategori Baru Yang Standar & Baku" (contoh: "Pemeliharaan Gedung", "Biaya Konsumsi", "Penyelenggaraan Ujian", "Honorarium Pelatih Ekstrakurikuler", "Wirausaha Madrasah", dll.)
   - "suggestedJenis": "DEBIT" atau "KREDIT"
   - "explanation": "alasan singkat kenapa pos ini belum ada dan saran kategori barunya"

BALAS HANYA DENGAN SATU RAW JSON OBJECT VALID, TANPA MARKDOWN FENCE, TANPA KATA-KATA LAIN:
{"isExistingMatch":true,"suggestedKategoriId":"ID","suggestedNewCategory":null,"suggestedJenis":"DEBIT","explanation":"alasan"}`;

    const text = await callGemini(apiKey, activeModel, [{ text: prompt }]);

    let parsed: AISuggestionResponse;
    try {
      // Strip markdown code fences if Gemini wraps response in ```json ... ```
      let clean = text
        .replace(/```(?:json)?\s*/gi, "")   // opening fence
        .replace(/```\s*$/g, "")             // closing fence
        .replace(/[\u0000-\u001F\u007F]/g, (c) => c === "\n" || c === "\r" || c === "\t" ? c : "") // stray control chars
        .trim();

      // Extract first JSON object
      const jsonMatch = clean.match(/\{[\s\S]*\}/);
      clean = jsonMatch ? jsonMatch[0] : clean;

      // Remove trailing commas before } or ]
      clean = clean.replace(/,\s*([}\]])/g, "$1");

      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        isExistingMatch: false,
        explanation: "Analisis kategori otomatis selesai.",
      };
    }

    // Validate and clean up match
    if (parsed.isExistingMatch && parsed.suggestedKategoriId) {
      const match = categories.find((c) => c.id === parsed.suggestedKategoriId);
      if (match) {
        parsed.suggestedKategoriNama = match.nama_kategori;
      } else {
        // ID didn't match real list, treat as suggestion for new or fallback
        parsed.isExistingMatch = false;
        if (!parsed.suggestedNewCategory && parsed.suggestedKategoriId) {
          parsed.suggestedNewCategory = parsed.suggestedKategoriId;
        }
        delete parsed.suggestedKategoriId;
      }
    }

    return NextResponse.json({ success: true, suggestion: parsed, modelUsed: activeModel });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal memproses saran AI.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
