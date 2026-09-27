"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Scan, X, Layers, CheckCircle2, Eye } from "lucide-react";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { useLocale } from "next-intl";

interface Hotspot {
  id: string;
  xPercent: number; // 0 to 100
  yPercent: number; // 0 to 100
  titleEn: string;
  titleEs: string;
  descEn: string;
  descEs: string;
  metric: string;
}

const CRAFT_HOTSPOTS: Hotspot[] = [
  {
    id: "puff-embroidery",
    xPercent: 50,
    yPercent: 44,
    titleEn: "3D Puff Embroidery",
    titleEs: "Bordado 3D de Alta Densidad",
    descEn: "Raised 3.2mm high-density foam core with 38,000+ tight poly-fill stitches.",
    descEs: "Núcleo de relieve de 3.2mm con más de 38,000 puntadas de hilo reforzado.",
    metric: "3.2mm Depth • 38k Stitches",
  },
  {
    id: "buckram-crown",
    xPercent: 32,
    yPercent: 24,
    titleEn: "6-Panel Buckram Crown",
    titleEs: "Corona Estructurada de 6 Paneles",
    descEn: "Heavyweight fused buckram lining preserving permanent architectural shape.",
    descEs: "Entretela fusionada de alta resistencia que mantiene la forma anatómica original.",
    metric: "100% Wool-Cotton Twill",
  },
  {
    id: "devil-flank",
    xPercent: 78,
    yPercent: 52,
    titleEn: "Devil Pitchfork Flank",
    titleEs: "Bordado Lateral de Diablos",
    descEn: "Dual temple embroidery with high-contrast metallic thread highlights.",
    descEs: "Bordado lateral simétrico con acentos en hilo satinado de alta durabilidad.",
    metric: "Precision Satin Stitch",
  },
  {
    id: "visor-stitch",
    xPercent: 50,
    yPercent: 78,
    titleEn: "Shape-Retention Visor",
    titleEs: "Visera con Memoria de Forma",
    descEn: "8 rows of precision needlework anchored to an indestructible polymer core.",
    descEs: "8 pespuntes de precisión montados sobre núcleo indeformable con memoria.",
    metric: "8-Row Needlework",
  },
];

interface EmbroideryLoupeProps {
  imageSrc: string;
  alt: string;
  activeAngle: string;
  capName: string;
}

export function EmbroideryLoupe({
  imageSrc,
  alt,
  activeAngle,
  capName,
}: EmbroideryLoupeProps) {
  const locale = useLocale();
  const isEs = locale === "es";
  const { playClick, playToggle } = useSoundEffects();

  const containerRef = useRef<HTMLDivElement>(null);
  const [isInspectMode, setIsInspectMode] = useState(false);
  const [lensPos, setLensPos] = useState({ x: 50, y: 50 }); // percentages
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null);
  const [isPointerInside, setIsPointerInside] = useState(false);

  const LENS_SIZE = 190; // px
  const ZOOM_FACTOR = 2.4;

  const handleToggleInspect = () => {
    const next = !isInspectMode;
    setIsInspectMode(next);
    playToggle(next);
    if (!next) {
      setActiveHotspot(null);
    }
  };

  const updateCoordinates = useCallback((clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, clientY - rect.top));

    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;

    setLensPos({ x: xPercent, y: yPercent });
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isInspectMode) return;
    updateCoordinates(e.clientX, e.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isInspectMode || e.touches.length === 0) return;
    const touch = e.touches[0];
    updateCoordinates(touch.clientX, touch.clientY);
  };

  const handleSelectHotspot = (hotspot: Hotspot, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveHotspot(hotspot);
    setLensPos({ x: hotspot.xPercent, y: hotspot.yPercent });
    playClick();
  };

  return (
    <div className="relative w-full select-none">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono tracking-widest uppercase text-zinc-500 dark:text-zinc-400">
            {isInspectMode ? (
              <span className="inline-flex items-center gap-1.5 text-moya-green font-bold">
                <span className="w-2 h-2 rounded-full bg-moya-green animate-ping" />
                {isEs ? "MODO LUPA 3D ACTIVO" : "3D MACRO LOUPE ACTIVE"}
              </span>
            ) : (
              <span>{isEs ? "VISTA ESTÁNDAR" : "STANDARD PREVIEW"}</span>
            )}
          </span>
        </div>

        <button
          type="button"
          onClick={handleToggleInspect}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-display font-semibold transition-all border shadow-sm ${
            isInspectMode
              ? "bg-moya-red text-white border-moya-red shadow-moya-red/25"
              : "glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-zinc-800 dark:text-zinc-200 border-black/10 dark:border-white/10"
          }`}
        >
          <Scan className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
          <span>
            {isInspectMode
              ? isEs
                ? "Cerrar Inspección"
                : "Exit Loupe"
              : isEs
              ? "Inspeccionar Bordado 3D"
              : "Inspect 3D Stitching"}
          </span>
        </button>
      </div>

      {/* Main Interactive Stage */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        onMouseEnter={() => setIsPointerInside(true)}
        onMouseLeave={() => {
          setIsPointerInside(false);
          if (!activeHotspot) {
            setLensPos({ x: 50, y: 50 });
          }
        }}
        className={`relative aspect-square w-full rounded-3xl bg-radial from-zinc-100 to-zinc-200 dark:from-zinc-900/80 dark:to-[#0a0a0f] border border-black/[0.08] dark:border-white/[0.08] p-4 sm:p-8 flex items-center justify-center overflow-hidden transition-all ${
          isInspectMode ? "cursor-crosshair shadow-2xl ring-2 ring-moya-red/40" : ""
        }`}
      >
        {/* Subtle grid background lines for studio caliper look */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        {/* Base Cap Image */}
        <div className="relative w-full h-full max-w-[440px] max-h-[440px] flex items-center justify-center">
          <Image
            src={imageSrc}
            alt={alt}
            fill
            priority
            sizes="(max-width: 768px) 100vw, 550px"
            className="object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.35)] transition-all duration-300"
          />
        </div>

        {/* Hotspot Markers when in inspect mode */}
        {isInspectMode && (
          <div className="absolute inset-0 pointer-events-none">
            {CRAFT_HOTSPOTS.map((spot) => {
              const isSelected = activeHotspot?.id === spot.id;
              return (
                <button
                  key={spot.id}
                  type="button"
                  onClick={(e) => handleSelectHotspot(spot, e)}
                  style={{ left: `${spot.xPercent}%`, top: `${spot.yPercent}%` }}
                  className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 group"
                >
                  <span className="relative flex h-6 w-6 items-center justify-center">
                    <span
                      className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                        isSelected ? "bg-moya-red" : "bg-moya-green"
                      }`}
                    />
                    <span
                      className={`relative inline-flex rounded-full h-4 w-4 border-2 border-white dark:border-[#09090c] shadow-lg items-center justify-center text-[8px] font-bold text-white transition-transform group-hover:scale-125 ${
                        isSelected ? "bg-moya-red" : "bg-moya-green"
                      }`}
                    >
                      ✦
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Floating Loupe Lens */}
        {isInspectMode && (isPointerInside || activeHotspot) && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            style={{
              left: `${lensPos.x}%`,
              top: `${lensPos.y}%`,
              width: `${LENS_SIZE}px`,
              height: `${LENS_SIZE}px`,
              transform: "translate(-50%, -50%)",
            }}
            className="pointer-events-none absolute z-30 rounded-full border-2 border-white/80 dark:border-zinc-200/80 shadow-[0_0_50px_rgba(0,0,0,0.6),0_0_20px_rgba(225,29,72,0.4)] overflow-hidden backdrop-blur-xs ring-4 ring-black/20"
          >
            {/* Magnified Image Container */}
            <div
              style={{
                width: `${LENS_SIZE}px`,
                height: `${LENS_SIZE}px`,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  backgroundImage: `url(${imageSrc})`,
                  backgroundSize: `${ZOOM_FACTOR * 100}%`,
                  backgroundPosition: `${lensPos.x}% ${lensPos.y}%`,
                  backgroundRepeat: "no-repeat",
                  position: "absolute",
                  inset: 0,
                }}
              />

              {/* Dynamic Specular Thread Sheen Reflection */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: `radial-gradient(circle at ${lensPos.x}% ${lensPos.y}%, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0.08) 45%, transparent 70%)`,
                  mixBlendMode: "overlay",
                  pointerEvents: "none",
                }}
              />

              {/* Caliper Crosshairs */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-40">
                <div className="w-full h-px bg-white/60" />
                <div className="h-full w-px bg-white/60 absolute" />
                <div className="w-8 h-8 rounded-full border border-white/80 absolute" />
              </div>

              {/* HUD Badge inside the lens */}
              <div className="absolute bottom-2 inset-x-0 flex justify-center">
                <span className="px-2 py-0.5 rounded-full bg-black/75 text-[9px] font-mono font-bold text-white tracking-wider backdrop-blur-xs border border-white/20">
                  {ZOOM_FACTOR}x MACRO
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {/* Hotspot Card Overlay when selected */}
        <AnimatePresence>
          {isInspectMode && activeHotspot && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              className="absolute bottom-4 inset-x-4 sm:inset-x-8 z-40 p-3.5 rounded-2xl glass-dark border border-white/20 shadow-2xl backdrop-blur-md flex items-center justify-between gap-4"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-moya-red/20 text-moya-red flex items-center justify-center shrink-0 border border-moya-red/30">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-display font-bold text-sm text-zinc-900 dark:text-white">
                      {isEs ? activeHotspot.titleEs : activeHotspot.titleEn}
                    </h4>
                    <span className="px-2 py-0.5 rounded-md bg-zinc-200 dark:bg-white/10 text-[10px] font-mono text-zinc-700 dark:text-zinc-300">
                      {activeHotspot.metric}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">
                    {isEs ? activeHotspot.descEs : activeHotspot.descEn}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveHotspot(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Craftsmanship Highlights Bar below viewer */}
      {isInspectMode && (
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CRAFT_HOTSPOTS.map((spot) => (
            <button
              key={spot.id}
              type="button"
              onClick={(e) => handleSelectHotspot(spot, e)}
              className={`p-2 rounded-xl text-left transition-all border ${
                activeHotspot?.id === spot.id
                  ? "bg-moya-red/10 border-moya-red text-moya-red"
                  : "glass-dark border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15"
              }`}
            >
              <p className="text-[11px] font-display font-bold truncate">
                {isEs ? spot.titleEs : spot.titleEn}
              </p>
              <p className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate">
                {spot.metric}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
