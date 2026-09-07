"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Sparkles, Loader2, AlertCircle, ChevronDown, ChevronUp, TrendingUp, Lightbulb, Target, CheckCircle2, RefreshCw, Database } from "lucide-react";
import { DatabaseData, AIAnalysisResult, GeminiModelOption } from "@/types";
import Link from "next/link";

interface AIAnalyzerProps {
  dbData: DatabaseData;
  apiKey: string;
  model?: GeminiModelOption;
}

/** Menghasilkan fingerprint unik dari kondisi data keuangan di database */
function computeDataFingerprint(dbData: DatabaseData): string {
  const txCount = dbData.transaksi.length;
  const latestTx = dbData.transaksi[0];
  const txPart = `${txCount}_${latestTx ? `${latestTx.id}_${latestTx.tanggal}_${latestTx.nominal}` : "empty"}`;
  const sumPart = `${dbData.summary.totalDebit}_${dbData.summary.totalKredit}_${dbData.summary.saldoAkhir}_${dbData.pengaturan.saldo_awal}`;
  return `${txPart}|${sumPart}`;
}

function sanitizeAnalysisResult(raw: any): AIAnalysisResult {
  if (!raw) {
    return { insight: "", trend: "", rekomendasi: [], kesimpulan: "" };
  }

  let insight = typeof raw.insight === "string" ? raw.insight : "";
  let trend = typeof raw.trend === "string" ? raw.trend : "";
  let rekomendasi = Array.isArray(raw.rekomendasi) ? raw.rekomendasi : [];
  let kesimpulan = typeof raw.kesimpulan === "string" ? raw.kesimpulan : "";

  // Jika insight berisi string JSON mentah (misal akibat error parsing sebelumnya)
  if (insight.trim().startsWith("{") || insight.includes('"insight":')) {
    try {
      const parsedInner = JSON.parse(insight.trim());
      if (parsedInner && typeof parsedInner === "object") {
        return sanitizeAnalysisResult(parsedInner);
      }
    } catch {
      // Regex extraction jika JSON terpotong / truncated
      const insightMatch = insight.match(/"insight"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/);
      const trendMatch = insight.match(/"trend"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/);
      const kesimpulanMatch = insight.match(/"kesimpulan"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"?/);

      if (insightMatch && insightMatch[1]) {
        insight = insightMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ");
      } else {
        insight = insight.replace(/^[{\s]*"insight"\s*:\s*"?/i, "").replace(/"?\s*,?\s*"trend"[\s\S]*$/i, "").trim();
      }

      if (!trend && trendMatch && trendMatch[1]) {
        trend = trendMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ");
      }
      if (!kesimpulan && kesimpulanMatch && kesimpulanMatch[1]) {
        kesimpulan = kesimpulanMatch[1].replace(/\\"/g, '"').replace(/\\n/g, " ");
      }
    }
  }

  // Bersihkan sisa-sisa karakter kutip atau JSON formatting aneh
  insight = insight.replace(/^["']|["']$/g, "").trim();
  trend = trend.replace(/^["']|["']$/g, "").trim();
  kesimpulan = kesimpulan.replace(/^["']|["']$/g, "").trim();

  return {
    insight: insight || "Data keuangan kas madrasah telah tercatat dan berjalan normal.",
    trend,
    rekomendasi: (rekomendasi as unknown[]).filter((r): r is string => typeof r === "string" && r.trim().length > 0),
    kesimpulan,
  };
}

export function AIAnalyzer({ dbData, apiKey, model = "gemini-3.7-flash" }: AIAnalyzerProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isExpanded, setIsExpanded] = useState(true);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [isFromCache, setIsFromCache] = useState(false);
  const [lastAnalyzedAt, setLastAnalyzedAt] = useState<string>("");

  const currentDataHash = useMemo(() => computeDataFingerprint(dbData), [dbData]);
  const activeHashRef = useRef<string>("");

  const handleAnalyze = async (hashToAnalyze: string, isManual = false) => {
    setIsAnalyzing(true);
    setErrorMsg("");

    try {
      // Build kategori spending summary
      const kategoriSpend: Record<string, { nama: string; total: number }> = {};
      dbData.transaksi
        .filter((t) => t.jenis === "KREDIT")
        .forEach((t) => {
          const key = t.kategori_id;
          if (!kategoriSpend[key]) {
            kategoriSpend[key] = { nama: t.kategori_nama || key, total: 0 };
          }
          kategoriSpend[key].total += t.nominal;
        });

      const kategoris = Object.values(kategoriSpend)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const recentTransactions = dbData.transaksi.slice(0, 5);

      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          model,
          summary: dbData.summary,
          recentTransactions,
          kategoris,
          dataHash: hashToAnalyze,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal menganalisis.");
      }

      const cleanResult = sanitizeAnalysisResult(data.result);
      setResult(cleanResult);
      setHasAnalyzed(true);
      setIsFromCache(false);
      activeHashRef.current = hashToAnalyze;
      setLastAnalyzedAt(data.updatedAt || new Date().toISOString());
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal terhubung ke Gemini.";
      setErrorMsg(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Auto-Check: Gunakan cache database jika data belum berubah, atau auto-analisis jika ada data baru ──
  useEffect(() => {
    if (!apiKey) return;

    const savedHash = dbData.pengaturan.ai_analysis_hash;
    const savedResultStr = dbData.pengaturan.ai_analysis_result;

    // 1. Jika data di database sama persis dengan hash saat ini & ada hasil tersimpan:
    if (savedHash && savedHash === currentDataHash && savedResultStr) {
      try {
        const rawParsed = JSON.parse(savedResultStr);
        const cleanParsed = sanitizeAnalysisResult(rawParsed);

        // Jika cache yang tersimpan sebelumnya ternyata rusak (misal berisi JSON mentah),
        // tampilkan hasil yang sudah dibersihkan dulu, lalu jalankan analisis ulang di background untuk memperbarui database
        const isCorruptedCache =
          typeof rawParsed.insight === "string" &&
          (rawParsed.insight.trim().startsWith("{") || rawParsed.insight.includes('"insight":'));

        setResult(cleanParsed);
        setHasAnalyzed(true);
        setIsFromCache(true);
        activeHashRef.current = savedHash;
        setLastAnalyzedAt(dbData.pengaturan.ai_analysis_updated_at || "");
        setIsAnalyzing(false);

        if (isCorruptedCache) {
          // Trigger analisis ulang otomatis agar database tersimpan dengan data bersih
          handleAnalyze(currentDataHash, true);
        }
        return;
      } catch {
        // Jika parse gagal, lanjut auto-analisis
      }
    }

    // 2. Jika sudah pernah dianalisis untuk hash saat ini pada sesi ini, jangan panggil lagi
    if (activeHashRef.current === currentDataHash) {
      return;
    }

    // 3. Jika data di database berubah atau belum pernah dianalisis: jalankan analisis otomatis
    handleAnalyze(currentDataHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDataHash, apiKey, dbData.pengaturan.ai_analysis_hash, dbData.pengaturan.ai_analysis_result]);

  if (!apiKey) {
    return (
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/20 to-slate-900/60 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 shrink-0">
            <Sparkles className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-200">Fitur AI Keuangan Belum Aktif</p>
            <p className="text-xs text-slate-400">
              Masukkan Gemini API Key di{" "}
              <Link href="/dashboard/settings" className="text-violet-400 underline underline-offset-2">
                Pengaturan
              </Link>{" "}
              untuk mengaktifkan analisis AI otomatis dan scan nota.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/30 to-slate-900/80 shadow-lg">
      {/* Header */}
      <div
        className="p-3.5 sm:p-4 cursor-pointer select-none space-y-2"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
            <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl bg-violet-500/10 border border-violet-500/20 shrink-0 mt-0.5 sm:mt-0">
              <Sparkles className="h-4 w-4 text-violet-400" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs sm:text-sm font-bold text-slate-100 leading-tight">
                  Analisis AI Keuangan
                </p>
                <span className="rounded-full bg-violet-500/10 border border-violet-500/30 px-1.5 py-0.5 text-[9px] sm:text-[10px] text-violet-300 font-mono whitespace-nowrap">
                  {model}
                </span>
                {isFromCache && !isAnalyzing && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-1.5 py-0.5 text-[9px] text-emerald-300 font-semibold whitespace-nowrap">
                    <Database className="h-2.5 w-2.5" />
                    0 Token
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Tombol Refresh Manual jika user ingin memaksa analisis ulang */}
            {!isAnalyzing && hasAnalyzed && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleAnalyze(currentDataHash, true);
                }}
                title="Analisis ulang paksa data kas saat ini"
                className="flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2 py-1 sm:px-3 sm:py-1.5 text-[10px] sm:text-[11px] font-bold text-violet-300 hover:bg-violet-500/20 transition active:scale-95"
              >
                <RefreshCw className="h-3 w-3" />
                <span className="hidden sm:inline">Analisis Ulang</span>
              </button>
            )}

            <div className="text-slate-400 p-0.5">
              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </div>
        </div>

        <p className="text-[10px] sm:text-[11px] text-slate-400 pl-10 sm:pl-11 leading-normal">
          {isAnalyzing
            ? "Mendeteksi perubahan data... AI sedang menganalisis"
            : hasAnalyzed
            ? isFromCache
              ? "Hasil dari database (0 Token — data kas tidak berubah)"
              : "Analisis selesai & tersimpan di database"
            : "Gemini AI siap menganalisis data kas"}
        </p>
      </div>

      {/* Collapsible content */}
      {isExpanded && (
        <div className="border-t border-violet-500/10 p-4 space-y-4">
          {/* Analyzing state */}
          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <div className="relative">
                <div className="h-12 w-12 rounded-full border-2 border-violet-500/20 border-t-violet-500 animate-spin" />
                <Sparkles className="absolute inset-0 m-auto h-5 w-5 text-violet-400" />
              </div>
              <p className="text-xs text-slate-400 animate-pulse">Gemini sedang menganalisis data keuangan...</p>
            </div>
          )}

          {/* Error state */}
          {errorMsg && !isAnalyzing && (
            <div className="flex items-start gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Gagal menganalisis</p>
                <p className="mt-0.5 text-rose-300/80">{errorMsg}</p>
              </div>
            </div>
          )}

          {/* Results */}
          {result && !isAnalyzing && (
            <div className="space-y-3">
              {/* Insight */}
              <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-slate-200">Kondisi Keuangan</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{result.insight}</p>
              </div>

              {/* Trend */}
              {result.trend && (
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-3.5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-teal-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-200">Tren Keuangan</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{result.trend}</p>
                </div>
              )}

              {/* Rekomendasi */}
              {result.rekomendasi && result.rekomendasi.length > 0 && (
                <div className="rounded-xl bg-slate-800/50 border border-slate-700/50 p-3.5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Lightbulb className="h-4 w-4 text-amber-400 shrink-0" />
                    <span className="text-xs font-bold text-slate-200">Rekomendasi</span>
                  </div>
                  <ul className="space-y-2">
                    {result.rekomendasi.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-[10px] font-bold text-violet-400">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Kesimpulan */}
              {result.kesimpulan && (
                <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-3.5">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Target className="h-4 w-4 text-violet-400 shrink-0" />
                    <span className="text-xs font-bold text-violet-300">Kesimpulan</span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed italic">&ldquo;{result.kesimpulan}&rdquo;</p>
                </div>
              )}
              {/* Timestamp & Sync Status */}
              {lastAnalyzedAt && (
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60">
                  <span>
                    Dianalisis: {new Date(lastAnalyzedAt).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  {isFromCache && (
                    <span className="text-emerald-400/80 font-medium">✓ Data tersimpan di database</span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Empty state */}
          {!result && !isAnalyzing && !errorMsg && (
            <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/10 border border-violet-500/20">
                <Sparkles className="h-6 w-6 text-violet-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-200">Belum Ada Analisis</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs">
                  AI akan otomatis menganalisis data keuangan ketika transaksi kas dicatat.
                </p>
                <button
                  type="button"
                  onClick={() => handleAnalyze(currentDataHash, true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-violet-500 transition"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Jalankan Analisis Sekarang</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
