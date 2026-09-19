"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  X, Camera, ScanLine, Loader2, CheckCircle2, AlertCircle, RefreshCw, Upload,
  ListOrdered, Layers, ChevronRight, Banknote, CalendarDays,
} from "lucide-react";
import { ScanNotaResult, ScanNotaItem, GeminiModelOption } from "@/types";
import { cn } from "@/lib/utils";

interface CameraScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  model?: GeminiModelOption;
  /** Dipanggil jika user pilih "Gabung Jadi 1 Transaksi" */
  onScanResult: (result: ScanNotaResult) => void;
  /** Dipanggil jika user pilih "Pisah Per Item" – array transaksi terpisah */
  onMultiScanResult?: (items: ScanNotaItem[], tanggal: string, jenis: ScanNotaResult["jenis"]) => void;
}

type ModalMode = "camera" | "preview" | "review";

function formatRupiah(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}

export function CameraScanModal({
  isOpen, onClose, apiKey, model = "gemini-3.7-flash", onScanResult, onMultiScanResult,
}: CameraScanModalProps) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);

  const [mode, setMode]               = useState<ModalMode>("camera");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning]   = useState(false);
  const [errorMsg, setErrorMsg]       = useState("");
  const [cameraError, setCameraError] = useState("");
  const [isCameraReady, setIsCameraReady] = useState(false);

  // scan result state
  const [scanResult, setScanResult]   = useState<ScanNotaResult | null>(null);

  // per-item edit: user bisa toggle jenis per item
  const [editedItems, setEditedItems] = useState<ScanNotaItem[]>([]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError("");
    setIsCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setIsCameraReady(true);
      }
    } catch {
      setCameraError("Tidak dapat mengakses kamera. Pastikan izin kamera diperbolehkan.");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (isOpen && mode === "camera") startCamera();
    }, 0);
    return () => {
      clearTimeout(timer);
      setTimeout(() => stopCamera(), 0);
    };
  }, [isOpen, mode, startCamera, stopCamera]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
    setCapturedImage(dataUrl);
    setMode("preview");
    stopCamera();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCapturedImage(ev.target?.result as string);
      setMode("preview");
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setScanResult(null);
    setEditedItems([]);
    setErrorMsg("");
    setMode("camera");
  };

  const handleScan = async () => {
    if (!capturedImage) return;
    setIsScanning(true);
    setErrorMsg("");

    try {
      const base64   = capturedImage.split(",")[1];
      const mimeType = capturedImage.split(";")[0].split(":")[1];

      const res  = await fetch("/api/ai/scan-nota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, imageBase64: base64, mimeType, model }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Gagal memproses gambar.");
      if (data.result.error) { setErrorMsg(data.result.error); return; }

      const result: ScanNotaResult = data.result;
      setScanResult(result);

      // Normalise items
      const items: ScanNotaItem[] = Array.isArray(result.items) && result.items.length > 0
        ? result.items
        : [{ keterangan: result.keterangan || "", nominal: result.nominal || 0, jenis: result.jenis }];
      setEditedItems(items);
      setMode("review");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Gagal scan nota.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setScanResult(null);
    setEditedItems([]);
    setMode("camera");
    setErrorMsg("");
    onClose();
  };

  // ── Pilihan Gabung ─────────────────────────────────────────────────────────
  const handleMerge = () => {
    if (!scanResult) return;
    const total = editedItems.reduce((s, it) => s + (it.nominal || 0), 0);
    const merged: ScanNotaResult = {
      nominal:    total,
      keterangan: scanResult.keterangan || editedItems.map(i => i.keterangan).join(", "),
      tanggal:    scanResult.tanggal || "",
      jenis:      scanResult.jenis || editedItems[0]?.jenis || "KREDIT",
    };
    onScanResult(merged);
    handleClose();
  };

  // ── Pilihan Pisah ──────────────────────────────────────────────────────────
  const handleSplit = () => {
    if (!scanResult || !onMultiScanResult) return;
    onMultiScanResult(editedItems, scanResult.tanggal || "", scanResult.jenis || "KREDIT");
    handleClose();
  };

  const toggleItemJenis = (idx: number) => {
    setEditedItems(prev => prev.map((it, i) =>
      i === idx ? { ...it, jenis: it.jenis === "DEBIT" ? "KREDIT" : "DEBIT" } : it
    ));
  };

  const total = editedItems.reduce((s, it) => s + (it.nominal || 0), 0);
  const isMultiItem = editedItems.length > 1;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/90 backdrop-blur-sm modal-backdrop-in">
      <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl max-h-[95dvh] flex flex-col modal-panel-in">
        {/* Drag handle mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
              <ScanLine className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                {mode === "review" ? "Hasil Scan Nota" : "Scan Nota / Kuitansi"}
              </h2>
              <p className="text-[10px] text-slate-400">
                {mode === "review"
                  ? isMultiItem
                    ? `${editedItems.length} item terdeteksi — pilih cara input`
                    : "1 item terdeteksi — konfirmasi & masukkan"
                  : "AI akan membaca dan mengisi form otomatis"}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/20 p-3 text-xs text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ── Camera mode ── */}
          {mode === "camera" && (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video">
                <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                {!isCameraReady && !cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-400">
                    <Loader2 className="h-8 w-8 animate-spin text-violet-400" />
                    <span className="text-xs">Memulai kamera...</span>
                  </div>
                )}
                {cameraError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center px-4">
                    <Camera className="h-10 w-10 text-slate-600" />
                    <p className="text-xs text-slate-400">{cameraError}</p>
                  </div>
                )}
                {isCameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3/4 h-1/2 border-2 border-violet-400/60 rounded-lg relative">
                      <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-violet-400 rounded-tl" />
                      <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-violet-400 rounded-tr" />
                      <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-violet-400 rounded-bl" />
                      <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-violet-400 rounded-br" />
                    </div>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <p className="text-center text-[11px] text-slate-400">
                Arahkan kamera ke nota/kuitansi, pastikan semua item terlihat jelas
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition">
                  <Upload className="h-4 w-4" /> Pilih Foto
                </button>
                <button type="button" onClick={handleCapture} disabled={!isCameraReady}
                  className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 transition disabled:opacity-50">
                  <Camera className="h-4 w-4" /> Ambil Foto
                </button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
            </div>
          )}

          {/* ── Preview mode ── */}
          {mode === "preview" && (
            <div className="space-y-3">
              {capturedImage && (
                <div className="relative rounded-2xl overflow-hidden border border-slate-700">
                  <img src={capturedImage} alt="Nota preview" className="w-full max-h-64 object-contain bg-slate-950" />
                  <div className="absolute bottom-2 right-2 rounded-lg bg-slate-900/80 px-2 py-1 text-[10px] text-slate-300 border border-slate-700">
                    Preview Nota
                  </div>
                </div>
              )}
              <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-3 text-[11px] text-violet-300">
                <p className="font-semibold mb-1">AI akan mendeteksi semua item:</p>
                <ul className="space-y-0.5 text-slate-400">
                  <li>• Semua item / baris produk dengan nominal</li>
                  <li>• Keterangan per item dan total keseluruhan</li>
                  <li>• Tanggal transaksi dan jenis (masuk/keluar)</li>
                </ul>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={handleRetake}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition">
                  <RefreshCw className="h-4 w-4" /> Ulangi
                </button>
                <button type="button" onClick={handleScan} disabled={isScanning}
                  className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 transition disabled:opacity-50">
                  {isScanning
                    ? <><Loader2 className="h-4 w-4 animate-spin" /><span>Membaca Nota...</span></>
                    : <><ScanLine className="h-4 w-4" /><span>Scan dengan AI</span></>}
                </button>
              </div>
            </div>
          )}

          {/* ── Review multi-item mode ── */}
          {mode === "review" && (
            <div className="space-y-4 animate-view-switch">
              {/* Meta info */}
              <div className="flex items-center gap-3 flex-wrap">
                {scanResult?.tanggal && (
                  <div className="flex items-center gap-1.5 rounded-lg bg-slate-800 px-2.5 py-1.5 text-[11px] text-slate-300">
                    <CalendarDays className="h-3.5 w-3.5 text-violet-400" />
                    {scanResult.tanggal}
                  </div>
                )}
                <div className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold",
                  scanResult?.jenis === "DEBIT"
                    ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                    : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                )}>
                  {scanResult?.jenis === "DEBIT" ? "+ Pemasukan" : "− Pengeluaran"}
                </div>
              </div>

              {/* Items list */}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  Item Terdeteksi ({editedItems.length})
                </p>
                {editedItems.map((item, idx) => (
                  <div key={idx}
                    className="flex items-start gap-2 rounded-xl border border-slate-800 bg-slate-950/70 p-2.5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-100 font-medium leading-snug">{item.keterangan || "—"}</p>
                      <p className="text-[11px] text-violet-400 font-mono mt-0.5">{formatRupiah(item.nominal)}</p>
                    </div>
                    {/* Toggle jenis per item */}
                    <button
                      type="button"
                      onClick={() => toggleItemJenis(idx)}
                      title="Klik untuk ganti jenis"
                      className={cn(
                        "shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg transition active:scale-95 border",
                        (item.jenis || scanResult?.jenis) === "DEBIT"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20"
                          : "bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20",
                      )}
                    >
                      {(item.jenis || scanResult?.jenis) === "DEBIT" ? "MASUK" : "KELUAR"}
                    </button>
                  </div>
                ))}
              </div>

              {/* Total summary */}
              <div className="flex items-center justify-between rounded-xl bg-violet-500/5 border border-violet-500/20 px-4 py-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-100">
                  <Banknote className="h-4 w-4 text-violet-400" />
                  Total
                </div>
                <span className="font-mono text-sm font-bold text-violet-300">{formatRupiah(total)}</span>
              </div>

              {/* Action buttons */}
              {isMultiItem ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {/* Pisah */}
                  <button
                    type="button"
                    onClick={handleSplit}
                    disabled={!onMultiScanResult}
                    className="flex items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 py-3 text-xs font-bold text-violet-300 hover:bg-violet-500/20 transition active:scale-95 disabled:opacity-40"
                  >
                    <ListOrdered className="h-4 w-4" />
                    <div className="text-left">
                      <div>Pisah Per Item</div>
                      <div className="text-[10px] font-normal text-violet-400/70">{editedItems.length} transaksi terpisah</div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-50" />
                  </button>
                  {/* Gabung */}
                  <button
                    type="button"
                    onClick={handleMerge}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition active:scale-95"
                  >
                    <Layers className="h-4 w-4" />
                    <div className="text-left">
                      <div>Gabung 1 Transaksi</div>
                      <div className="text-[10px] font-normal text-emerald-200/70">Total {formatRupiah(total)}</div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 ml-auto opacity-50" />
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={handleRetake}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition">
                    <RefreshCw className="h-4 w-4" /> Ulangi Scan
                  </button>
                  <button type="button" onClick={handleMerge}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition active:scale-95">
                    <CheckCircle2 className="h-4 w-4" /> Isi Form
                  </button>
                </div>
              )}

              <button type="button" onClick={handleRetake}
                className="w-full text-center text-[11px] text-slate-500 hover:text-slate-300 transition py-1">
                ← Scan ulang nota lain
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}