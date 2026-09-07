import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { callGemini } from "@/lib/ai/gemini";
import { geminiModelSchema } from "@/lib/validations/ai";
import { DEFAULT_GEMINI_MODEL, GeminiModelOption, KasSummary, Transaksi } from "@/types";

import { updateAIAnalysisCache } from "@/lib/google/sheets";

interface CategorySpendingItem {
  nama: string;
  total: number;
}

interface AnalyzeRequestBody {
  apiKey: string;
  model?: GeminiModelOption;
  summary: KasSummary;
  recentTransactions: Transaksi[];
  kategoris: CategorySpendingItem[];
  dataHash?: string;
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized: Silakan login terlebih dahulu." }, { status: 401 });
    }

    const body = (await req.json()) as AnalyzeRequestBody;
    const { apiKey, model, summary, recentTransactions, kategoris, dataHash } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key Gemini belum diset. Silakan atur di halaman Pengaturan." },
        { status: 400 }
      );
    }

    // Validate model option safely via Zod, fallback to DEFAULT_GEMINI_MODEL
    const modelParsed = geminiModelSchema.safeParse(model);
    const activeModel: GeminiModelOption = modelParsed.success ? modelParsed.data : DEFAULT_GEMINI_MODEL;

    const topKategoriText =
      kategoris?.slice(0, 5).map((k) => `- ${k.nama}: Rp ${(k.total || 0).toLocaleString("id-ID")}`).join("\n") ||
      "Tidak ada data";

    const recentTxText =
      recentTransactions?.slice(0, 5)
        .map((t) => `- [${t.jenis}] ${t.keterangan}: Rp ${(t.nominal || 0).toLocaleString("id-ID")} (${t.tanggal})`)
        .join("\n") || "Tidak ada data";

    const prompt = `Kamu adalah asisten keuangan madrasah. Analisis data keuangan berikut dan berikan insight singkat dalam Bahasa Indonesia.

DATA KEUANGAN:
- Saldo Awal: Rp ${(summary?.saldoAwal || 0).toLocaleString("id-ID")}
- Total Pemasukan: Rp ${(summary?.totalDebit || 0).toLocaleString("id-ID")}
- Total Pengeluaran: Rp ${(summary?.totalKredit || 0).toLocaleString("id-ID")}
- Saldo Akhir: Rp ${(summary?.saldoAkhir || 0).toLocaleString("id-ID")}
- Total Transaksi: ${summary?.totalTransaksi || 0}

TOP KATEGORI PENGELUARAN:
${topKategoriText}

TRANSAKSI TERBARU:
${recentTxText}

Kembalikan HANYA JSON object murni valid tanpa markdown fence dengan format:
{
  "insight": "Ringkasan evaluasi kondisi kesehatan kas saat ini (2-3 kalimat lugas)",
  "trend": "Tren perputaran kas dan pola pengeluaran/pemasukan (1-2 kalimat)",
  "rekomendasi": ["Saran praktis 1", "Saran praktis 2", "Saran praktis 3"],
  "kesimpulan": "1 kalimat kesimpulan akhir evaluasi kas madrasah"
}`;

    const text = await callGemini(
      apiKey,
      activeModel,
      [{ text: prompt }],
      "Kamu adalah auditor & penasihat keuangan madrasah yang selalu merespons HANYA dalam format JSON valid.",
      { jsonMode: true, maxOutputTokens: 2048 }
    );

    let cleanText = text
      .replace(/```(?:json)?\s*/gi, "")
      .replace(/```\s*$/g, "")
      .replace(/[\u0000-\u001F\u007F]/g, (c) => c === "\n" || c === "\r" || c === "\t" ? c : "")
      .trim();

    let parsed = {
      insight: "",
      trend: "",
      rekomendasi: [] as string[],
      kesimpulan: "",
    };

    try {
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : cleanText;
      const cleanJsonStr = jsonStr.replace(/,\s*([}\]])/g, "$1");
      const obj = JSON.parse(cleanJsonStr);

      parsed = {
        insight: typeof obj.insight === "string" ? obj.insight : "",
        trend: typeof obj.trend === "string" ? obj.trend : "",
        rekomendasi: Array.isArray(obj.rekomendasi)
          ? obj.rekomendasi.filter((r: any) => typeof r === "string" && r.trim().length > 0)
          : [],
        kesimpulan: typeof obj.kesimpulan === "string" ? obj.kesimpulan : "",
      };
    } catch {
      // Regex extraction fallback if JSON parser fails or text was slightly cut off
      const insightMatch = cleanText.match(/"insight"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
      const trendMatch = cleanText.match(/"trend"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
      const kesimpulanMatch = cleanText.match(/"kesimpulan"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);

      parsed.insight = insightMatch
        ? insightMatch[1].replace(/\\"/g, '"')
        : "Kondisi keuangan kas madrasah terpantau aktif dengan saldo berjalan tercatat di sistem.";
      parsed.trend = trendMatch ? trendMatch[1].replace(/\\"/g, '"') : "";
      parsed.kesimpulan = kesimpulanMatch ? kesimpulanMatch[1].replace(/\\"/g, '"') : "";
      if (parsed.rekomendasi.length === 0) {
        parsed.rekomendasi = [
          "Tertibkan pencatatan nota dan kuitansi setiap transaksi kas.",
          "Evaluasi pengeluaran operasional secara berkala setiap akhir pekan.",
        ];
      }
    }

    // Defensive cleanup: Pastikan tidak ada kutipan JSON mentah yang lolos
    if (parsed.insight.includes('"insight":') || parsed.insight.startsWith("{")) {
      const match = parsed.insight.match(/"insight"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/);
      if (match && match[1]) {
        parsed.insight = match[1].replace(/\\"/g, '"');
      } else {
        parsed.insight = parsed.insight.replace(/^[{\s]*"insight"\s*:\s*"?/i, "").replace(/"?\s*,?\s*"trend"[\s\S]*$/i, "").trim();
      }
    }
    parsed.insight = parsed.insight.replace(/^["']|["']$/g, "").trim();
    parsed.trend = parsed.trend.replace(/^["']|["']$/g, "").trim();
    parsed.kesimpulan = parsed.kesimpulan.replace(/^["']|["']$/g, "").trim();

    const updatedAt = new Date().toISOString();

    // Persist result and data hash into database
    if (dataHash) {
      try {
        await updateAIAnalysisCache(JSON.stringify(parsed), dataHash, updatedAt);
      } catch (saveErr) {
        console.error("Gagal menyimpan cache analisis ke Google Sheets:", saveErr);
      }
    }

    return NextResponse.json({
      success: true,
      result: parsed,
      modelUsed: activeModel,
      dataHash,
      updatedAt,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Gagal menganalisis data.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
