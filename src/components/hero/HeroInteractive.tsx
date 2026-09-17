"use client";

import { useTranslations } from "next-intl";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { Sparkles, ArrowRight, ShieldCheck, CheckCircle2, RotateCw, Pause, Play, ChevronDown, Check } from "lucide-react";
import Image from "next/image";
import { useState, useEffect, useCallback, useRef } from "react";
import { useStore } from "@/store/useStore";
import { CAP_VARIANTS } from "@/data/caps";

const ANGLES = [
  { key: "front", label: "Front" },
  { key: "left", label: "Left Devil" },
  { key: "back", label: "0880 Back" },
  { key: "right", label: "Right Devil" },
] as const;

/** Featured colorways for quick-swap in hero */
const HERO_COLORWAYS = CAP_VARIANTS.filter((c) => c.isFeatured || c.stock <= 8).slice(0, 5);
// Fallback: if not enough, take first 5
const QUICK_SWAP_CAPS = HERO_COLORWAYS.length >= 3 ? HERO_COLORWAYS : CAP_VARIANTS.slice(0, 5);

export function HeroInteractive() {
  const t = useTranslations("hero");
  const { addToCart, currency, cart } = useStore();
  const [activeAngle, setActiveAngle] = useState<number>(0);
  const [isSpinning, setIsSpinning] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [activeCap, setActiveCap] = useState(CAP_VARIANTS[0]);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const inCartItem = isMounted ? cart.find((i) => i.id === activeCap.id) : undefined;
  const inCartQty = inCartItem?.quantity || 0;
  const isInCart = inCartQty > 0;

  const currentAngle = ANGLES[activeAngle];

  // Parallax scroll transforms
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  });
  const orbY1 = useTransform(scrollYProgress, [0, 1], [0, -120]);
  const orbY2 = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const orbY3 = useTransform(scrollYProgress, [0, 1], [0, -200]);

  // Auto-spin timer (merged from TurntableStudio)
  useEffect(() => {
    if (!isSpinning || isPaused) return;
    const interval = setInterval(() => {
      setActiveAngle((prev) => (prev + 1) % ANGLES.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [isSpinning, isPaused]);

  // Reset image loaded state on cap/angle change
  useEffect(() => {
    setImageLoaded(false);
  }, [activeCap.id, activeAngle]);

  const handleAngleClick = useCallback((idx: number) => {
    setActiveAngle(idx);
    setIsSpinning(false);
  }, []);

  const toggleSpin = useCallback(() => {
    if (!isSpinning) {
      setIsSpinning(true);
      setIsPaused(false);
    } else {
      setIsPaused((p) => !p);
    }
  }, [isSpinning]);

  const handleColorwaySwap = useCallback((cap: typeof CAP_VARIANTS[0]) => {
    setActiveCap(cap);
    setActiveAngle(0);
    setIsSpinning(true);
    setIsPaused(false);
  }, []);

  // For the hero, use cap-specific angle images if flagship, otherwise cap main image
  const capImageSrc = activeCap.id === "negro-rojo"
    ? `/caps/angles/${currentAngle.key}.png`
    : activeCap.image;

  return (
    <section id="interactive-studio" ref={sectionRef} className="relative overflow-hidden px-4 sm:px-6 lg:px-8 pt-10 sm:pt-16 pb-16 sm:pb-24">
      {/* ── Parallax Ambient Background ── */}
      <motion.div style={isMounted ? { y: orbY1 } : undefined} className="ambient-orb top-[10%] left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-moya-red/20 animate-glow-pulse" />
      <motion.div style={isMounted ? { y: orbY2 } : undefined} className="ambient-orb top-[30%] left-[15%] w-[400px] h-[400px] bg-moya-violet/10 animate-glow-pulse" />
      <motion.div style={isMounted ? { y: orbY3 } : undefined} className="ambient-orb bottom-[10%] right-[10%] w-[350px] h-[350px] bg-moya-green/10 animate-glow-pulse" />

      {/* ── Texture Overlay ── */}
      <div className="absolute inset-0 texture-lines pointer-events-none" />

      <div className="relative max-w-7xl mx-auto w-full flex flex-col items-center text-center z-10">
        {/* ── Sticker Badge ── */}
        <motion.div
          initial={{ opacity: 0, y: 20, rotate: -5 }}
          animate={{ opacity: 1, y: 0, rotate: -2 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="sticker-badge sticker-badge--red mb-6 sm:mb-8 animate-float-badge"
        >
          <Sparkles className="w-3 h-3" />
          <span>{t("badge")}</span>
        </motion.div>

        {/* ── Oversized Headline ── */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="font-display text-5xl sm:text-7xl lg:text-[5.5rem] xl:text-[6.5rem] font-bold tracking-tight leading-[0.95] mb-4 sm:mb-6"
        >
          {t("titlePrefix")}{" "}
          <span className="text-gradient-moya inline-block">
            {t("titleHighlight")}
          </span>
        </motion.h1>

        {/* ── Subtitle ── */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="text-sm sm:text-lg text-zinc-400 max-w-2xl mx-auto mb-8 sm:mb-10 leading-relaxed"
        >
          {t("subtitle")}
        </motion.p>

        {/* ── Cap Showcase (Full-bleed centerpiece) ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          className="relative w-full max-w-[540px] aspect-square mx-auto mb-6"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Pedestal glow — uses cap's primary color */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[80%] h-20 rounded-full blur-[60px] pointer-events-none transition-colors duration-700"
            style={{ backgroundColor: `${activeCap.primaryHex}33` }}
          />

          {/* Floating spec badges */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.8 }}
            className="absolute top-[15%] -left-2 sm:left-0 lg:-left-8 z-20 glass-dark px-3 py-2 rounded-xl text-[10px] sm:text-xs font-semibold text-zinc-200 flex items-center gap-2 shadow-xl max-w-[140px] sm:max-w-none"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-moya-green shrink-0" />
            <span>{t("specs.embroidery")}</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 1.0 }}
            className="absolute top-[25%] -right-2 sm:right-0 lg:-right-8 z-20 glass-dark px-3 py-2 rounded-xl text-[10px] sm:text-xs font-semibold text-zinc-200 flex items-center gap-2 shadow-xl max-w-[140px] sm:max-w-none"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-moya-red-light shrink-0" />
            <span>{t("specs.edition")}</span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            className="absolute bottom-[12%] -left-2 sm:left-4 lg:-left-4 z-20 glass-dark px-3 py-2 rounded-xl text-[10px] sm:text-xs font-semibold text-zinc-200 flex items-center gap-2 shadow-xl max-w-[140px] sm:max-w-none"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-moya-violet shrink-0" />
            <span>{t("specs.closure")}</span>
          </motion.div>

          {/* In Bag Indicator */}
          {isInCart && (
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 glass-dark border border-emerald-500/40 px-2.5 py-1.5 rounded-full text-[10px] font-display font-semibold text-emerald-400 shadow-lg shadow-emerald-950/40 animate-pulse">
              <Check className="w-3 h-3 text-emerald-400" />
              <span>{t("inCart")} ({inCartQty})</span>
            </div>
          )}

          {/* Active angle indicator */}
          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 glass-dark px-2.5 py-1.5 rounded-full text-[10px] font-display font-semibold text-zinc-300">
            <RotateCw className="w-3 h-3 text-moya-red animate-spin-slow" />
            <span className="capitalize">{currentAngle.label}</span>
          </div>

          {/* Cap image with crossfade + skeleton */}
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Skeleton shimmer (shows while loading) */}
            {!imageLoaded && (
              <div className="absolute inset-[15%] skeleton rounded-3xl" />
            )}

            <AnimatePresence mode="wait">
              <motion.div
                key={`${activeCap.id}-${currentAngle.key}`}
                initial={{ opacity: 0, scale: 0.92, rotateY: 15 }}
                animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                exit={{ opacity: 0, scale: 1.05, rotateY: -15 }}
                transition={{ duration: 0.4, ease: "easeInOut" }}
                className="relative w-full h-full"
              >
                <Image
                  src={capImageSrc}
                  alt={`Moya Cap Good Luck 0880 - ${activeCap.nameEn} - ${currentAngle.label}`}
                  fill
                  className="object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.9)] select-none"
                  priority
                  onLoad={() => setImageLoaded(true)}
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>

        {/* ── Colorway Quick-Swap ── */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="flex items-center gap-2 mb-4"
        >
          <span className="text-[10px] font-display font-semibold text-zinc-600 uppercase tracking-wider mr-1">
            {t("colorway")}
          </span>
          {QUICK_SWAP_CAPS.map((cap) => {
            const capInCart = isMounted && cart.some((i) => i.id === cap.id);
            return (
              <button
                key={cap.id}
                onClick={() => handleColorwaySwap(cap)}
                className={`group relative w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-all duration-300 ${
                  activeCap.id === cap.id
                    ? "ring-2 ring-moya-red ring-offset-2 ring-offset-[#06060a] scale-110"
                    : "hover:scale-110 hover:ring-1 hover:ring-white/30 hover:ring-offset-1 hover:ring-offset-[#06060a]"
                }`}
                title={cap.nameEn}
              >
                <span
                  className="block w-full h-full rounded-full border-2 border-white/20 shadow-md"
                  style={{
                    background: `linear-gradient(135deg, ${cap.primaryHex} 50%, ${cap.secondaryHex} 50%)`,
                  }}
                />
                {capInCart && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border border-[#06060a] flex items-center justify-center text-[8px] font-bold text-black shadow-sm">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </motion.div>

        {/* ── Angle Controls ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.6 }}
          className="flex items-center gap-2 sm:gap-3 mb-8 sm:mb-10"
        >
          {ANGLES.map((ang, idx) => (
            <button
              key={ang.key}
              onClick={() => handleAngleClick(idx)}
              className={`px-3 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-display font-semibold transition-all ${
                activeAngle === idx
                  ? "bg-moya-red text-white shadow-lg shadow-moya-red-deep/60 scale-105"
                  : "glass-pill text-zinc-500 hover:text-white hover:bg-white/10"
              }`}
            >
              {ang.label}
            </button>
          ))}

          <button
            onClick={toggleSpin}
            className="p-2 rounded-xl glass-pill text-zinc-500 hover:text-white hover:bg-white/10 transition-colors ml-1"
            title={isSpinning && !isPaused ? "Pause auto-spin" : "Play auto-spin"}
          >
            {isSpinning && !isPaused ? (
              <Pause className="w-3.5 h-3.5 text-moya-green" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
          </button>
        </motion.div>

        {/* ── CTAs ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 w-full sm:w-auto"
        >
          <a
            href="#catalog"
            className="px-8 py-4 rounded-2xl bg-moya-red hover:bg-rose-500 text-white font-display font-bold text-sm sm:text-base shadow-xl shadow-moya-red-deep/50 transition-all hover:scale-[1.03] hover:shadow-2xl active:scale-95 flex items-center justify-center gap-2.5 group"
          >
            <span>{t("ctaShop")}</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
          </a>

          {isInCart ? (
            <button
              onClick={() => addToCart(activeCap)}
              className="px-6 py-4 rounded-2xl bg-emerald-600/20 hover:bg-emerald-600/30 active:bg-emerald-600/40 text-emerald-300 font-display font-semibold text-sm sm:text-base transition-all hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-2.5 border border-emerald-500/40 shadow-lg shadow-emerald-950/40"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{t("inCartCta", { count: inCartQty })}</span>
              <span className="text-emerald-400 font-mono font-bold">
                {currency === "USD" ? `$${activeCap.priceUsd}` : `$${activeCap.priceMxn} MXN`}
              </span>
            </button>
          ) : (
            <button
              onClick={() => addToCart(activeCap)}
              className="px-6 py-4 rounded-2xl glass-dark hover:bg-white/10 text-white font-display font-semibold text-sm sm:text-base transition-all hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-2.5 border border-white/10 hover:border-white/20"
            >
              <span>{t("ctaClaim")}</span>
              <span className="text-moya-green-light font-mono font-bold">
                {currency === "USD" ? `$${activeCap.priceUsd}` : `$${activeCap.priceMxn} MXN`}
              </span>
            </button>
          )}
        </motion.div>
      </div>

      {/* ── Scroll Down Indicator ── */}
      <div className="scroll-indicator text-zinc-500">
        <ChevronDown className="w-6 h-6" />
      </div>
    </section>
  );
}
