"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useLocale, useTranslations } from "next-intl";
import { m } from "framer-motion";
import { ArrowRight, Rotate3d } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { CapVariant } from "@/data/caps";
import { Link } from "@/i18n/routing";
import { useCapVariants } from "@/hooks/useCapVariants";
import { useParallax } from "@/hooks/useParallax";
import { CapTurntable, type TurntableFrame } from "@/components/viewer/CapTurntable";
import { getCapAngleImages, TURNTABLE_ANGLES } from "@/lib/capAngles";
import { isTee } from "@/lib/shop";
import { DURATION, STAGGER } from "@/lib/motion";

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

/**
 * Homepage hero (ADR 0013/0016): the real-photo turntable is the one bold moment. Swatches
 * swap the colorway; the calls to action lead to that cap's page (where stock and drops are
 * handled) and to the Shop. The cap drifts slightly slower than the page as you scroll.
 */
export function HeroInteractive() {
  const t = useTranslations("hero");
  const tAngles = useTranslations("pdp.angles");
  const locale = useLocale();
  const { caps: catalog, isLive } = useCapVariants();
  const caps = useMemo(() => catalog.filter((p) => !isTee(p)), [catalog]);
  const upcomingDrops = useQuery(api.products.getUpcomingDrops);
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

  const sectionRef = useRef<HTMLElement>(null);
  const stageY = useParallax(sectionRef, 120);

  const frames: TurntableFrame[] = useMemo(() => {
    if (!activeCap) return [];
    const angles = getCapAngleImages(activeCap.id);
    return angles
      ? TURNTABLE_ANGLES.map((angle) => ({ src: angles[angle], label: tAngles(angle) }))
      : [{ src: activeCap.image, label: tAngles("hero") }];
  }, [activeCap, tAngles]);
  const [hasTurned, setHasTurned] = useState(false);

  if (!activeCap) return null;
  const name = locale === "es" ? activeCap.nameEs : activeCap.nameEn;

  return (
    <section ref={sectionRef} id="hero" className="relative overflow-clip px-4 pb-10 pt-4 sm:px-6 sm:pb-16 sm:pt-10 lg:px-8">
      {/* Single soft colorway-tinted glow behind the cap */}
      {/* Radial gradient, not a blur filter: same glow, but cheap to paint on phones */}
      <div
        aria-hidden
        className="pointer-events-none absolute right-[-20%] top-[-5%] h-[90%] w-[90%] opacity-50 lg:right-[-10%]"
        style={{ background: `radial-gradient(closest-side, ${activeCap.secondaryHex}55, transparent)` }}
      />

      <div className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-4 lg:grid-cols-12 lg:gap-10">
        {/* ── Cap stage ── */}
        <m.div style={{ y: stageY }} className="order-1 lg:order-2 lg:col-span-7">
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
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: hasTurned ? 0 : 1 }}
                transition={{ duration: DURATION.base, delay: hasTurned ? 0 : 1.4 }}
                className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-black/10 bg-white/70 px-3 py-1.5 font-display text-[12px] font-semibold text-zinc-700 backdrop-blur-md dark:border-white/10 dark:bg-black/40 dark:text-zinc-300"
              >
                <Rotate3d className="h-3.5 w-3.5" />
                <span>{t("dragHint")}</span>
              </m.div>
            )}
          </div>
        </m.div>

        {/* ── Copy ── */}
        <div className="order-2 flex flex-col items-center text-center lg:order-1 lg:col-span-5 lg:items-start lg:text-left">
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

          <h1 className="font-poster text-[clamp(2.75rem,12vw,4.5rem)] uppercase leading-[0.9] tracking-tight text-zinc-950 dark:text-white sm:text-7xl xl:text-8xl">
            <span className="block overflow-hidden pb-[0.04em]">
              <span className="intro-rise block" style={delay(0.15)}>
                {t("titlePrefix")}
              </span>
            </span>
            <span className="block overflow-hidden pb-[0.04em]">
              <span className="intro-rise block text-moya-red" style={delay(0.27)}>
                {t("titleHighlight")}
              </span>
            </span>
          </h1>

          <p
            style={delay(0.45)}
            className="intro-fade mt-4 hidden max-w-md text-base leading-relaxed text-zinc-600 dark:text-zinc-400 sm:block"
          >
            {t("subtitle")}
          </p>

          {/* ── Colorway swatches ── */}
          <div className="mt-4 flex flex-col items-center gap-2 sm:mt-6 lg:items-start">
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
            <p className="font-display text-sm font-semibold text-zinc-600 dark:text-zinc-400">
              {name} · <span className="tabular-nums text-zinc-900 dark:text-white">${activeCap.priceUsd}</span>
            </p>
          </div>

          {/* ── Calls to action ── */}
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
