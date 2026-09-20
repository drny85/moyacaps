"use client";

import { useTranslations } from "next-intl";
import { motion, useScroll, useTransform, useSpring, useMotionValue } from "framer-motion";
import { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Sparkles, Layers, ShieldCheck, Flame, CheckCircle2, ChevronDown, Compass } from "lucide-react";

export function AnatomyParallax() {
  const t = useTranslations("anatomy");
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMounted, setIsMounted] = useState(false);

  // High-performance MotionValues for 3D mouse tilt (ZERO React re-renders)
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [7, -7]), { stiffness: 140, damping: 20 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-9, 9]), { stiffness: 140, damping: 20 });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      mouseX.set(x);
      mouseY.set(y);
    },
    [mouseX, mouseY]
  );

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  // Tuned physics spring for natural scroll feel
  const smoothProgress = useSpring(scrollYProgress, {
    stiffness: 140,
    damping: 26,
    restDelta: 0.0005,
  });

  // ── Background & Watermark Parallax ──
  const bgTextY = useTransform(smoothProgress, [0, 1], [80, -80]);
  const bgTextScale = useTransform(smoothProgress, [0, 0.5, 1], [0.92, 1.12, 0.95]);
  const bgTextOpacity = useTransform(smoothProgress, [0, 0.3, 0.7, 1], [0.03, 0.07, 0.07, 0.02]);
  const radarRotate = useTransform(smoothProgress, [0, 1], [0, 360]);
  const radarScale = useTransform(smoothProgress, [0, 0.5, 1], [0.75, 1.2, 0.85]);
  const radarOpacity = useTransform(smoothProgress, [0, 0.2, 0.8, 1], [0.12, 0.42, 0.35, 0.1]);

  // ── Header Dissolve / Elevate ──
  const headerY = useTransform(smoothProgress, [0, 0.25, 0.85, 1], [0, -10, -10, -20]);
  const headerOpacity = useTransform(smoothProgress, [0, 0.1, 0.85, 1], [1, 1, 1, 0.9]);

  // ── 3D Exploded Cap Angles (Percentage-based for seamless mobile responsiveness) ──
  // 1. Central Front Cap
  const centerScale = useTransform(smoothProgress, [0, 0.5, 0.8, 1], [0.95, 1.12, 1.04, 1]);
  const centerY = useTransform(smoothProgress, [0, 0.5, 1], [0, -18, 0]);
  const centerGlow = useTransform(
    smoothProgress,
    [0, 0.45, 0.55, 0.8, 1],
    [
      "0 0 40px rgba(225,29,72,0.15)",
      "0 0 85px rgba(225,29,72,0.5)",
      "0 0 95px rgba(168,85,247,0.45)",
      "0 0 70px rgba(225,29,72,0.35)",
      "0 0 35px rgba(225,29,72,0.2)",
    ]
  );

  // Convergence Shockwave Ring
  const shockwaveScale = useTransform(smoothProgress, [0.72, 0.82, 0.92], [0.8, 1.45, 1.8]);
  const shockwaveOpacity = useTransform(smoothProgress, [0.72, 0.8, 0.92], [0, 0.75, 0]);

  // 2. Left Flank Angle (Devil Pitchfork Temple)
  const leftX = useTransform(smoothProgress, [0, 0.15, 0.5, 0.8, 1], ["0%", "-25%", "-68%", "-15%", "0%"]);
  const leftY = useTransform(smoothProgress, [0, 0.15, 0.5, 0.8, 1], [0, -15, -45, -10, 0]);
  const leftRotate = useTransform(smoothProgress, [0, 0.15, 0.5, 0.8, 1], [0, -4, -16, -2, 0]);
  const leftScale = useTransform(smoothProgress, [0, 0.15, 0.5, 0.8, 1], [0.82, 0.88, 1, 0.88, 0.82]);
  const leftOpacity = useTransform(smoothProgress, [0, 0.12, 0.45, 0.7, 0.85, 1], [0, 0.7, 1, 1, 0.4, 0]);

  // 3. Right Flank Angle (Symmetrical Temple)
  const rightX = useTransform(smoothProgress, [0, 0.15, 0.5, 0.8, 1], ["0%", "25%", "68%", "15%", "0%"]);
  const rightY = useTransform(smoothProgress, [0, 0.15, 0.5, 0.8, 1], [0, -15, -45, -10, 0]);
  const rightRotate = useTransform(smoothProgress, [0, 0.15, 0.5, 0.8, 1], [0, 4, 16, 2, 0]);
  const rightScale = useTransform(smoothProgress, [0, 0.15, 0.5, 0.8, 1], [0.82, 0.88, 1, 0.88, 0.82]);
  const rightOpacity = useTransform(smoothProgress, [0, 0.12, 0.45, 0.7, 0.85, 1], [0, 0.7, 1, 1, 0.4, 0]);

  // 4. Rear Angle (Snapback & 0880 Arch)
  const backY = useTransform(smoothProgress, [0, 0.18, 0.5, 0.8, 1], [10, 50, 155, 35, 10]);
  const backScale = useTransform(smoothProgress, [0, 0.18, 0.5, 0.8, 1], [0.72, 0.8, 0.94, 0.78, 0.72]);
  const backOpacity = useTransform(smoothProgress, [0, 0.15, 0.45, 0.7, 0.85, 1], [0, 0.6, 1, 1, 0.3, 0]);

  // ── Spec Callout Cards Staggered Entrances ──
  // Card 1: Top Left (Stitch)
  const card1X = useTransform(smoothProgress, [0, 0.22, 0.5, 0.78, 1], [-30, -12, 0, -5, -20]);
  const card1Y = useTransform(smoothProgress, [0, 0.22, 0.5, 0.78, 1], [30, 10, -35, -10, 5]);
  const card1Opacity = useTransform(smoothProgress, [0, 0.2, 0.4, 0.7, 0.85], [0, 0.5, 1, 0.9, 0]);

  // Card 2: Top Right (Devil Flanks)
  const card2X = useTransform(smoothProgress, [0, 0.28, 0.5, 0.78, 1], [30, 12, 0, 5, 20]);
  const card2Y = useTransform(smoothProgress, [0, 0.28, 0.5, 0.78, 1], [40, 15, -45, -15, 5]);
  const card2Opacity = useTransform(smoothProgress, [0, 0.25, 0.45, 0.72, 0.88], [0, 0.5, 1, 0.9, 0]);

  // Card 3: Bottom Left (Structure)
  const card3X = useTransform(smoothProgress, [0, 0.32, 0.5, 0.78, 1], [-25, -8, 0, -4, -15]);
  const card3Y = useTransform(smoothProgress, [0, 0.32, 0.5, 0.78, 1], [50, 20, -15, -5, 10]);
  const card3Opacity = useTransform(smoothProgress, [0, 0.3, 0.5, 0.74, 0.9], [0, 0.5, 1, 0.9, 0]);

  // Card 4: Bottom Right (Closure)
  const card4X = useTransform(smoothProgress, [0, 0.36, 0.5, 0.78, 1], [25, 8, 0, 4, 15]);
  const card4Y = useTransform(smoothProgress, [0, 0.36, 0.5, 0.78, 1], [60, 25, -15, -5, 10]);
  const card4Opacity = useTransform(smoothProgress, [0, 0.35, 0.55, 0.76, 0.92], [0, 0.5, 1, 0.9, 0]);

  // ── HUD Phase Telemetry Guarded Against Redundant Re-renders ──
  const phaseIndex = useTransform(smoothProgress, [0, 0.33, 0.66, 1], [1, 2, 3, 3]);
  const [currentPhase, setCurrentPhase] = useState(1);
  const lastPhaseRef = useRef(1);

  useEffect(() => {
    return phaseIndex.on("change", (latest) => {
      const next = Math.min(3, Math.max(1, Math.round(latest)));
      if (next !== lastPhaseRef.current) {
        lastPhaseRef.current = next;
        setCurrentPhase(next);
      }
    });
  }, [phaseIndex]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative h-[125vh] bg-[#f5f5f8] dark:bg-[#050508] border-b border-black/[0.06] dark:border-white/[0.06] select-none transition-colors duration-300"
    >
      {/* ── Sticky Viewport Window ── */}
      <div className="sticky top-0 h-[100svh] w-full overflow-hidden flex flex-col justify-between py-3 sm:py-5 px-4 sm:px-6 lg:px-8">
        {/* Film grain noise texture */}
        <div className="noise-overlay pointer-events-none opacity-40" />

        {/* Ambient Neon Glow Pulsars */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[500px] sm:w-[850px] h-[450px] rounded-full bg-gradient-to-tr from-moya-red/10 via-moya-violet/5 to-moya-green/5 dark:from-moya-red/15 dark:via-moya-violet/10 dark:to-moya-green/10 blur-[130px]" />
        </div>

        {/* ── Giant Ghosted Blueprint Watermark ── */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <motion.div
            style={
              isMounted
                ? {
                    y: bgTextY,
                    scale: bgTextScale,
                    opacity: bgTextOpacity,
                  }
                : undefined
            }
            className="font-display font-black text-[26vw] tracking-tighter text-zinc-900 dark:text-white leading-none will-change-transform select-none"
          >
            0880
          </motion.div>
        </div>

        {/* ── Rotating Holographic Radar Schematic ── */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div
            style={
              isMounted
                ? {
                    rotate: radarRotate,
                    scale: radarScale,
                    opacity: radarOpacity,
                  }
                : undefined
            }
            className="relative w-[320px] sm:w-[500px] md:w-[640px] aspect-square rounded-full border border-dashed border-black/[0.08] dark:border-white/[0.08]"
          >
            {/* Concentric inner rings */}
            <div className="absolute inset-8 rounded-full border border-black/[0.05] dark:border-white/[0.05]" />
            <div className="absolute inset-20 rounded-full border border-moya-red/20" />
            <div className="absolute inset-32 rounded-full border border-dashed border-moya-violet/20" />

            {/* Degree Markers */}
            <span className="absolute top-2 left-1/2 -translate-x-1/2 font-mono text-[8px] text-zinc-500 dark:text-zinc-600">000° // NORTH</span>
            <span className="absolute bottom-2 left-1/2 -translate-x-1/2 font-mono text-[8px] text-zinc-500 dark:text-zinc-600">180° // SNAP</span>
            <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[8px] text-zinc-500 dark:text-zinc-600">270° // DEVIL_L</span>
            <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[8px] text-zinc-500 dark:text-zinc-600">090° // DEVIL_R</span>

            {/* Sweeping Radar Crosshair */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-px bg-gradient-to-r from-transparent via-moya-red/30 to-transparent" />
              <div className="h-full w-px bg-gradient-to-b from-transparent via-moya-violet/30 to-transparent absolute" />
            </div>
          </motion.div>
        </div>

        {/* ── Streetwear Blueprint HUD (Corner Accents) ── */}
        <div className="absolute top-3 left-3 sm:top-5 sm:left-6 font-mono text-[9px] sm:text-[10px] text-zinc-600 dark:text-zinc-500 flex items-center gap-2 z-30">
          <span className="text-moya-red font-bold animate-pulse">┌ [ + ]</span>
          <span className="tracking-widest">DECONSTRUCTED ARCHITECTURE // 0880</span>
        </div>

        <div className="absolute top-3 right-3 sm:top-5 sm:right-6 font-mono text-[9px] sm:text-[10px] text-zinc-600 dark:text-zinc-500 flex items-center gap-2 z-30">
          <span className="tracking-widest">
            PHASE {currentPhase === 1 ? "01: DORMANT" : currentPhase === 2 ? "02: 3D EXPLOSION" : "03: SPEC SCAN"}
          </span>
          <span className="w-2 h-2 rounded-full bg-moya-green shadow-sm shadow-moya-green animate-ping" />
          <span className="text-zinc-400 dark:text-zinc-600 font-bold">┐</span>
        </div>

        {/* ── Section Title Header ── */}
        <motion.div
          style={isMounted ? { y: headerY, opacity: headerOpacity } : undefined}
          className="relative z-30 text-center max-w-3xl mx-auto pt-2 sm:pt-4"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-dark border border-moya-red/30 text-moya-red dark:text-moya-red-light font-display text-[10px] sm:text-xs font-semibold uppercase tracking-wider mb-2 shadow-lg shadow-moya-red-deep/20">
            <Layers className="w-3.5 h-3.5 text-moya-red" />
            <span>{t("eyebrow")}</span>
          </div>

          <h1 className="font-display text-3xl sm:text-5xl lg:text-6xl font-bold text-zinc-900 dark:text-white tracking-tight leading-[1.05]">
            {t("title")}{" "}
            <span className="text-gradient-moya inline-block">0880</span>
          </h1>

          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1 sm:mt-2 max-w-xl mx-auto hidden sm:block leading-relaxed">
            {t("subtitle")}
          </p>
        </motion.div>

        {/* ── Central 3D Exploded Stage with Zero-Rerender Spring Tilt ── */}
        <motion.div
          style={
            isMounted
              ? {
                  rotateX,
                  rotateY,
                  transformPerspective: 1000,
                }
              : undefined
          }
          className="relative flex-1 w-full max-w-5xl mx-auto flex items-center justify-center my-auto min-h-[280px] sm:min-h-[380px]"
        >
          {/* Central Glowing Stage Platform */}
          <div className="absolute w-56 sm:w-80 md:w-96 h-20 rounded-full bg-gradient-to-r from-moya-red/30 via-moya-violet/20 to-moya-green/20 blur-[50px] pointer-events-none" />

          {/* Re-convergence Energy Shockwave Ring */}
          <motion.div
            style={
              isMounted
                ? {
                    scale: shockwaveScale,
                    opacity: shockwaveOpacity,
                  }
                : undefined
            }
            className="absolute w-72 sm:w-96 aspect-square rounded-full border-2 border-moya-red shadow-[0_0_50px_rgba(225,29,72,0.8)] pointer-events-none z-15"
          />

          {/* 1. Left Flank Angle (Devil Pitchfork) */}
          <motion.div
            style={
              isMounted
                ? {
                    x: leftX,
                    y: leftY,
                    rotate: leftRotate,
                    scale: leftScale,
                    opacity: leftOpacity,
                  }
                : undefined
            }
            className="absolute z-10 w-44 sm:w-60 md:w-72 aspect-square select-none pointer-events-none will-change-transform"
          >
            <Image
              src="/caps/angles/left.png"
              alt="Moya Cap Left Devil Flank"
              fill
              priority
              sizes="(max-width: 768px) 45vw, 290px"
              className="object-contain drop-shadow-[0_25px_40px_rgba(0,0,0,0.9)]"
            />
          </motion.div>

          {/* 2. Right Flank Angle (Symmetrical Temple) */}
          <motion.div
            style={
              isMounted
                ? {
                    x: rightX,
                    y: rightY,
                    rotate: rightRotate,
                    scale: rightScale,
                    opacity: rightOpacity,
                  }
                : undefined
            }
            className="absolute z-10 w-44 sm:w-60 md:w-72 aspect-square select-none pointer-events-none will-change-transform"
          >
            <Image
              src="/caps/angles/right.png"
              alt="Moya Cap Right Flank"
              fill
              priority
              sizes="(max-width: 768px) 45vw, 290px"
              className="object-contain drop-shadow-[0_25px_40px_rgba(0,0,0,0.9)]"
            />
          </motion.div>

          {/* 3. Rear Angle (Snapback & 0880 Arch) */}
          <motion.div
            style={
              isMounted
                ? {
                    y: backY,
                    scale: backScale,
                    opacity: backOpacity,
                  }
                : undefined
            }
            className="absolute z-10 w-40 sm:w-52 md:w-64 aspect-square select-none pointer-events-none will-change-transform"
          >
            <Image
              src="/caps/angles/back.png"
              alt="Moya Cap 0880 Rear Snapback"
              fill
              priority
              sizes="(max-width: 768px) 40vw, 260px"
              className="object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.9)]"
            />
          </motion.div>

          {/* 4. Centerpiece Front Cap */}
          <motion.div
            style={
              isMounted
                ? {
                    scale: centerScale,
                    y: centerY,
                    boxShadow: centerGlow,
                  }
                : undefined
            }
            className="relative z-20 w-52 sm:w-72 md:w-88 aspect-square select-none rounded-3xl will-change-transform"
          >
            <Image
              src="/caps/angles/front.png"
              alt="Moya Cap Front 3D Puff Embroidery"
              fill
              priority
              sizes="(max-width: 768px) 55vw, 350px"
              className="object-contain drop-shadow-[0_35px_65px_rgba(0,0,0,0.95)]"
            />

            {/* Glowing Laser Crosshair Target */}
            <div className="absolute top-[42%] left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center">
              <span className="w-10 h-10 rounded-full border border-moya-red/60 animate-ping absolute" />
              <span className="w-6 h-6 rounded-full border border-moya-red/40 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-moya-red shadow-lg shadow-moya-red" />
              </span>
            </div>
          </motion.div>

          {/* ── Staggered Parallax Spec Callout Cards ── */}
          {/* Card 1: Top Left - 3D Puff Embroidery */}
          <motion.div
            style={
              isMounted
                ? {
                    x: card1X,
                    y: card1Y,
                    opacity: card1Opacity,
                  }
                : undefined
            }
            className="absolute -top-3 sm:top-2 left-0 sm:left-2 md:left-4 z-30 max-w-[150px] sm:max-w-[200px] glass-dark bg-white/90 dark:bg-[#08080d]/90 p-2.5 sm:p-3.5 rounded-2xl border border-moya-red/40 shadow-2xl shadow-black/10 dark:shadow-black/80 hover:border-moya-red/70 transition-colors"
          >
            <div className="flex items-center gap-1.5 text-moya-red dark:text-moya-red-light text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-3 h-3 text-moya-red" />
              <span>01 // STITCHING</span>
            </div>
            <h4 className="font-display font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">{t("layer1Title")}</h4>
            <p className="text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 sm:mt-1 leading-snug line-clamp-2">
              {t("layer1Desc")}
            </p>
          </motion.div>

          {/* Card 2: Top Right - Twin Devils */}
          <motion.div
            style={
              isMounted
                ? {
                    x: card2X,
                    y: card2Y,
                    opacity: card2Opacity,
                  }
                : undefined
            }
            className="absolute -top-3 sm:top-4 right-0 sm:right-2 md:right-4 z-30 max-w-[150px] sm:max-w-[200px] glass-dark bg-white/90 dark:bg-[#08080d]/90 p-2.5 sm:p-3.5 rounded-2xl border border-moya-violet/40 shadow-2xl shadow-black/10 dark:shadow-black/80 hover:border-moya-violet/70 transition-colors"
          >
            <div className="flex items-center gap-1.5 text-moya-violet text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider mb-1">
              <Flame className="w-3 h-3 text-moya-violet" />
              <span>02 // DEVIL FLANKS</span>
            </div>
            <h4 className="font-display font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">{t("layer2Title")}</h4>
            <p className="text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 sm:mt-1 leading-snug line-clamp-2">
              {t("layer2Desc")}
            </p>
          </motion.div>

          {/* Card 3: Bottom Left - Pro Crown Buckram */}
          <motion.div
            style={
              isMounted
                ? {
                    x: card3X,
                    y: card3Y,
                    opacity: card3Opacity,
                  }
                : undefined
            }
            className="absolute bottom-1 sm:bottom-4 left-0 sm:left-2 md:left-6 z-30 max-w-[150px] sm:max-w-[200px] glass-dark bg-white/90 dark:bg-[#08080d]/90 p-2.5 sm:p-3.5 rounded-2xl border border-moya-green/40 shadow-2xl shadow-black/10 dark:shadow-black/80 hover:border-moya-green/70 transition-colors"
          >
            <div className="flex items-center gap-1.5 text-moya-green dark:text-moya-green-light text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-3 h-3 text-moya-green" />
              <span>03 // STRUCTURE</span>
            </div>
            <h4 className="font-display font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">{t("layer4Title")}</h4>
            <p className="text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 sm:mt-1 leading-snug line-clamp-2">
              {t("layer4Desc")}
            </p>
          </motion.div>

          {/* Card 4: Bottom Right - Snapback Closure */}
          <motion.div
            style={
              isMounted
                ? {
                    x: card4X,
                    y: card4Y,
                    opacity: card4Opacity,
                  }
                : undefined
            }
            className="absolute bottom-1 sm:bottom-4 right-0 sm:right-2 md:right-6 z-30 max-w-[150px] sm:max-w-[200px] glass-dark bg-white/90 dark:bg-[#08080d]/90 p-2.5 sm:p-3.5 rounded-2xl border border-black/15 dark:border-white/25 shadow-2xl shadow-black/10 dark:shadow-black/80 hover:border-black/30 dark:hover:border-white/50 transition-colors"
          >
            <div className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300 text-[9px] sm:text-[10px] font-mono font-bold uppercase tracking-wider mb-1">
              <CheckCircle2 className="w-3 h-3 text-moya-red" />
              <span>04 // 7-HOLE ARCH</span>
            </div>
            <h4 className="font-display font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">{t("layer3Title")}</h4>
            <p className="text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 sm:mt-1 leading-snug line-clamp-2">
              {t("layer3Desc")}
            </p>
          </motion.div>
        </motion.div>

        {/* ── Interactive Scrub HUD Footer ── */}
        <div className="relative z-30 max-w-5xl mx-auto w-full pt-2.5 border-t border-black/[0.08] dark:border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-2.5 text-[10px] sm:text-xs font-mono text-zinc-600 dark:text-zinc-500">
          <div className="flex items-center gap-2">
            <Compass className="w-3.5 h-3.5 text-moya-red animate-spin-slow" />
            <span className="text-zinc-700 dark:text-zinc-400 font-semibold">SCROLL NAVIGATION</span>
            <span className="text-zinc-400 dark:text-zinc-600">//</span>
            <span className="hidden sm:inline text-zinc-500">SCRUB TO DECONSTRUCT 3D SHELL</span>
          </div>

          {/* Phase progression capsules */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-zinc-500 dark:text-zinc-600 font-bold uppercase">STAGES:</span>
            <div className="flex items-center gap-1.5">
              <span
                className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all duration-300 ${
                  currentPhase === 1
                    ? "bg-moya-red text-white shadow-sm shadow-moya-red/50"
                    : "bg-black/5 dark:bg-white/5 text-zinc-500 dark:text-zinc-600"
                }`}
              >
                01 ORIGIN
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all duration-300 ${
                  currentPhase === 2
                    ? "bg-moya-violet text-white shadow-sm shadow-moya-violet/50"
                    : "bg-black/5 dark:bg-white/5 text-zinc-500 dark:text-zinc-600"
                }`}
              >
                02 EXPLODE
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[9px] font-bold transition-all duration-300 ${
                  currentPhase === 3
                    ? "bg-moya-green text-black shadow-sm shadow-moya-green/50"
                    : "bg-black/5 dark:bg-white/5 text-zinc-500 dark:text-zinc-600"
                }`}
              >
                03 CONVERGE
              </span>
            </div>
          </div>

          {/* Scroll Down Prompt */}
          <a
            href="#interactive-studio"
            className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors group cursor-pointer"
          >
            <span>{t("nextSection")}</span>
            <ChevronDown className="w-4 h-4 text-moya-red animate-bounce" />
          </a>
        </div>
      </div>
    </div>
  );
}
