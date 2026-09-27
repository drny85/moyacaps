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
  Eye,
  Palette,
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
  { id: "classic", labelEn: "Classic Fit", labelEs: "Corte Clásico", offsetX: 0, offsetY: 0, scale: 1, tilt: 0, tiltX: 0 },
  { id: "low-brow", labelEn: "Low Brow", labelEs: "Ajuste Ceja", offsetX: 0, offsetY: 8, scale: 1.02, tilt: 0, tiltX: 4 },
  { id: "high-crown", labelEn: "Crown High", labelEs: "Corona Alta", offsetX: 0, offsetY: -8, scale: 0.96, tilt: -2, tiltX: -6 },
  { id: "slant", labelEn: "Street Slant", labelEs: "Inclinado", offsetX: 5, offsetY: 1, scale: 1.01, tilt: 7, tiltX: 2 },
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
  const [offsetX, setOffsetX] = useState(tryOnSettings.offsetX || 0);
  const [offsetY, setOffsetY] = useState(tryOnSettings.offsetY || 0);
  const [scale, setScale] = useState(tryOnSettings.scale || 1);
  const [tilt, setTilt] = useState(tryOnSettings.tilt || 0);
  const [tiltX, setTiltX] = useState(tryOnSettings.tiltX || 0);
  const [showTuningHud, setShowTuningHud] = useState(false);

  const [activePreset, setActivePreset] = useState<string>("classic");
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showCapOverlay, setShowCapOverlay] = useState(true);

  // Hidden canvas for download export
  const exportCanvasRef = useRef<HTMLCanvasElement>(null);

  // Update store settings on changes
  useEffect(() => {
    setTryOnSettings({ offsetX, offsetY, scale, tilt, tiltX });
  }, [offsetX, offsetY, scale, tilt, tiltX, setTryOnSettings]);

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
    setOffsetX(preset.offsetX);
    setOffsetY(preset.offsetY);
    setScale(preset.scale);
    setTilt(preset.tilt);
    setTiltX(preset.tiltX);
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
      // Cap Anchor Center — matches the on-screen overlay (brim at forehead)
      const capWidth = 480 * scale;
      const capHeight = 384 * scale;
      const centerX = 540 + offsetX * 2.5;
      const centerY = 195 + offsetY * 2.2;

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

  // Navigate Colorways
  const navigateColorway = (direction: "prev" | "next") => {
    playClick();
    const idx = CAP_VARIANTS.findIndex((c) => c.id === selectedCap.id);
    const nextIdx =
      direction === "next"
        ? (idx + 1) % CAP_VARIANTS.length
        : (idx - 1 + CAP_VARIANTS.length) % CAP_VARIANTS.length;
    setSelectedCap(CAP_VARIANTS[nextIdx]);
  };

  return (
    <div className="relative w-full max-w-6xl mx-auto rounded-3xl bg-white dark:bg-[#0a0a12] border border-black/[0.06] dark:border-white/[0.06] shadow-2xl overflow-hidden flex flex-col select-none">
      {/* Hidden export canvas */}
      <canvas ref={exportCanvasRef} className="hidden" />

      {/* ── Compact Header Bar ── */}
      <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-black/[0.06] dark:border-white/[0.06] bg-gradient-to-r from-white via-white to-rose-50/30 dark:from-[#0a0a12] dark:via-[#0a0a12] dark:to-rose-950/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-moya-red to-rose-600 p-0.5 flex items-center justify-center shadow-lg shadow-moya-red/20 text-white shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono tracking-widest uppercase text-moya-red font-bold">
                {isEs ? "PROBADOR VIRTUAL" : "VIRTUAL MIRROR"}
              </span>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-mono font-bold items-center gap-1 border border-emerald-500/20">
                <Lock className="w-2.5 h-2.5" />
                {isEs ? "Privado" : "On-Device"}
              </span>
            </div>
            <h2 className="font-display font-bold text-base sm:text-lg text-zinc-900 dark:text-white leading-tight truncate">
              {isEs ? "Pruébate Cada Gorra" : "Try On Each Cap"}
            </h2>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Toggle Overlay */}
          <button
            type="button"
            onClick={() => {
              playClick();
              setShowCapOverlay(!showCapOverlay);
            }}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-display font-semibold transition-all border ${
              showCapOverlay
                ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent"
                : "glass-dark text-zinc-500 border-black/[0.06] dark:border-white/[0.06]"
            }`}
            title={isEs ? "Mostrar/Ocultar Gorra" : "Toggle Cap Overlay"}
          >
            <Eye className="w-3 h-3" />
          </button>

          {/* Compare Toggle */}
          <button
            type="button"
            onClick={() => {
              playClick();
              setIsCompareMode(!isCompareMode);
            }}
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-display font-semibold transition-all border ${
              isCompareMode
                ? "bg-moya-red text-white border-moya-red"
                : "glass-dark text-zinc-500 border-black/[0.06] dark:border-white/[0.06]"
            }`}
          >
            <Columns className="w-3 h-3" />
            <span>{isEs ? "Comparar" : "Compare"}</span>
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

      {/* ── Main Studio Viewport ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 lg:max-h-[calc(100vh-180px)]">
        {/* ═══ Left Column: Live Portrait Stage ═══ */}
        <div className="lg:col-span-7 p-3 sm:p-5 bg-gradient-to-b from-zinc-100 to-zinc-50 dark:from-[#08080e] dark:to-[#0a0a14] flex flex-col items-center gap-3 border-b lg:border-b-0 lg:border-r border-black/[0.06] dark:border-white/[0.06] overflow-y-auto">
          {/* ── Portrait Mirror Stage ── */}
          <div className="relative w-full max-w-[380px] aspect-square rounded-2xl overflow-hidden bg-zinc-900 shadow-2xl shadow-black/30 border border-white/[0.06] flex items-center justify-center group">
            {/* Subtle vignette overlay */}
            <div className="absolute inset-0 z-10 pointer-events-none rounded-2xl shadow-[inset_0_0_60px_rgba(0,0,0,0.15)]" />

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

            {/* Cap A Overlay — anchored so brim sits at forehead */}
            {showCapOverlay && (
              <motion.div
                key={selectedCap.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="absolute inset-0 pointer-events-none"
                style={{ zIndex: 20 }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: `${1 + offsetY * 0.28}%`,
                    left: `${50 + offsetX * 0.35}%`,
                    transform: `translateX(-50%) perspective(400px) rotateX(${tiltX}deg) rotate(${tilt}deg) scale(${scale})`,
                    width: "48%",
                    maxWidth: "260px",
                    aspectRatio: "1/0.80",
                    pointerEvents: "none",
                    transition: "transform 0.12s ease-out, top 0.12s ease-out, left 0.12s ease-out",
                    filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.5))",
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
              </motion.div>
            )}

            {/* Split Screen Second Cap (if compare mode active) */}
            {isCompareMode && showCapOverlay && (
              <div
                style={{
                  position: "absolute",
                  top: `${1 + offsetY * 0.28}%`,
                  left: `${70 + offsetX * 0.35}%`,
                  transform: `translateX(-50%) perspective(400px) rotateX(${tiltX}deg) rotate(${tilt}deg) scale(${scale * 0.90})`,
                  width: "40%",
                  aspectRatio: "1/0.80",
                  pointerEvents: "none",
                  zIndex: 25,
                  filter: "drop-shadow(0 10px 18px rgba(0,0,0,0.5))",
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
              <motion.button
                type="button"
                onClick={captureSnapshot}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-4 z-30 px-4 py-2.5 rounded-2xl bg-white/95 backdrop-blur-sm text-zinc-950 font-display font-bold text-xs uppercase tracking-wider shadow-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
              >
                <Camera className="w-4 h-4 text-moya-red" />
                <span>{isEs ? "Capturar Foto" : "Take Snapshot"}</span>
              </motion.button>
            )}

            {/* Fit Preset Badge */}
            <div className="absolute top-3 left-3 z-30">
              <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] font-mono text-white/80 border border-white/[0.08] font-bold uppercase tracking-wide">
                {FIT_PRESETS.find((p) => p.id === activePreset)?.[isEs ? "labelEs" : "labelEn"] ?? (isEs ? "Personalizado" : "Custom")}
              </span>
            </div>

            {/* HUD Toggle Tool */}
            <button
              type="button"
              onClick={() => {
                playClick();
                setShowTuningHud(!showTuningHud);
              }}
              className={`absolute top-3 right-3 z-30 p-2 rounded-full backdrop-blur-md border transition-all ${
                showTuningHud
                  ? "bg-moya-red/90 text-white border-moya-red/50"
                  : "bg-black/50 text-white/80 border-white/[0.08] hover:text-white"
              }`}
              title="Tune Fit"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>

            {/* Quick Colorway Prev/Next (Overlay Controls) */}
            <div className="absolute inset-y-0 left-0 right-0 z-20 flex items-center justify-between px-1.5 pointer-events-none">
              <button
                type="button"
                onClick={() => navigateColorway("prev")}
                className="pointer-events-auto p-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => navigateColorway("next")}
                className="pointer-events-auto p-1.5 rounded-full bg-black/40 backdrop-blur-sm text-white/70 hover:text-white hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ── Quick Fit Presets ── */}
          <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto max-w-full scrollbar-hide">
            {FIT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handleApplyPreset(preset)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-display font-semibold shrink-0 transition-all border ${
                  activePreset === preset.id
                    ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent shadow-sm"
                    : "bg-white dark:bg-white/5 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border-black/[0.06] dark:border-white/[0.06]"
                }`}
              >
                {isEs ? preset.labelEs : preset.labelEn}
              </button>
            ))}
          </div>

          {/* ── Collapsible Precision Micro-Tuning Sliders ── */}
          <AnimatePresence>
            {showTuningHud && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-[380px] overflow-hidden"
              >
                <div className="p-3.5 rounded-2xl bg-white dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] space-y-2.5">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                    <span>{isEs ? "Ajustes de Precisión" : "Precision Fit"}</span>
                    <button
                      onClick={() => {
                        setOffsetX(0);
                        setOffsetY(0);
                        setScale(1);
                        setTilt(0);
                        setTiltX(0);
                        setActivePreset("classic");
                      }}
                      className="hover:text-moya-red flex items-center gap-1 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </button>
                  </div>

                  {/* Sliders Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {/* Horizontal Nudge */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-display">{isEs ? "Lateral" : "Shift"}</span>
                        <span className="font-mono text-[9px] text-zinc-400 tabular-nums">{offsetX}px</span>
                      </div>
                      <input
                        type="range"
                        min="-30"
                        max="30"
                        value={offsetX}
                        onChange={(e) => { setActivePreset("custom"); setOffsetX(Number(e.target.value)); }}
                        className="w-full accent-moya-red h-1"
                      />
                    </div>

                    {/* Vertical Nudge */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-display">{isEs ? "Altura" : "Height"}</span>
                        <span className="font-mono text-[9px] text-zinc-400 tabular-nums">{offsetY}px</span>
                      </div>
                      <input
                        type="range"
                        min="-40"
                        max="40"
                        value={offsetY}
                        onChange={(e) => { setActivePreset("custom"); setOffsetY(Number(e.target.value)); }}
                        className="w-full accent-moya-red h-1"
                      />
                    </div>

                    {/* Scale */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-display">{isEs ? "Tamaño" : "Scale"}</span>
                        <span className="font-mono text-[9px] text-zinc-400 tabular-nums">{Math.round(scale * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.01"
                        value={scale}
                        onChange={(e) => { setActivePreset("custom"); setScale(Number(e.target.value)); }}
                        className="w-full accent-moya-red h-1"
                      />
                    </div>

                    {/* Tilt */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-display">{isEs ? "Ángulo" : "Tilt"}</span>
                        <span className="font-mono text-[9px] text-zinc-400 tabular-nums">{tilt}°</span>
                      </div>
                      <input
                        type="range"
                        min="-15"
                        max="15"
                        value={tilt}
                        onChange={(e) => { setActivePreset("custom"); setTilt(Number(e.target.value)); }}
                        className="w-full accent-moya-red h-1"
                      />
                    </div>

                    {/* Vertical Tilt (Pitch) */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-zinc-500 font-display">{isEs ? "Frente" : "Pitch"}</span>
                        <span className="font-mono text-[9px] text-zinc-400 tabular-nums">{tiltX}°</span>
                      </div>
                      <input
                        type="range"
                        min="-25"
                        max="25"
                        value={tiltX}
                        onChange={(e) => { setActivePreset("custom"); setTiltX(Number(e.target.value)); }}
                        className="w-full accent-moya-red h-1"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ═══ Right Column: Controls, Colorways & Photo Switcher ═══ */}
        <div className="lg:col-span-5 bg-white dark:bg-[#0a0a12] flex flex-col lg:max-h-[calc(100vh-180px)] overflow-y-auto">
          <div className="p-4 sm:p-5 space-y-4 flex-1">
            {/* ── Photo Input Switcher ── */}
            <div className="space-y-2.5">
              <span className="text-[10px] font-mono uppercase text-zinc-400 font-bold tracking-wider block">
                {isEs ? "Elige Tu Foto" : "Choose Your Photo"}
              </span>

              <div className="grid grid-cols-2 gap-2">
                {/* Upload Button */}
                <label className="cursor-pointer py-2.5 px-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] hover:bg-zinc-100 dark:hover:bg-white/[0.06] border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-center gap-2 text-xs font-display font-semibold transition-all text-zinc-700 dark:text-zinc-300 active:scale-[0.97]">
                  <Upload className="w-3.5 h-3.5 text-moya-red" />
                  <span>{isEs ? "Subir Selfie" : "Upload Selfie"}</span>
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
                  className={`py-2.5 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-display font-semibold transition-all active:scale-[0.97] ${
                    isCameraActive
                      ? "bg-moya-red text-white border-moya-red shadow-md shadow-moya-red/20"
                      : "bg-zinc-50 dark:bg-white/[0.03] hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 border-black/[0.06] dark:border-white/[0.06]"
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isCameraActive ? (isEs ? "Detener" : "Stop") : (isEs ? "Cámara" : "Camera")}</span>
                </button>
              </div>

              {cameraError && (
                <p className="text-[11px] text-rose-500 font-mono">{cameraError}</p>
              )}

              {/* Sample Model Avatars */}
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-mono text-zinc-400 shrink-0">
                  {isEs ? "Modelos:" : "Models:"}
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
                      className={`relative w-9 h-9 rounded-full overflow-hidden border-2 transition-all ${
                        activePortrait === avatar.image
                          ? "border-moya-red ring-2 ring-moya-red/20 scale-110"
                          : "border-zinc-200 dark:border-white/10 opacity-60 hover:opacity-100 hover:scale-105"
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

            {/* ── Currently Selected Cap Card ── */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-zinc-50 to-white dark:from-white/[0.03] dark:to-white/[0.02] border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {/* Cap Thumbnail */}
                <div className="relative w-12 h-10 shrink-0">
                  <Image
                    src={selectedCap.image}
                    alt={selectedCap.nameEn}
                    fill
                    className="object-contain drop-shadow-md"
                  />
                </div>
                <div className="min-w-0">
                  <h4 className="font-display font-extrabold text-sm text-zinc-900 dark:text-white truncate">
                    {isEs ? selectedCap.nameEs : selectedCap.nameEn}
                  </h4>
                  <div className="flex items-center gap-2 text-[11px] font-mono text-zinc-400">
                    <span>${selectedCap.priceUsd}.00</span>
                    <span className="text-zinc-300 dark:text-zinc-600">•</span>
                    <span className="capitalize">{selectedCap.silhouette}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <span
                  className="w-4 h-4 rounded-full border border-white/30 shadow-sm"
                  style={{ backgroundColor: selectedCap.primaryHex }}
                />
                <span
                  className="w-4 h-4 rounded-full border border-white/30 shadow-sm"
                  style={{ backgroundColor: selectedCap.secondaryHex }}
                />
              </div>
            </div>

            {/* ── 16 Colorways Grid ── */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-zinc-400 font-bold uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <Palette className="w-3 h-3 text-moya-red" />
                  <span>{isEs ? "Colección Completa" : "All Colorways"}</span>
                </div>
                <span className="text-zinc-300 dark:text-zinc-600">16 / 0880</span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 max-h-[200px] lg:max-h-[180px] overflow-y-auto pr-0.5 scrollbar-thin">
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
                      className={`relative p-1.5 rounded-xl border text-center flex flex-col items-center gap-0.5 transition-all ${
                        isSelected
                          ? "bg-moya-red/8 border-moya-red/50 ring-1 ring-moya-red/20 shadow-sm"
                          : "bg-zinc-50 dark:bg-white/[0.02] border-black/[0.04] dark:border-white/[0.04] hover:border-black/10 dark:hover:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="relative w-10 h-8">
                        <Image
                          src={c.image}
                          alt={c.nameEn}
                          fill
                          className="object-contain"
                        />
                      </div>
                      <span className={`text-[9px] font-display font-bold truncate max-w-full leading-tight ${
                        isSelected ? "text-moya-red" : "text-zinc-600 dark:text-zinc-400"
                      }`}>
                        {(isEs ? c.nameEs : c.nameEn).split(" / ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ── Primary Action Buttons (Sticky Bottom) ── */}
          <div className="p-4 sm:p-5 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] bg-white dark:bg-[#0a0a12] space-y-2">
            <button
              type="button"
              onClick={() => handleAddToCart(selectedCap)}
              disabled={addedSuccess}
              className={`w-full py-3 rounded-2xl font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.97] ${
                addedSuccess
                  ? "bg-emerald-600 text-white shadow-emerald-500/20"
                  : "bg-gradient-to-r from-moya-red via-rose-600 to-moya-red-deep text-white shadow-moya-red/25 hover:shadow-moya-red/40 hover:brightness-110"
              }`}
            >
              {addedSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>{isEs ? "¡Agregada!" : "Added to Bag!"}</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-4 h-4" />
                  <span>{isEs ? `Comprar ${selectedCap.nameEs.split(" / ")[0]}` : `Claim ${selectedCap.nameEn.split(" / ")[0]}`}</span>
                </>
              )}
            </button>

            {/* Download Portrait Action */}
            <button
              type="button"
              onClick={handleDownloadPortrait}
              disabled={isExporting}
              className="w-full py-2 rounded-xl bg-zinc-50 dark:bg-white/[0.03] hover:bg-zinc-100 dark:hover:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-display font-semibold text-[11px] flex items-center justify-center gap-1.5 transition-all border border-black/[0.06] dark:border-white/[0.06]"
            >
              <Download className="w-3 h-3 text-moya-red" />
              <span>
                {isExporting
                  ? isEs
                    ? "Generando..."
                    : "Rendering..."
                  : isEs
                  ? "Descargar Foto"
                  : "Download Fitting Card"}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
