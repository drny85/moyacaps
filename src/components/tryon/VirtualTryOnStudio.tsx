"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera,
  Upload,
  Sparkles,
  ShoppingBag,
  Download,
  RotateCcw,
  Sliders,
  Check,
  Columns,
  ShieldCheck,
  X,
  Layers,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Lock,
} from "lucide-react";
import confetti from "canvas-confetti";
import { useStore } from "@/store/useStore";
import { CAP_VARIANTS, type CapVariant } from "@/data/caps";
import { useSoundEffects } from "@/hooks/useSoundEffects";

const SAMPLE_AVATARS = [
  { id: "model-1", name: "Marcus", image: "/avatars/model-1.jpg" },
  { id: "model-2", name: "Elena", image: "/avatars/model-2.jpg" },
  { id: "model-3", name: "Jaden", image: "/avatars/model-3.jpg" },
];

const FIT_PRESETS = [
  { id: "classic", labelEn: "Classic Fit", labelEs: "Corte Clásico", offsetY: 0, scale: 1, tilt: 0 },
  { id: "low-brow", labelEn: "Low Brow", labelEs: "Ajuste Ceja", offsetY: 22, scale: 1.03, tilt: 0 },
  { id: "high-crown", labelEn: "Crown High", labelEs: "Corona Alta", offsetY: -18, scale: 0.98, tilt: -2 },
  { id: "slant", labelEn: "Street Slant", labelEs: "Inclinado", offsetY: -4, scale: 1.02, tilt: 7 },
];

interface VirtualTryOnStudioProps {
  initialCap?: CapVariant | null;
  onClose?: () => void;
  isModal?: boolean;
}

export function VirtualTryOnStudio({
  initialCap = null,
  onClose,
  isModal = false,
}: VirtualTryOnStudioProps) {
  const locale = useLocale();
  const isEs = locale === "es";
  const { playClick, playSuccessChime, playToggle } = useSoundEffects();

  const {
    addToCart,
    tryOnImage,
    setTryOnImage,
    tryOnSettings,
    setTryOnSettings,
  } = useStore();

  const [selectedCap, setSelectedCap] = useState<CapVariant>(
    initialCap || CAP_VARIANTS[0]
  );
  const [compareCap, setCompareCap] = useState<CapVariant>(CAP_VARIANTS[1]);
  const [isCompareMode, setIsCompareMode] = useState(false);

  // Active portrait image: uploaded image, or default sample avatar
  const [activePortrait, setActivePortrait] = useState<string>(
    tryOnImage || SAMPLE_AVATARS[0].image
  );

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Tuning controls (nudge, scale, tilt)
  const [offsetY, setOffsetY] = useState(tryOnSettings.offsetY || 0);
  const [scale, setScale] = useState(tryOnSettings.scale || 1);
  const [tilt, setTilt] = useState(tryOnSettings.tilt || 0);
  const [showTuningHud, setShowTuningHud] = useState(false);

  const [activePreset, setActivePreset] = useState<string>("classic");
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Hidden canvas for download export
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);

  // Update store settings on changes
  useEffect(() => {
    setTryOnSettings({ offsetY, scale, tilt });
  }, [offsetY, scale, tilt, setTryOnSettings]);

  // Handle Photo Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        stopCamera();
        setActivePortrait(dataUrl);
        setTryOnImage(dataUrl);
        playSuccessChime();
      }
    };
    reader.readAsDataURL(file);
  };

  // Start Camera
  const startCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
      });
      mediaStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
      playToggle(true);
    } catch (err: any) {
      console.warn("Camera permission denied:", err);
      setCameraError(
        isEs
          ? "No se pudo acceder a la cámara. Por favor sube una foto o usa un modelo."
          : "Camera access was denied. Please upload a photo or use a sample avatar."
      );
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Take Snapshot from camera
  const captureSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Flip horizontally for natural mirror feel
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    stopCamera();
    setActivePortrait(dataUrl);
    setTryOnImage(dataUrl);
    playSuccessChime();
  };

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Apply Fit Preset
  const handleApplyPreset = (preset: typeof FIT_PRESETS[0]) => {
    playClick();
    setActivePreset(preset.id);
    setOffsetY(preset.offsetY);
    setScale(preset.scale);
    setTilt(preset.tilt);
  };

  // Add to Bag
  const handleAddToCart = (capToAdd: CapVariant) => {
    playSuccessChime();
    addToCart(capToAdd, 1, capToAdd.stock);
    setAddedSuccess(true);
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#e11d48", "#059669", "#a855f7", "#fbbf24"],
    });
    setTimeout(() => setAddedSuccess(false), 2000);
  };

  // Download High-Res Try-On Fitting Card
  const handleDownloadPortrait = async () => {
    setIsExporting(true);
    try {
      const canvas = exportCanvasRef.current || document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1080;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // 1. Draw base portrait
      const portraitImg = new window.Image();
      portraitImg.crossOrigin = "anonymous";
      portraitImg.src = activePortrait;
      await new Promise((resolve) => {
        portraitImg.onload = resolve;
      });

      ctx.drawImage(portraitImg, 0, 0, 1080, 1080);

      // 2. Draw Cap with drop shadow, offset, scale, and tilt
      const capImg = new window.Image();
      capImg.crossOrigin = "anonymous";
      capImg.src = selectedCap.image;
      await new Promise((resolve) => {
        capImg.onload = resolve;
      });

      ctx.save();
      // Cap Anchor Center
      const capWidth = 580 * scale;
      const capHeight = 440 * scale;
      const centerX = 540;
      const centerY = 280 + offsetY * 2.2;

      ctx.translate(centerX, centerY);
      ctx.rotate((tilt * Math.PI) / 180);

      // Natural soft drop shadow
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 35;
      ctx.shadowOffsetY = 25;

      ctx.drawImage(capImg, -capWidth / 2, -capHeight / 2, capWidth, capHeight);
      ctx.restore();

      // 3. Draw Watermark & Branding Card
      ctx.fillStyle = "rgba(10, 10, 15, 0.75)";
      ctx.roundRect(40, 970, 1000, 70, 16);
      ctx.fill();

      ctx.font = "bold 24px 'Space Grotesk', sans-serif";
      ctx.fillStyle = "#ffffff";
      ctx.fillText("GOOD LUCK 0880 • VIRTUAL TRY-ON", 65, 1015);

      ctx.font = "18px 'Space Grotesk', sans-serif";
      ctx.fillStyle = "#E11D48";
      ctx.fillText(selectedCap.nameEn.toUpperCase(), 750, 1015);

      // 4. Trigger download
      const link = document.createElement("a");
      link.download = `goodluck-tryon-${selectedCap.id}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      playSuccessChime();
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative w-full max-w-6xl mx-auto rounded-3xl bg-white dark:bg-[#0c0c14] border border-black/10 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col select-none">
      {/* Hidden export canvas */}
      <canvas ref={exportCanvasRef} className="hidden" />

      {/* Top Header Bar */}
      <div className="p-4 sm:p-6 border-b border-black/[0.08] dark:border-white/[0.08] flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-moya-red to-moya-red-deep p-0.5 flex items-center justify-center shadow-lg shadow-moya-red/25 text-white">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest uppercase text-moya-red font-bold">
                {isEs ? "PROBADOR VIRTUAL 0880" : "GOOD LUCK VIRTUAL MIRROR"}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-mono font-bold flex items-center gap-1">
                <Lock className="w-2.5 h-2.5" />
                {isEs ? "100% Privado en Dispositivo" : "100% On-Device Private"}
              </span>
            </div>
            <h2 className="font-display font-bold text-lg sm:text-2xl text-zinc-900 dark:text-white">
              {isEs ? "Pruébate Cada Gorra en Tu Rostro" : "Try On Each Cap On Your Face"}
            </h2>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2">
          {/* Compare Toggle */}
          <button
            type="button"
            onClick={() => {
              playClick();
              setIsCompareMode(!isCompareMode);
            }}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-display font-semibold transition-all border ${
              isCompareMode
                ? "bg-moya-red text-white border-moya-red"
                : "glass-dark text-zinc-600 dark:text-zinc-400 border-black/10 dark:border-white/10"
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>{isEs ? "Comparar 2" : "Split Compare"}</span>
          </button>

          {isModal && onClose && (
            <button
              onClick={() => {
                playClick();
                onClose();
              }}
              className="p-2 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Studio Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
        {/* Left Column: Live Portrait Stage */}
        <div className="lg:col-span-7 p-4 sm:p-6 bg-zinc-100 dark:bg-[#07070b] flex flex-col items-center justify-between gap-4 border-b lg:border-b-0 lg:border-r border-black/[0.08] dark:border-white/[0.08]">
          {/* Portrait Mirror Stage */}
          <div className="relative w-full max-w-[420px] aspect-square rounded-3xl overflow-hidden bg-zinc-900 shadow-2xl border border-black/10 dark:border-white/10 flex items-center justify-center group">
            {/* Live Camera Feed */}
            {isCameraActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              /* Still Photo or Avatar */
              <div className="relative w-full h-full">
                <Image
                  src={activePortrait}
                  alt="Customer Face Portrait"
                  fill
                  priority
                  className="object-cover"
                />
              </div>
            )}

            {/* Cap A Overlay */}
            <div
              style={{
                position: "absolute",
                top: `${14 + offsetY * 0.28}%`,
                left: "50%",
                transform: `translateX(-50%) rotate(${tilt}deg) scale(${scale})`,
                width: "72%",
                maxWidth: "320px",
                aspectRatio: "1/0.75",
                pointerEvents: "none",
                transition: "transform 0.08s ease-out, top 0.08s ease-out",
                filter: "drop-shadow(0 16px 20px rgba(0,0,0,0.65))",
                zIndex: 20,
              }}
            >
              <Image
                src={selectedCap.image}
                alt={selectedCap.nameEn}
                fill
                priority
                className="object-contain"
              />
            </div>

            {/* Split Screen Second Cap (if compare mode active) */}
            {isCompareMode && (
              <div
                style={{
                  position: "absolute",
                  top: `${14 + offsetY * 0.28}%`,
                  left: "75%",
                  transform: `translateX(-50%) rotate(${tilt}deg) scale(${scale * 0.95})`,
                  width: "60%",
                  aspectRatio: "1/0.75",
                  pointerEvents: "none",
                  zIndex: 25,
                  filter: "drop-shadow(0 16px 20px rgba(0,0,0,0.65))",
                }}
              >
                <Image
                  src={compareCap.image}
                  alt={compareCap.nameEn}
                  fill
                  className="object-contain"
                />
              </div>
            )}

            {/* Floating Live Mirror Snap Action */}
            {isCameraActive && (
              <button
                type="button"
                onClick={captureSnapshot}
                className="absolute bottom-4 z-30 px-4 py-2 rounded-2xl bg-white text-zinc-950 font-display font-bold text-xs uppercase tracking-wider shadow-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"
              >
                <Camera className="w-4 h-4 text-moya-red" />
                <span>{isEs ? "Congelar Foto" : "Freeze Snapshot"}</span>
              </button>
            )}

            {/* Fit Preset Badge */}
            <div className="absolute top-3 left-3 z-30">
              <span className="px-2.5 py-1 rounded-full bg-black/70 backdrop-blur-md text-[10px] font-mono text-white/90 border border-white/10 font-bold uppercase">
                {FIT_PRESETS.find((p) => p.id === activePreset)?.[isEs ? "labelEs" : "labelEn"]}
              </span>
            </div>

            {/* HUD Toggle Tool */}
            <button
              type="button"
              onClick={() => {
                playClick();
                setShowTuningHud(!showTuningHud);
              }}
              className="absolute top-3 right-3 z-30 p-2 rounded-full bg-black/70 backdrop-blur-md text-white/90 border border-white/10 hover:text-moya-red transition-colors"
              title="Tune Fit"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Quick Fit Presets Toolbar */}
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1">
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold shrink-0">
              {isEs ? "ESTILO:" : "FIT STYLE:"}
            </span>
            {FIT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                className={`px-3 py-1 rounded-xl text-xs font-display font-semibold shrink-0 transition-all border ${
                  activePreset === preset.id
                    ? "bg-moya-red text-white border-moya-red shadow-sm"
                    : "glass-dark text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-black/5 dark:border-white/5"
                }`}
              >
                {isEs ? preset.labelEs : preset.labelEn}
              </button>
            ))}
          </div>

          {/* Collapsible Precision Micro-Tuning Sliders */}
          <AnimatePresence>
            {showTuningHud && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="w-full max-w-[420px] p-3.5 rounded-2xl glass-dark border border-black/10 dark:border-white/10 space-y-3 overflow-hidden text-xs"
              >
                <div className="flex items-center justify-between text-[11px] font-mono font-bold text-zinc-500">
                  <span>{isEs ? "AJUSTES DE PRECISIÓN" : "PRECISION FIT CONTROLS"}</span>
                  <button
                    onClick={() => {
                      setOffsetY(0);
                      setScale(1);
                      setTilt(0);
                      setActivePreset("classic");
                    }}
                    className="hover:text-moya-red flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset</span>
                  </button>
                </div>

                {/* Vertical Nudge */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-display">
                    {isEs ? "Altura" : "Height"}
                  </span>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    value={offsetY}
                    onChange={(e) => {
                      setActivePreset("custom");
                      setOffsetY(Number(e.target.value));
                    }}
                    className="w-48 accent-moya-red"
                  />
                  <span className="font-mono text-[10px] w-8 text-right">{offsetY}px</span>
                </div>

                {/* Scale */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-display">
                    {isEs ? "Tamaño" : "Scale"}
                  </span>
                  <input
                    type="range"
                    min="0.85"
                    max="1.25"
                    step="0.01"
                    value={scale}
                    onChange={(e) => {
                      setActivePreset("custom");
                      setScale(Number(e.target.value));
                    }}
                    className="w-48 accent-moya-red"
                  />
                  <span className="font-mono text-[10px] w-8 text-right">{Math.round(scale * 100)}%</span>
                </div>

                {/* Tilt */}
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] text-zinc-600 dark:text-zinc-400 font-display">
                    {isEs ? "Inclinación" : "Tilt"}
                  </span>
                  <input
                    type="range"
                    min="-15"
                    max="15"
                    value={tilt}
                    onChange={(e) => {
                      setActivePreset("custom");
                      setTilt(Number(e.target.value));
                    }}
                    className="w-48 accent-moya-red"
                  />
                  <span className="font-mono text-[10px] w-8 text-right">{tilt}°</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Controls, Colorways & Photo Switcher */}
        <div className="lg:col-span-5 p-4 sm:p-6 bg-white dark:bg-[#0c0c14] flex flex-col justify-between gap-6">
          <div className="space-y-5">
            {/* Input Switcher (Selfie vs Camera vs Samples) */}
            <div className="space-y-2">
              <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold block">
                {isEs ? "TU FOTO O CÁMARA:" : "YOUR PHOTO OR CAMERA:"}
              </span>

              <div className="grid grid-cols-2 gap-2">
                {/* Upload Button */}
                <label className="cursor-pointer py-2.5 px-3 rounded-2xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/10 flex items-center justify-center gap-2 text-xs font-display font-semibold transition-all text-zinc-800 dark:text-zinc-200 active:scale-95">
                  <Upload className="w-3.5 h-3.5 text-moya-red" />
                  <span>{isEs ? "Subir Mi Foto" : "Upload Selfie"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>

                {/* Live Camera Button */}
                <button
                  type="button"
                  onClick={isCameraActive ? stopCamera : startCamera}
                  className={`py-2.5 px-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-display font-semibold transition-all active:scale-95 ${
                    isCameraActive
                      ? "bg-moya-red text-white border-moya-red shadow-md"
                      : "glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border-black/10 dark:border-white/10"
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isCameraActive ? (isEs ? "Apagar Cámara" : "Stop Camera") : (isEs ? "Cámara en Vivo" : "Live Mirror")}</span>
                </button>
              </div>

              {cameraError && (
                <p className="text-[11px] text-rose-500 font-mono mt-1">{cameraError}</p>
              )}

              {/* Sample Model Avatars */}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[10px] font-mono text-zinc-400">
                  {isEs ? "O modelos:" : "Or models:"}
                </span>
                <div className="flex items-center gap-1.5">
                  {SAMPLE_AVATARS.map((avatar) => (
                    <button
                      key={avatar.id}
                      type="button"
                      onClick={() => {
                        playClick();
                        stopCamera();
                        setActivePortrait(avatar.image);
                      }}
                      className={`relative w-8 h-8 rounded-full overflow-hidden border-2 transition-all ${
                        activePortrait === avatar.image
                          ? "border-moya-red ring-2 ring-moya-red/30 scale-105"
                          : "border-black/10 dark:border-white/10 opacity-70 hover:opacity-100"
                      }`}
                      title={avatar.name}
                    >
                      <Image
                        src={avatar.image}
                        alt={avatar.name}
                        fill
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Currently Selected Cap Details */}
            <div className="p-4 rounded-2xl glass-dark border border-black/10 dark:border-white/10 flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono uppercase text-moya-red font-bold">
                  {isEs ? "GORRA EN PRUEBA" : "FITTING COLORWAY"}
                </span>
                <h4 className="font-display font-extrabold text-base text-zinc-900 dark:text-white">
                  {isEs ? selectedCap.nameEs : selectedCap.nameEn}
                </h4>
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
                  <span>${selectedCap.priceUsd}.00 USD</span>
                  <span>•</span>
                  <span>{selectedCap.silhouette}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  className="w-4 h-4 rounded-full border border-white/40 shadow-xs"
                  style={{ backgroundColor: selectedCap.primaryHex }}
                />
                <span
                  className="w-4 h-4 rounded-full border border-white/40 shadow-xs"
                  style={{ backgroundColor: selectedCap.secondaryHex }}
                />
              </div>
            </div>

            {/* 16 Colorways Grid Switcher */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 font-bold uppercase">
                <span>{isEs ? "PROBAR OTRA COMBINACIÓN (16)" : "SWITCH COLORWAY (16)"}</span>
                <span>0880 SERIES</span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-4 gap-2 max-h-[190px] overflow-y-auto pr-1">
                {CAP_VARIANTS.map((c) => {
                  const isSelected = selectedCap.id === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        playClick();
                        setSelectedCap(c);
                      }}
                      className={`relative p-2 rounded-2xl border text-center flex flex-col items-center gap-1 transition-all ${
                        isSelected
                          ? "bg-moya-red/10 border-moya-red ring-2 ring-moya-red/25 shadow-md"
                          : "glass-dark border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15"
                      }`}
                    >
                      <div className="relative w-12 h-10">
                        <Image
                          src={c.image}
                          alt={c.nameEn}
                          fill
                          className="object-contain"
                        />
                      </div>
                      <span className="text-[10px] font-display font-bold text-zinc-800 dark:text-zinc-200 truncate max-w-full">
                        {isEs ? c.nameEs : c.nameEn}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="space-y-2 pt-2 border-t border-black/[0.08] dark:border-white/[0.08]">
            <button
              type="button"
              onClick={() => handleAddToCart(selectedCap)}
              disabled={addedSuccess}
              className={`w-full py-3.5 rounded-2xl font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${
                addedSuccess
                  ? "bg-emerald-600 text-white shadow-emerald-950/30"
                  : "bg-gradient-to-r from-moya-red via-moya-red-deep to-moya-red text-white shadow-moya-red/30 hover:brightness-110"
              }`}
            >
              {addedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>{isEs ? "¡Agregada a tu Bolsa!" : "Added to Bag!"}</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  <span>{isEs ? `Comprar ${selectedCap.nameEs}` : `Claim ${selectedCap.nameEn}`}</span>
                </>
              )}
            </button>

            {/* Download Portrait Action */}
            <button
              type="button"
              onClick={handleDownloadPortrait}
              disabled={isExporting}
              className="w-full py-2.5 rounded-xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 font-display font-semibold text-xs flex items-center justify-center gap-1.5 transition-all border border-black/10 dark:border-white/10"
            >
              <Download className="w-3.5 h-3.5 text-moya-red" />
              <span>
                {isExporting
                  ? isEs
                    ? "Generando Foto..."
                    : "Rendering Card..."
                  : isEs
                  ? "Descargar Foto con Gorra"
                  : "Download Fitting Photo"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
