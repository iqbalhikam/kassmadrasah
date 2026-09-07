"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, Camera, ScanLine, Loader2, CheckCircle2, AlertCircle, RefreshCw, Upload } from "lucide-react";
import { ScanNotaResult, GeminiModelOption } from "@/types";

interface CameraScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  model?: GeminiModelOption;
  onScanResult: (result: ScanNotaResult) => void;
}

export function CameraScanModal({ isOpen, onClose, apiKey, model = "gemini-3.7-flash", onScanResult }: CameraScanModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<"camera" | "preview">("camera");
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [isCameraReady, setIsCameraReady] = useState(false);

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
    } catch (err: any) {
      setCameraError("Tidak dapat mengakses kamera. Pastikan izin kamera diperbolehkan.");
    }
  }, []);

  useEffect(() => {
    if (isOpen && mode === "camera") {
      startCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, mode, startCamera, stopCamera]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0);
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
      const dataUrl = ev.target?.result as string;
      setCapturedImage(dataUrl);
      setMode("preview");
    };
    reader.readAsDataURL(file);
  };

  const handleRetake = () => {
    setCapturedImage(null);
    setErrorMsg("");
    setMode("camera");
  };

  const handleScan = async () => {
    if (!capturedImage) return;
    setIsScanning(true);
    setErrorMsg("");

    try {
      // Strip data URL prefix to get base64
      const base64 = capturedImage.split(",")[1];
      const mimeType = capturedImage.split(";")[0].split(":")[1];

      const res = await fetch("/api/ai/scan-nota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, imageBase64: base64, mimeType, model }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal memproses gambar.");
      }

      if (data.result.error) {
        setErrorMsg(data.result.error);
        return;
      }

      onScanResult(data.result);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal scan nota.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleClose = () => {
    stopCamera();
    setCapturedImage(null);
    setMode("camera");
    setErrorMsg("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-950/90 backdrop-blur-sm">
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl max-h-[95dvh] flex flex-col">
        {/* Drag handle mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="h-1 w-10 rounded-full bg-slate-700" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
              <ScanLine className="h-4 w-4 text-violet-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">Scan Nota / Kuitansi</h2>
              <p className="text-[10px] text-slate-400">AI akan membaca dan mengisi form otomatis</p>
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

          {mode === "camera" ? (
            <div className="space-y-3">
              {/* Camera viewfinder */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
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
                {/* Scan overlay frame */}
                {isCameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-3/4 h-1/2 border-2 border-violet-400/60 rounded-lg">
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
                Arahkan kamera ke nota/kuitansi, pastikan terlihat jelas
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                >
                  <Upload className="h-4 w-4" />
                  Pilih Foto
                </button>
                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={!isCameraReady}
                  className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 transition disabled:opacity-50"
                >
                  <Camera className="h-4 w-4" />
                  Ambil Foto
                </button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>
          ) : (
            <div className="space-y-3">
              {/* Preview image */}
              {capturedImage && (
                <div className="relative rounded-2xl overflow-hidden border border-slate-700">
                  <img
                    src={capturedImage}
                    alt="Nota preview"
                    className="w-full max-h-64 object-contain bg-slate-950"
                  />
                  <div className="absolute bottom-2 right-2 rounded-lg bg-slate-900/80 px-2 py-1 text-[10px] text-slate-300 border border-slate-700">
                    Preview Nota
                  </div>
                </div>
              )}

              <div className="rounded-xl bg-violet-500/5 border border-violet-500/20 p-3 text-[11px] text-violet-300">
                <p className="font-semibold mb-1">AI akan mendeteksi:</p>
                <ul className="space-y-0.5 text-slate-400">
                  <li>• Nominal / jumlah uang</li>
                  <li>• Keterangan / deskripsi</li>
                  <li>• Tanggal transaksi</li>
                  <li>• Jenis (pemasukan/pengeluaran)</li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                >
                  <RefreshCw className="h-4 w-4" />
                  Ulangi
                </button>
                <button
                  type="button"
                  onClick={handleScan}
                  disabled={isScanning}
                  className="flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-violet-600/30 hover:bg-violet-500 transition disabled:opacity-50"
                >
                  {isScanning ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Memproses AI...</span>
                    </>
                  ) : (
                    <>
                      <ScanLine className="h-4 w-4" />
                      <span>Scan dengan AI</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
