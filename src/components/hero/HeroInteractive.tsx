"use client";

import { useTranslations, useLocale } from "next-intl";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Bell, Rotate3d } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useStore } from "@/store/useStore";
import type { CapVariant } from "@/data/caps";
import { useCapVariants } from "@/hooks/useCapVariants";
import { useCapPurchaseState } from "@/hooks/useCapPurchaseState";
import { CapTurntable, type TurntableFrame } from "@/components/viewer/CapTurntable";
import { DURATION, EASE, STAGGER } from "@/lib/motion";

const FLAGSHIP_ID = "negro-rojo";

/** Turntable order: dragging right reveals the left flank first */
const FLAGSHIP_ANGLES = ["front", "left", "back", "right"] as const;

/** Up to five swatches: the flagship first, then featured / low-stock colorways */
function pickQuickSwap(caps: CapVariant[]) {
  const featured = caps.filter((c) => c.isFeatured || c.stock <= 8);
  const pool = featured.length >= 3 ? featured : caps;
  const flagship = caps.find((c) => c.id === FLAGSHIP_ID);
  const rest = pool.filter((c) => c.id !== FLAGSHIP_ID);
  return (flagship ? [flagship, ...rest] : rest).slice(0, 5);
}

export function HeroInteractive() {
  const t = useTranslations("hero");
  const tCatalog = useTranslations("catalog");
  const locale = useLocale();
  const reduceMotion = useReducedMotion() ?? false;
  const { addToCart, openDropAlert } = useStore();
  const { caps, isLive } = useCapVariants();
  const upcomingDrops = useQuery(api.products.getUpcomingDrops);
  const activeUpcomingDrop = upcomingDrops && upcomingDrops.length > 0 ? upcomingDrops[0] : null;

  const quickSwapCaps = useMemo(() => pickQuickSwap(caps), [caps]);
  const [activeCapId, setActiveCapId] = useState(FLAGSHIP_ID);
  const activeCap = caps.find((c) => c.id === activeCapId) ?? quickSwapCaps[0];

  // If the active cap disappears from the live catalog, fall back to the first quick-swap cap.
  useEffect(() => {
    if (isLive && !caps.some((c) => c.id === activeCapId) && quickSwapCaps.length > 0) {
      setActiveCapId(quickSwapCaps[0].id);
    }
  }, [isLive, caps, activeCapId, quickSwapCaps]);

  const { stock, inCartQty, isInCart, isOutOfStock, isMaxInCart, isDropUpcoming } = useCapPurchaseState(activeCap);
  const name = locale === "es" ? activeCap.nameEs : activeCap.nameEn;

  // ── Real-photo turntable: every angle shot for the flagship, the catalog shot otherwise ──
  const tAngles = useTranslations("pdp.angles");
  const frames: TurntableFrame[] = useMemo(
    () =>
      activeCap.id === FLAGSHIP_ID
        ? FLAGSHIP_ANGLES.map((angle) => ({ src: `/caps/angles/${angle}.png`, label: tAngles(angle) }))
        : [{ src: activeCap.image, label: tAngles("hero") }],
    [activeCap.id, activeCap.image, tAngles]
  );
  const [hasTurned, setHasTurned] = useState(false);

  const lineReveal = (i: number) => ({
    initial: { y: reduceMotion ? 0 : "105%", opacity: reduceMotion ? 0 : 1 },
    animate: { y: 0, opacity: 1 },
    transition: { duration: DURATION.slow, delay: 0.15 + i * 0.12, ease: EASE.out },
  });

  return (
    <section
      id="interactive-studio"
      className="relative overflow-clip px-4 sm:px-6 lg:px-8 pt-4 sm:pt-10 pb-14 sm:pb-24"
    >
      {/* Single soft colorway-tinted glow behind the cap */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-10%] top-[5%] h-[70%] w-[70%] rounded-full blur-[140px] opacity-40 transition-colors duration-700 lg:right-0"
        style={{ backgroundColor: `${activeCap.secondaryHex}55` }}
      />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-4 lg:grid-cols-12 lg:gap-10">
        {/* ── Cap stage ── */}
        <div className="order-1 lg:order-2 lg:col-span-7">
          <div className="relative mx-auto aspect-square w-full max-w-[min(100%,36svh)] sm:max-w-[min(560px,46svh)] lg:max-w-none">
            <CapTurntable
              key={activeCap.id}
              frames={frames}
              alt={`Good Luck 0880 — ${name}`}
              glowHex={`${activeCap.secondaryHex}66`}
              priority
              className="h-full w-full"
              onInteract={() => setHasTurned(true)}
            />

            {frames.length > 1 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: hasTurned ? 0 : 1 }}
                transition={{ duration: DURATION.base, delay: hasTurned ? 0 : 1.4 }}
                className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1.5 whitespace-nowrap rounded-full border border-black/10 bg-white/70 px-3 py-1.5 text-[11px] font-display font-semibold text-zinc-700 backdrop-blur-md dark:border-white/10 dark:bg-black/40 dark:text-zinc-300"
              >
                <Rotate3d className="h-3.5 w-3.5" />
                <span>{t("dragHint")}</span>
              </motion.div>
            )}

            {isInCart && (
              <div className="absolute left-2 top-2 z-20 flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-white/80 px-2.5 py-1.5 text-[11px] font-display font-semibold text-emerald-600 backdrop-blur-md dark:bg-black/50 dark:text-emerald-400">
                <Check className="h-3 w-3" />
                <span>
                  {t("inCart")} ({inCartQty})
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Copy + purchase ── */}
        <div className="order-2 flex flex-col items-center text-center lg:order-1 lg:col-span-5 lg:items-start lg:text-left">
          <div className="mb-3 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <motion.span
              initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: DURATION.base, ease: EASE.out }}
              className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-moya-red"
            >
              {t("badge")}
            </motion.span>

            {activeUpcomingDrop && (
              <motion.a
                href="#drop-radar"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: DURATION.base, delay: 0.3 }}
                className="group inline-flex items-center gap-1.5 rounded-full border border-moya-red/40 bg-moya-red/10 px-2.5 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-moya-red transition-colors hover:bg-moya-red/20"
              >
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-moya-red animate-pulse" />
                <span>{locale === "es" ? "Drop VIP activo" : "VIP drop live"}</span>
                <ArrowRight className="h-3 w-3 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </motion.a>
            )}
          </div>

          <h1 className="font-poster uppercase leading-[0.9] tracking-tight text-zinc-950 dark:text-white text-[clamp(2.75rem,12vw,4.5rem)] sm:text-7xl xl:text-8xl">
            <span className="block overflow-hidden pb-[0.04em]">
              <motion.span className="block" {...lineReveal(0)}>
                {t("titlePrefix")}
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-[0.04em]">
              <motion.span className="block text-moya-red" {...lineReveal(1)}>
                {t("titleHighlight")}
              </motion.span>
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: DURATION.base, delay: 0.45 }}
            className="mt-4 hidden max-w-md text-base leading-relaxed text-zinc-600 dark:text-zinc-400 sm:block"
          >
            {t("subtitle")}
          </motion.p>

          {/* ── Colorway swatches ── */}
          <div className="mt-4 flex flex-col items-center gap-2 sm:mt-6 lg:items-start">
            <div className="flex items-center gap-2.5" role="radiogroup" aria-label={t("colorway")}>
              {quickSwapCaps.map((cap, i) => (
                <motion.button
                  key={cap.id}
                  type="button"
                  role="radio"
                  aria-checked={activeCap.id === cap.id}
                  aria-label={locale === "es" ? cap.nameEs : cap.nameEn}
                  title={locale === "es" ? cap.nameEs : cap.nameEn}
                  onClick={() => setActiveCapId(cap.id)}
                  initial={{ opacity: 0, scale: reduceMotion ? 1 : 0.6 }}
                  animate={{ opacity: 1, scale: activeCap.id === cap.id ? 1.12 : 1 }}
                  transition={{ duration: DURATION.fast, delay: 0.5 + i * STAGGER, ease: EASE.pop }}
                  className={`relative h-8 w-8 rounded-full transition-shadow ${
                    activeCap.id === cap.id
                      ? "ring-2 ring-moya-red ring-offset-2 ring-offset-background"
                      : "hover:ring-1 hover:ring-zinc-400 hover:ring-offset-1 hover:ring-offset-background dark:hover:ring-white/30"
                  }`}
                >
                  <span
                    className="block h-full w-full rounded-full border border-black/10 shadow-sm dark:border-white/20"
                    style={{ background: `linear-gradient(135deg, ${cap.primaryHex} 50%, ${cap.secondaryHex} 50%)` }}
                  />
                </motion.button>
              ))}
            </div>
            <p className="text-xs font-display font-semibold text-zinc-600 dark:text-zinc-400">
              {name} · <span className="font-mono text-zinc-900 dark:text-white">${activeCap.priceUsd} USD</span>
            </p>
          </div>

          {/* ── CTAs ── */}
          <motion.div
            initial={{ opacity: 0, y: reduceMotion ? 0 : 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DURATION.base, delay: 0.6, ease: EASE.out }}
            className="mt-4 flex w-full flex-col items-stretch gap-2.5 sm:mt-6 sm:w-auto sm:flex-row sm:items-center"
          >
            {isDropUpcoming ? (
              <button
                onClick={() => openDropAlert(activeCap)}
                className="flex items-center justify-center gap-2 rounded-2xl bg-moya-red px-7 py-4 font-display text-sm font-bold text-white shadow-lg shadow-moya-red-deep/30 transition-all hover:bg-rose-500 active:scale-95 sm:text-base"
              >
                <Bell className="h-4 w-4" />
                <span>{locale === "es" ? "Solicitar Alerta VIP" : "Claim VIP Drop Alert"}</span>
              </button>
            ) : isOutOfStock ? (
              <button
                disabled
                className="cursor-not-allowed rounded-2xl bg-zinc-200 px-7 py-4 font-display text-sm font-semibold text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 sm:text-base"
              >
                {tCatalog("soldOut")}
              </button>
            ) : isMaxInCart ? (
              <button
                disabled
                className="flex cursor-not-allowed items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-600/10 px-7 py-4 font-display text-sm font-semibold text-emerald-700 dark:text-emerald-400/80 sm:text-base"
              >
                <Check className="h-4 w-4" />
                <span>
                  {tCatalog("maxStockReached")} ({inCartQty})
                </span>
              </button>
            ) : (
              <button
                onClick={() => addToCart(activeCap, 1, stock)}
                className={`group flex items-center justify-center gap-2.5 rounded-2xl px-7 py-4 font-display text-sm font-bold transition-all active:scale-95 sm:text-base ${
                  isInCart
                    ? "border border-emerald-500/40 bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/25 dark:text-emerald-300"
                    : "bg-moya-red text-white shadow-lg shadow-moya-red-deep/30 hover:bg-rose-500"
                }`}
              >
                {isInCart && <Check className="h-4 w-4" />}
                <span>{isInCart ? t("inCartCta", { count: inCartQty }) : t("ctaClaim")}</span>
                <span className="font-mono opacity-80">${activeCap.priceUsd}</span>
              </button>
            )}

            <a
              href="#catalog"
              className="group flex items-center justify-center gap-2 rounded-2xl border border-black/10 px-6 py-4 font-display text-sm font-semibold text-zinc-900 transition-colors hover:border-black/25 hover:bg-black/[0.03] dark:border-white/15 dark:text-white dark:hover:border-white/30 dark:hover:bg-white/[0.05] sm:text-base"
            >
              <span>{t("ctaShop")}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
