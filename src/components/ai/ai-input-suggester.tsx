"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { Sparkles, Loader2, Lightbulb, Zap, PlusCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import { Kategori, TransaksiJenis, GeminiModelOption } from "@/types";

export interface AISuggestion {
  isExistingMatch: boolean;
  suggestedKategoriId?: string | null;
  suggestedKategoriNama?: string | null;
  suggestedNewCategory?: string | null;
  suggestedJenis?: TransaksiJenis;
  explanation: string;
}

interface AIInputSuggesterProps {
  keterangan: string;
  nominal?: string;
  currentJenis: TransaksiJenis;
  currentKategoriId: string;
  categories: Kategori[];
  apiKey?: string;
  model?: GeminiModelOption;
  onApplyCategory: (catId: string, jenis?: TransaksiJenis) => void;
  onApplyKeterangan: (text: string) => void;
  onRequestCreateCategory?: (suggestedName: string, suggestedJenis: TransaksiJenis) => void;
  isCreatingCategory?: boolean;
}

// Quick templates for instant 1-tap input
const QUICK_TEMPLATES: Record<TransaksiJenis, Array<{ text: string; catKeyword: string; icon: string }>> = {
  DEBIT: [
    { text: "Pembayaran SPP Siswa Bulan Ini", catKeyword: "spp", icon: "🎓" },
    { text: "Penerimaan Pencairan Dana BOS", catKeyword: "bos", icon: "🏛️" },
    { text: "Infaq / Sedekah Jumat Berkah", catKeyword: "infaq", icon: "🤲" },
    { text: "Penerimaan Pendaftaran Santri Baru", catKeyword: "lain", icon: "📝" },
  ],
  KREDIT: [
    { text: "Pembelian Kertas HVS & Spidol ATK", catKeyword: "atk", icon: "✏️" },
    { text: "Honorarium & Insentif Guru/Staf", catKeyword: "gaji", icon: "👨‍🏫" },
    { text: "Pemeliharaan Sarpras & Servis AC", catKeyword: "sarpras", icon: "🏢" },
    { text: "Konsumsi Rapat Dewan Guru & Komite", catKeyword: "kegiatan", icon: "🍱" },
  ],
};

function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  return String(h);
}

const DEBOUNCE_MS = 1400; // ms wait after user finishes typing
const MIN_CHARS = 8;     // min length before calling AI

export function AIInputSuggester({
  keterangan,
  nominal,
  currentJenis,
  currentKategoriId,
  categories,
  apiKey,
  model = "gemini-3.7-flash",
  onApplyCategory,
  onApplyKeterangan,
  onRequestCreateCategory,
  isCreatingCategory = false,
}: AIInputSuggesterProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const lastSentHashRef = useRef<string>("");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 1. Smart Local Pattern Matcher (Zero-Token, Instant) ─────────────────
  const localMatch = useMemo(() => {
    const text = keterangan.toLowerCase().trim();
    if (text.length < 3) return null;

    const rules: Array<{ keywords: string[]; catMatch: (c: Kategori) => boolean; jenis: TransaksiJenis }> = [
      {
        keywords: ["spp", "sekolah", "uang bulanan", "syahriah"],
        catMatch: (c) => c.nama_kategori.toLowerCase().includes("spp"),
        jenis: "DEBIT",
      },
      {
        keywords: ["bos", "bop", "kemenag", "bantuan operasional"],
        catMatch: (c) => c.nama_kategori.toLowerCase().includes("bos"),
        jenis: "DEBIT",
      },
      {
        keywords: ["infaq", "infak", "sedekah", "donasi", "sumbangan", "wakaf"],
        catMatch: (c) => c.nama_kategori.toLowerCase().includes("infaq") || c.nama_kategori.toLowerCase().includes("sedekah"),
        jenis: "DEBIT",
      },
      {
        keywords: ["gaji", "honor", "insentif", "ustadz", "guru", "staf", "tunjangan"],
        catMatch: (c) => c.nama_kategori.toLowerCase().includes("gaji") || c.nama_kategori.toLowerCase().includes("honor"),
        jenis: "KREDIT",
      },
      {
        keywords: ["kertas", "spidol", "tinta", "atk", "pulpen", "map", "fotokopi", "print", "alat tulis", "buku"],
        catMatch: (c) => c.nama_kategori.toLowerCase().includes("atk") || c.nama_kategori.toLowerCase().includes("operasional"),
        jenis: "KREDIT",
      },
      {
        keywords: ["ac", "genteng", "cat", "lampu", "kursi", "meja", "renovasi", "sarpras", "kebersihan", "sapu", "rusak"],
        catMatch: (c) => c.nama_kategori.toLowerCase().includes("sarpras") || c.nama_kategori.toLowerCase().includes("gedung"),
        jenis: "KREDIT",
      },
      {
        keywords: ["phbi", "maulid", "pramuka", "lomba", "isra", "snack", "konsumsi", "makan", "kegiatan", "wisuda", "outing"],
        catMatch: (c) => c.nama_kategori.toLowerCase().includes("kegiatan") || c.nama_kategori.toLowerCase().includes("phbi"),
        jenis: "KREDIT",
      },
      {
        keywords: ["listrik", "pln", "token listrik", "wifi", "indihome", "internet", "pdam", "air"],
        catMatch: (c) => c.nama_kategori.toLowerCase().includes("listrik") || c.nama_kategori.toLowerCase().includes("operasional") || c.nama_kategori.toLowerCase().includes("utilitas"),
        jenis: "KREDIT",
      },
    ];

    for (const rule of rules) {
      if (rule.keywords.some((kw) => text.includes(kw))) {
        const foundCat = categories.find(rule.catMatch);
        if (foundCat) {
          return {
            category: foundCat,
            suggestedJenis: rule.jenis,
          };
        }
      }
    }
    return null;
  }, [keterangan, categories]);

  // Auto-apply local match if user hasn't selected a category yet
  useEffect(() => {
    if (localMatch && (!currentKategoriId || localMatch.category.id === currentKategoriId)) {
      if (!currentKategoriId) {
        onApplyCategory(localMatch.category.id, localMatch.suggestedJenis);
      }
    }
  }, [localMatch, currentKategoriId, onApplyCategory]);

  // ── 2. Auto Gemini AI Category Suggestion (Debounced) ─────────────────────
  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!keterangan || keterangan.trim().length === 0) {
      setAiSuggestion(null);
      setErrorMsg("");
      lastSentHashRef.current = "";
      return;
    }

    if (!apiKey || keterangan.trim().length < MIN_CHARS) return;

    // Only hash keterangan and currentJenis — nominal will NEVER trigger this effect
    const currentHash = simpleHash(`${keterangan.trim()}|${currentJenis}`);
    if (currentHash === lastSentHashRef.current) return;

    debounceTimerRef.current = setTimeout(async () => {
      if (currentHash === lastSentHashRef.current) return;

      setIsAnalyzing(true);
      setErrorMsg("");
      lastSentHashRef.current = currentHash;

      try {
        const res = await fetch("/api/ai/suggest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            apiKey,
            model,
            keterangan: keterangan.trim(),
            currentJenis,
            categories,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || "Gagal menganalisis kategori.");

        const suggestion: AISuggestion = data.suggestion;
        setAiSuggestion(suggestion);

        // If existing category is matched and user hasn't selected a category, auto-apply it!
        if (suggestion.isExistingMatch && suggestion.suggestedKategoriId) {
          onApplyCategory(suggestion.suggestedKategoriId, suggestion.suggestedJenis);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Gagal terhubung ke Gemini AI.";
        setErrorMsg(msg);
        lastSentHashRef.current = "";
      } finally {
        setIsAnalyzing(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, [keterangan, currentJenis, apiKey, model, categories, onApplyCategory]);

  return (
    <div className="space-y-2 pt-1">
      {/* ── Empty State: Quick Templates ── */}
      {!keterangan && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 font-semibold text-slate-300">
              <Zap className="h-3 w-3 text-amber-400" /> Contoh Cepat {currentJenis === "DEBIT" ? "Pemasukan" : "Pengeluaran"}:
            </span>
            <span className="text-[10px] text-slate-500">Klik untuk isi</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_TEMPLATES[currentJenis].map((tpl, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onApplyKeterangan(tpl.text);
                  const matchedCat = categories.find((c) =>
                    c.nama_kategori.toLowerCase().includes(tpl.catKeyword)
                  );
                  if (matchedCat) {
                    onApplyCategory(matchedCat.id, currentJenis);
                  }
                }}
                className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/80 px-2.5 py-1 text-[11px] text-slate-300 hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300 transition active:scale-95"
              >
                <span>{tpl.icon}</span>
                <span>{tpl.text}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── AI Analyzing Indicator ── */}
      {isAnalyzing && (
        <div className="flex items-center gap-2 rounded-xl border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-[11px] text-violet-400 animate-in fade-in">
          <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-violet-400" />
          <span>Gemini AI sedang mendeteksi kategori yang relevan...</span>
        </div>
      )}

      {/* ── Typing hint before debounce ── */}
      {keterangan.trim().length >= MIN_CHARS && apiKey && !isAnalyzing && !aiSuggestion && !errorMsg && (
        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 px-0.5">
          <Sparkles className="h-3 w-3 text-emerald-500/70" />
          <span>Auto Kategori aktif — AI akan mendeteksi pos kas yang tepat setelah selesai mengetik</span>
        </div>
      )}

      {errorMsg && (
        <p className="text-[11px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg p-2">
          {errorMsg}
        </p>
      )}

      {/* ── RESULT CASE 1: Existing Category Matched & Auto-Selected ── */}
      {aiSuggestion && aiSuggestion.isExistingMatch && aiSuggestion.suggestedKategoriNama && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-xs text-emerald-300 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-2 min-w-0">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <div className="min-w-0">
              <span className="font-bold text-emerald-200">Auto Kategori:</span>{" "}
              <span className="font-semibold text-white truncate">{aiSuggestion.suggestedKategoriNama}</span>
              {aiSuggestion.explanation && (
                <p className="text-[10px] text-emerald-400/80 truncate mt-0.5">{aiSuggestion.explanation}</p>
              )}
            </div>
          </div>
          <span className="ml-auto shrink-0 text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
            ✓ Terpilih
          </span>
        </div>
      )}

      {/* ── RESULT CASE 2: No Relevant Category Found -> Suggest New Category! ── */}
      {aiSuggestion && !aiSuggestion.isExistingMatch && aiSuggestion.suggestedNewCategory && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs space-y-2.5 animate-in fade-in zoom-in-95">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-200">Kategori Belum Tersedia</span>
                <span className="text-[10px] text-amber-400/80 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  Saran Pos Baru
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-1">
                Tidak ada kategori yang cocok di daftar. AI merekomendasikan:
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-xs font-bold text-amber-300 bg-slate-900/90 border border-amber-500/40 px-2.5 py-1 rounded-lg shadow-sm">
                  📁 {aiSuggestion.suggestedNewCategory}
                </span>
                {aiSuggestion.suggestedJenis && (
                  <span className="text-[10px] font-semibold text-slate-400">
                    ({aiSuggestion.suggestedJenis === "DEBIT" ? "Pemasukan" : "Pengeluaran"})
                  </span>
                )}
              </div>
              {aiSuggestion.explanation && (
                <p className="text-[10px] text-slate-400 mt-1 italic">
                  💡 {aiSuggestion.explanation}
                </p>
              )}
            </div>
          </div>

          {onRequestCreateCategory && (
            <div className="pt-2 border-t border-amber-500/20 flex items-center justify-end">
              <button
                type="button"
                disabled={isCreatingCategory}
                onClick={() => {
                  if (aiSuggestion.suggestedNewCategory) {
                    onRequestCreateCategory(
                      aiSuggestion.suggestedNewCategory,
                      aiSuggestion.suggestedJenis || currentJenis
                    );
                  }
                }}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white px-3 py-1.5 text-xs font-bold shadow-md shadow-amber-600/30 transition active:scale-95 disabled:opacity-50"
              >
                {isCreatingCategory ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Membuat Kategori...</span>
                  </>
                ) : (
                  <>
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>+ Buat & Pakai Kategori Ini</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
