"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from "framer-motion";
import { ArrowRight, Rotate3d } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { CapVariant } from "@/data/caps";
import { Link } from "@/i18n/routing";
import { useCapVariants } from "@/hooks/useCapVariants";
import { useReducedMotionSafe } from "@/hooks/useMotionPrefs";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { CapTurntable, type TurntableFrame } from "@/components/viewer/CapTurntable";
import { getCapAngleImages, TURNTABLE_ANGLES } from "@/lib/capAngles";
import { HERO_LAYERS, HINT_HIDE_PROGRESS, platterAngle, scrub, type Range } from "@/lib/heroMotion";
import { isTee } from "@/lib/shop";
import { DURATION, EASE, SPRING, STAGGER } from "@/lib/motion";

/** Delay for the CSS intro classes in globals.css (.intro-rise, .intro-fade, .intro-pop) */
const delay = (seconds: number) => ({ "--intro-delay": `${seconds}s` }) as CSSProperties;

const FLAGSHIP_ID = "negro-rojo";

/** Up to five swatches: the flagship first, then featured / low-stock colorways */
function pickQuickSwap(caps: CapVariant[]) {
  const featured = caps.filter((c) => c.isFeatured || c.stock <= 8);
  const pool = featured.length >= 3 ? featured : caps;
  const flagship = caps.find((c) => c.id === FLAGSHIP_ID);
  const rest = pool.filter((c) => c.id !== FLAGSHIP_ID);
  return (flagship ? [flagship, ...rest] : rest).slice(0, 5);
}

/** A layer value scrubbed by the hero's scroll progress; rests in place until mounted / when motion is reduced */
function useScrubbed(progress: MotionValue<number>, range: Range, enabled: boolean) {
  return useTransform(progress, (p) => scrub(p, range, enabled));
}

/**
 * Homepage hero (ADR 0013/0016): a poster sandwich. The first headline line sits behind the real-photo
 * turntable, the red second line in front of its brim. Scrolling pulls the three apart at different
 * speeds (depth), turns the cap through its angle photos, spins the platter under it and drifts the
 * outlined series number behind everything. Transform and opacity only; all of it rests under reduced motion.
 */
export function HeroInteractive() {
  const t = useTranslations("hero");
  const tAngles = useTranslations("pdp.angles");
  const locale = useLocale();
  const { caps: catalog, isLive } = useCapVariants();
  const caps = useMemo(() => catalog.filter((p) => !isTee(p)), [catalog]);
  const clientTime = useMinuteClock();
  const upcomingDrops = useQuery(api.drops.getUpcomingDrops, { clientTime });
  const hasLiveDrop = Boolean(upcomingDrops && upcomingDrops.length > 0);

  const quickSwapCaps = useMemo(() => pickQuickSwap(caps), [caps]);
  const [activeCapId, setActiveCapId] = useState(FLAGSHIP_ID);
  const activeCap = caps.find((c) => c.id === activeCapId) ?? quickSwapCaps[0];

  // If the active cap disappears from the live catalog, fall back to the first quick-swap cap.
  useEffect(() => {
    if (isLive && !caps.some((c) => c.id === activeCapId) && quickSwapCaps.length > 0) {
      setActiveCapId(quickSwapCaps[0].id);
    }
  }, [isLive, caps, activeCapId, quickSwapCaps]);

  // ── Scroll choreography ──
  const sectionRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotionSafe();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const motionOn = mounted && !reduceMotion;
  // 0 at the top of the page, 1 once one hero height has scrolled by. Measured against the page, not
  // the section's own position, so the sticky header's height never delays the choreography.
  const { scrollY } = useScroll();
  const [heroHeight, setHeroHeight] = useState(0);
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const measure = () => setHeroHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const progress = useTransform(scrollY, (y) => (heroHeight > 0 ? y / heroHeight : 0));

  const ghostY = useScrubbed(progress, HERO_LAYERS.ghost.y, motionOn);
  const ghostRotate = useScrubbed(progress, HERO_LAYERS.ghost.rotate, motionOn);
  const ghostScale = useScrubbed(progress, HERO_LAYERS.ghost.scale, motionOn);
  const ghostOpacity = useScrubbed(progress, HERO_LAYERS.ghost.opacity, motionOn);
  const glowY = useScrubbed(progress, HERO_LAYERS.glow.y, motionOn);
  const glowScale = useScrubbed(progress, HERO_LAYERS.glow.scale, motionOn);
  const line1Y = useScrubbed(progress, HERO_LAYERS.line1.y, motionOn);
  const line1X = useScrubbed(progress, HERO_LAYERS.line1.x, motionOn);
  const capY = useScrubbed(progress, HERO_LAYERS.cap.y, motionOn);
  const capScale = useScrubbed(progress, HERO_LAYERS.cap.scale, motionOn);
  const capRotate = useScrubbed(progress, HERO_LAYERS.cap.rotate, motionOn);
  const line2Y = useScrubbed(progress, HERO_LAYERS.line2.y, motionOn);
  const line2X = useScrubbed(progress, HERO_LAYERS.line2.x, motionOn);

  const [scrolled, setScrolled] = useState(false);
  useMotionValueEvent(progress, "change", (p) => {
    if (p > HINT_HIDE_PROGRESS) setScrolled(true);
  });

  // ── Turntable ──
  const frames: TurntableFrame[] = useMemo(() => {
    if (!activeCap) return [];
    const angles = getCapAngleImages(activeCap.id);
    return angles
      ? TURNTABLE_ANGLES.map((angle) => ({ src: angles[angle], label: tAngles(angle) }))
      : [{ src: activeCap.image, label: tAngles("hero") }];
  }, [activeCap, tAngles]);
  const [hasTurned, setHasTurned] = useState(false);
  const [frameIndex, setFrameIndex] = useState(0);
  const onInteract = useCallback(() => setHasTurned(true), []);

  if (!activeCap) return null;
  const name = locale === "es" ? activeCap.nameEs : activeCap.nameEn;
  const showHint = frames.length > 1 && !hasTurned && !scrolled;

  return (
    <section
      ref={sectionRef}
      id="hero"
      className="relative overflow-clip px-4 pb-10 pt-7 sm:px-6 sm:pb-14 sm:pt-10 lg:px-8"
      style={
        {
          "--l1": "clamp(2.6rem, 13.4vw, 6rem)",
          "--l2": "clamp(3.6rem, 21vw, 8.75rem)",
          "--cap": "min(86vw, 46svh)",
        } as CSSProperties
      }
    >
      <div className="relative mx-auto w-full max-w-7xl">
        {/* ── Stage: headline + cap, stacked by depth ── */}
        <div className="relative sm:[--cap:min(68vw,52svh)] lg:[--cap:min(42vw,52svh)]">
          {/* Far background: colorway glow, then the outlined series number. Both move slowest. */}
          <motion.div
            aria-hidden
            style={{
              y: glowY,
              scale: glowScale,
              top: "calc(var(--cap) * 0.1)",
              left: "calc(50% - var(--cap) * 0.55)",
              width: "calc(var(--cap) * 1.1)",
              height: "calc(var(--cap) * 1.1)",
              background: `radial-gradient(closest-side, ${activeCap.secondaryHex}5c, transparent)`,
            }}
            className="pointer-events-none absolute z-0 opacity-70"
          />
          <div
            aria-hidden
            style={delay(0.35)}
            className="intro-fade pointer-events-none absolute inset-x-0 top-[calc(var(--cap)*0.08)] z-0 flex justify-center"
          >
            <motion.p
              style={{ y: ghostY, rotate: ghostRotate, scale: ghostScale, opacity: ghostOpacity }}
              className="ghost-type select-none whitespace-nowrap font-poster text-[calc(var(--cap)*0.62)] leading-none"
            >
              0880
            </motion.p>
          </div>

          <h1 className="relative text-center font-poster uppercase tracking-tight text-zinc-950 dark:text-white">
            {/* Line 1 waits behind the cap */}
            <motion.span
              style={{ y: line1Y, x: line1X }}
              className="relative z-10 block overflow-hidden pb-[0.06em] text-[length:var(--l1)] leading-[0.86]"
            >
              <span className="intro-rise block" style={delay(0.12)}>
                {t("titlePrefix")}
              </span>
            </motion.span>
            {/* Room for the cap: it overlaps both lines */}
            <span aria-hidden className="block" style={{ height: "calc(var(--cap) * 0.68 - var(--l1) * 0.42 - var(--l2) * 0.3)" }} />
            {/* Line 2 rides in front of the brim */}
            <motion.span
              style={{ y: line2Y, x: line2X }}
              className="relative z-30 block overflow-hidden pb-[0.06em] text-[length:var(--l2)] leading-[0.86] text-moya-red"
            >
              <span className="intro-rise block" style={delay(0.24)}>
                {t("titleHighlight")}
              </span>
            </motion.span>
          </h1>

          {/* The cap, between the lines */}
          <motion.div
            style={{
              y: capY,
              scale: capScale,
              rotate: capRotate,
              top: "calc(var(--l1) * 0.4 - var(--cap) * 0.16)",
              left: "calc(50% - var(--cap) / 2)",
              width: "var(--cap)",
              height: "var(--cap)",
            }}
            className="absolute z-20"
          >
            {/* Platter: a dial under the cap that spins with the angle on show */}
            {/* Its centre sits at brim height: the square collapses to an ellipse around that line */}
            <div aria-hidden className="pointer-events-none absolute inset-x-[14%] bottom-[-24%] aspect-square [perspective:600px]">
              <motion.div
                animate={{ rotateX: 74, rotateZ: platterAngle(frameIndex, Math.max(frames.length, 1)) }}
                initial={false}
                transition={reduceMotion ? { duration: 0 } : SPRING.scroll}
                className="absolute inset-0 rounded-full border border-dashed border-zinc-900/20 dark:border-white/20 [transform-style:preserve-3d]"
              >
                <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-moya-red" />
                <span className="absolute left-1/2 bottom-0 h-1.5 w-1.5 -translate-x-1/2 translate-y-1/2 rounded-full bg-zinc-900/30 dark:bg-white/30" />
                <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900/30 dark:bg-white/30" />
                <span className="absolute right-0 top-1/2 h-1.5 w-1.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900/30 dark:bg-white/30" />
              </motion.div>
            </div>

            <CapTurntable
              key={activeCap.id}
              frames={frames}
              alt={`Good Luck 0880 — ${name}`}
              glowHex={`${activeCap.secondaryHex}66`}
              priority
              className="h-full w-full"
              scrub={progress}
              showAngleDots={false}
              onInteract={onInteract}
              onFrameChange={setFrameIndex}
            />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: showHint ? 1 : 0 }}
              transition={{ duration: DURATION.base, delay: showHint ? 1.4 : 0, ease: EASE.out }}
              className="pointer-events-none absolute right-0 top-[30%] flex items-center gap-1.5 whitespace-nowrap rounded-full border border-black/10 bg-white/70 px-3 py-1.5 font-display text-[12px] font-semibold text-zinc-700 backdrop-blur-md dark:border-white/10 dark:bg-black/40 dark:text-zinc-300"
            >
              <Rotate3d className="h-3.5 w-3.5" />
              <span>{t("dragHint")}</span>
            </motion.div>
          </motion.div>
        </div>

        {/* ── Colorway, name, price, calls to action ── */}
        <div className="relative z-30 mt-3 flex flex-col items-center sm:mt-5">
          {hasLiveDrop && (
            <a
              href="#drop-radar"
              style={delay(0.3)}
              className="intro-fade group mb-3 inline-flex items-center gap-1.5 rounded-full border border-moya-red/40 bg-moya-red/10 px-3 py-1 font-display text-[13px] font-semibold text-moya-red transition-colors hover:bg-moya-red/20"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-moya-red motion-safe:animate-pulse" />
              {t("dropLive")}
              <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </a>
          )}

          <div className="flex items-center gap-2.5" role="radiogroup" aria-label={t("colorway")}>
            {quickSwapCaps.map((cap, i) => (
              <button
                key={cap.id}
                type="button"
                role="radio"
                aria-checked={activeCap.id === cap.id}
                aria-label={locale === "es" ? cap.nameEs : cap.nameEn}
                title={locale === "es" ? cap.nameEs : cap.nameEn}
                onClick={() => setActiveCapId(cap.id)}
                style={delay(0.5 + i * STAGGER)}
                className={`intro-pop relative h-9 w-9 rounded-full transition-[box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red ${
                  activeCap.id === cap.id
                    ? "scale-[1.12] ring-2 ring-moya-red ring-offset-2 ring-offset-background"
                    : "hover:ring-1 hover:ring-zinc-400 hover:ring-offset-1 hover:ring-offset-background dark:hover:ring-white/30"
                }`}
              >
                <span
                  className="block h-full w-full rounded-full border border-black/10 shadow-sm dark:border-white/20"
                  style={{ background: `linear-gradient(135deg, ${cap.primaryHex} 50%, ${cap.secondaryHex} 50%)` }}
                />
              </button>
            ))}
          </div>
          <p className="mt-2 font-display text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            {name} · <span className="tabular-nums text-zinc-900 dark:text-white">${activeCap.priceUsd}</span>
          </p>

          <p
            style={delay(0.45)}
            className="intro-fade mt-3 hidden max-w-md text-center text-base leading-relaxed text-zinc-600 dark:text-zinc-400 sm:block"
          >
            {t("subtitle")}
          </p>

          <div
            style={delay(0.6)}
            className="intro-fade mt-5 flex w-full flex-col items-stretch gap-2.5 sm:mt-6 sm:w-auto sm:flex-row sm:items-center"
          >
            <Link
              href={`/products/${activeCap.id}`}
              className="flex h-14 items-center justify-center gap-2 rounded-full bg-moya-red px-7 font-display text-base font-bold text-white shadow-lg shadow-moya-red-deep/30 transition-colors hover:bg-moya-red-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red focus-visible:ring-offset-2"
            >
              {t("ctaThisCap")}
            </Link>
            <Link
              href="/products"
              className="group flex h-14 items-center justify-center gap-2 rounded-full border border-black/15 px-6 font-display text-base font-semibold text-zinc-900 transition-colors hover:border-black/30 dark:border-white/15 dark:text-white dark:hover:border-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red"
            >
              {t("ctaShopAll")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
