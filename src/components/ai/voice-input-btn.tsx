"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceInputBtnProps {
  onResult: (transcript: string) => void;
  onNominalDetected?: (nominal: number) => void;
  className?: string;
  size?: "sm" | "md";
}

// Parsing nominal dari transcript bahasa Indonesia yang akurat
export function parseNominalFromText(text: string): number | null {
  if (!text) return null;
  let t = text.toLowerCase();

  // 1. Normalisasi sinonim & singkatan lisan
  t = t.replace(/\bsejuta\b/g, "1 juta");
  t = t.replace(/\bseribu\b/g, "1 ribu");
  t = t.replace(/\bsetengah juta\b/g, "500 ribu");
  t = t.replace(/\bseperempat juta\b/g, "250 ribu");
  t = t.replace(/\bjt\b/g, "juta");
  t = t.replace(/\brb\b/g, "ribu");
  t = t.replace(/\bk\b/g, "ribu");

  // 2. Pola angka digit + multiplier: "1 juta", "1,5 juta", "2.5 juta", "500 ribu", dsb.
  const digitJutaMatch = t.match(/(\d+(?:[.,]\d+)?)\s*juta/i);
  if (digitJutaMatch) {
    const numStr = digitJutaMatch[1].replace(",", ".");
    const jutaVal = parseFloat(numStr) * 1000000;

    // Cek apakah ada sisa ribuan setelah kata juta (misal "1 juta 500 ribu")
    const afterJuta = t.slice((digitJutaMatch.index || 0) + digitJutaMatch[0].length);
    const ribuanAfterMatch = afterJuta.match(/(\d+(?:[.,]\d+)?)\s*ribu/i);
    if (ribuanAfterMatch) {
      const ribuanVal = parseFloat(ribuanAfterMatch[1].replace(",", ".")) * 1000;
      return Math.round(jutaVal + ribuanVal);
    }
    return Math.round(jutaVal);
  }

  // Pola angka digit + ribu: "500 ribu", "50 ribu", "25 ribu"
  const digitRibuMatch = t.match(/(\d+(?:[.,]\d+)?)\s*ribu/i);
  if (digitRibuMatch) {
    const numStr = digitRibuMatch[1].replace(",", ".");
    const ribuVal = parseFloat(numStr) * 1000;
    return Math.round(ribuVal);
  }

  // 3. Pola kata-kata terbilang Indonesia (misal: "satu juta", "dua juta lima ratus ribu", "lima puluh ribu")
  const wordMap: Record<string, number> = {
    nol: 0, satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
    enam: 6, tujuh: 7, delapan: 8, sembilan: 9, sepuluh: 10,
    sebelas: 11,
  };

  const parseWordGroup = (phrase: string): number => {
    const words = phrase.trim().split(/\s+/);
    let total = 0;
    let temp = 0;
    for (const w of words) {
      if (wordMap[w] !== undefined) {
        temp = wordMap[w];
      } else if (w === "belas") {
        temp = (temp || 1) + 10;
      } else if (w === "puluh") {
        temp = (temp || 1) * 10;
        total += temp;
        temp = 0;
      } else if (w === "ratus") {
        temp = (temp || 1) * 100;
        total += temp;
        temp = 0;
      } else if (!isNaN(Number(w))) {
        temp = Number(w);
      }
    }
    return total + temp;
  };

  if (t.includes("juta")) {
    const parts = t.split("juta");
    const wordsBefore = parts[0].trim().split(/\s+/).slice(-3).join(" ");
    const multiplier = parseWordGroup(wordsBefore) || 1;
    let total = multiplier * 1000000;

    if (parts[1] && parts[1].includes("ribu")) {
      const ribuParts = parts[1].split("ribu");
      const wordsBeforeRibu = ribuParts[0].trim().split(/\s+/).slice(-3).join(" ");
      const ribuMultiplier = parseWordGroup(wordsBeforeRibu);
      total += ribuMultiplier * 1000;
    }
    if (total > 0) return total;
  }

  if (t.includes("ribu")) {
    const parts = t.split("ribu");
    const wordsBefore = parts[0].trim().split(/\s+/).slice(-4).join(" ");
    const multiplier = parseWordGroup(wordsBefore);
    if (multiplier > 0) return multiplier * 1000;
  }

  // 4. Pola angka lengkap yang eksplisit (misal: "Rp 1.000.000", "500000", "250.000")
  // Hanya ambil jika ada format pemisah ribuan atau minimal 4 digit agar tidak bentrok dengan tanggal atau nomor kecil
  const explicitNumber = t.match(/(?:rp\.?\s*)?(\d{1,3}(?:[.,]\d{3})+(?:,\d+)?|\b\d{4,}\b)/i);
  if (explicitNumber) {
    const cleaned = explicitNumber[1].replace(/[^0-9]/g, "");
    const val = parseInt(cleaned, 10);
    if (!isNaN(val) && val > 0) return val;
  }

  return null;
}

export function VoiceInputBtn({ onResult, onNominalDetected, className, size = "md" }: VoiceInputBtnProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [statusText, setStatusText] = useState("");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.lang = "id-ID";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setStatusText("Mendengarkan...");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setStatusText("Memproses...");

      // Ekstrak nominal jika ada
      const nominal = parseNominalFromText(transcript);
      if (nominal && onNominalDetected) {
        onNominalDetected(nominal);
      }

      onResult(transcript);
      setStatusText("");
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setStatusText("");
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      setStatusText("");
    };

    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsListening(false);
    setStatusText("");
  };

  if (!isSupported) {
    return (
      <button
        type="button"
        disabled
        title="Browser tidak mendukung voice input"
        className={cn(
          "flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-[11px] text-slate-500 opacity-50 cursor-not-allowed",
          className
        )}
      >
        <MicOff className="h-3.5 w-3.5" />
        <span>Voice</span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={isListening ? stopListening : startListening}
        title={isListening ? "Stop recording" : "Input via suara (Bahasa Indonesia)"}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all active:scale-95",
          isListening
            ? "border-rose-500/50 bg-rose-500/10 text-rose-400 animate-pulse"
            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20",
          size === "sm" ? "px-2 py-1" : "",
          className
        )}
      >
        {isListening ? (
          <>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
            </span>
            <span>Stop</span>
          </>
        ) : (
          <>
            <Mic className="h-3.5 w-3.5" />
            <span>Voice</span>
          </>
        )}
      </button>
      {statusText && (
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          {statusText}
        </span>
      )}
    </div>
  );
}
