"use client";

import React, { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radio,
  Bell,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Users,
  Clock,
  CheckCircle,
  ExternalLink,
  ShoppingBag,
} from "lucide-react";
import { useStore } from "@/store/useStore";
import type { CapVariant } from "@/data/caps";

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isLive: boolean;
}

function calculateTimeRemaining(targetTimestamp: number): TimeRemaining {
  const diff = targetTimestamp - Date.now();
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, totalMs: 0, isLive: true };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / 1000 / 60) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return { days, hours, minutes, seconds, totalMs: diff, isLive: false };
}

export function DropRadar() {
  const t = useTranslations("dropRadar");
  const locale = useLocale();
  const { openDropAlert, addToCart } = useStore();

  const drops = useQuery(api.products.getUpcomingDrops);
  const [activeDropIndex, setActiveDropIndex] = useState(0);
  const [now, setNow] = useState(Date.now());

  // Real-time ticking interval
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Safe active drop selection
  const activeDrop = useMemo(() => {
    if (!drops || drops.length === 0) return null;
    const index = Math.min(activeDropIndex, drops.length - 1);
    return drops[index];
  }, [drops, activeDropIndex]);

  // If no upcoming drops configured in backend, do not render radar section
  if (!drops || drops.length === 0 || !activeDrop) {
    return null;
  }

  const dropDateMs = activeDrop.dropDate || (now + 86400000);
  const time = calculateTimeRemaining(dropDateMs);

  const dropName = locale === "es" ? activeDrop.nameEs : activeDrop.nameEn;
  const customBadge =
    locale === "es"
      ? activeDrop.dropBadgeTextEs || activeDrop.dropBadgeTextEn
      : activeDrop.dropBadgeTextEn;

  // Convert Convex variant to CapVariant format for store actions
  const capForStore: CapVariant = {
    id: activeDrop.variantId,
    nameEn: activeDrop.nameEn,
    nameEs: activeDrop.nameEs,
    silhouette: activeDrop.silhouette as "snapback" | "trucker",
    primaryHex: activeDrop.primaryHex,
    secondaryHex: activeDrop.secondaryHex,
    image: activeDrop.image,
    stock: activeDrop.stock,
    priceUsd: activeDrop.priceUsd,
    isDrop: activeDrop.isDrop,
    dropDate: activeDrop.dropDate,
    dropStatus: activeDrop.dropStatus,
  };

  const isDropLive = activeDrop.dropStatus === "live" || (time.isLive && activeDrop.dropStatus !== "scheduled");

  const formattedTargetDate = new Date(dropDateMs).toLocaleDateString(
    locale === "es" ? "es-ES" : "en-US",
    {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
    }
  );

  return (
    <section id="drop-radar" className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 overflow-hidden scroll-mt-24">
      {/* Background Ambient Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-80 bg-gradient-to-r from-moya-red/10 via-amber-500/10 to-moya-gold/10 blur-3xl pointer-events-none rounded-full" />

      {/* Main Radar Container */}
      <div className="relative glass-card rounded-3xl p-6 sm:p-10 border border-zinc-200/90 dark:border-white/[0.08] shadow-2xl overflow-hidden bg-white/95 dark:bg-gradient-to-br dark:from-zinc-950/80 dark:via-zinc-900/90 dark:to-zinc-950/95 text-zinc-900 dark:text-white transition-colors duration-300">
        {/* Radar Telemetry Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200/90 dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center">
              <span className="w-3 h-3 rounded-full bg-moya-red animate-ping absolute opacity-75" />
              <span className="w-3 h-3 rounded-full bg-moya-red relative" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] font-bold tracking-widest text-moya-red uppercase">
                  {t("badge")}
                </span>
                <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.08]">
                  LIVE RADAR
                </span>
              </div>
              <h2 className="font-display font-extrabold text-2xl sm:text-3xl text-zinc-950 dark:text-white mt-0.5 tracking-tight">
                {t("title")}
              </h2>
            </div>
          </div>

          {/* Multiple drops tabs selector if more than 1 drop exists */}
          {drops.length > 1 && (
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100/90 dark:bg-white/[0.05] border border-zinc-200 dark:border-white/[0.08] self-start sm:self-auto overflow-x-auto max-w-full">
              {drops.map((d, i) => (
                <button
                  key={d.variantId}
                  onClick={() => setActiveDropIndex(i)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-display font-semibold whitespace-nowrap transition-all ${
                    activeDropIndex === i
                      ? "bg-moya-red text-white shadow-md shadow-moya-red/30"
                      : "text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
                  }`}
                >
                  {locale === "es" ? d.nameEs : d.nameEn}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Radar Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-8">
          {/* Left Column: Product Spotlight with Holographic aura */}
          <div className="lg:col-span-5 flex flex-col items-center justify-center relative">
            <div className="relative w-full max-w-xs sm:max-w-sm aspect-square rounded-2xl bg-gradient-to-b from-zinc-100/80 to-zinc-50/20 dark:from-white/[0.04] dark:to-transparent border border-zinc-200/90 dark:border-white/[0.08] flex items-center justify-center p-6 group">
              {/* Radial target rings */}
              <div className="absolute inset-4 rounded-full border border-zinc-300/40 dark:border-white/[0.05] pointer-events-none" />
              <div className="absolute inset-12 rounded-full border border-dashed border-moya-red/25 dark:border-moya-red/20 pointer-events-none animate-[spin_60s_linear_infinite]" />

              {/* Custom Drop Badge */}
              <div className="absolute top-3 left-3 z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-moya-red/15 dark:bg-moya-red/20 border border-moya-red/40 text-moya-red dark:text-moya-red-light text-[10px] font-mono font-bold tracking-wide uppercase">
                  <Sparkles className="w-3 h-3" />
                  {customBadge || (locale === "es" ? "Edición Limitada" : "Limited Drop")}
                </span>
              </div>

              {/* Watchers Counter */}
              <div className="absolute top-3 right-3 z-10">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/90 dark:bg-white/[0.08] backdrop-blur-md border border-zinc-200 dark:border-white/[0.1] text-zinc-700 dark:text-zinc-300 text-[10px] font-mono shadow-xs">
                  <Users className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  {t("subscribersCount", { count: activeDrop.subscribersCount || 0 })}
                </span>
              </div>

              {/* Product Cap Image */}
              <motion.div
                key={activeDrop.variantId}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="relative w-full h-full"
              >
                <Image
                  src={activeDrop.image}
                  alt={dropName}
                  fill
                  priority
                  className="object-contain filter drop-shadow-[0_15px_25px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_20px_35px_rgba(0,0,0,0.8)] group-hover:scale-105 transition-transform duration-500 ease-out"
                />
              </motion.div>

              {/* Hex Swatches */}
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-white/90 dark:bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-full border border-zinc-200 dark:border-white/[0.08] shadow-xs">
                <span
                  className="w-3 h-3 rounded-full border border-black/10 dark:border-white/40 shadow-xs"
                  style={{ backgroundColor: activeDrop.primaryHex }}
                />
                <span
                  className="w-3 h-3 rounded-full border border-black/10 dark:border-white/40 shadow-xs"
                  style={{ backgroundColor: activeDrop.secondaryHex }}
                />
                <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 ml-1">
                  {activeDrop.silhouette === "trucker" ? "Trucker" : "Snapback"}
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Mission Control & Digital Ticker */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            {/* Live Unlock Banner OR Countdown */}
            {time.isLive ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-3 text-emerald-800 dark:text-emerald-400"
              >
                <CheckCircle className="w-6 h-6 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <div>
                  <h4 className="font-display font-bold text-sm sm:text-base text-emerald-900 dark:text-emerald-300">
                    {t("liveNow")}
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300/80">
                    {locale === "es"
                      ? "La bóveda se ha abierto. Ya puedes ordenar esta pieza antes de que se agote el stock."
                      : "Vault gates are unlocked. You can now claim this colorway before allocated inventory depletes."}
                  </p>
                </div>
              </motion.div>
            ) : (
              <div className="mb-6">
                <div className="flex items-center gap-2 text-xs font-mono text-zinc-600 dark:text-zinc-400 mb-2 font-medium">
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-moya-gold" />
                  <span>{t("dropStartsIn")}: <strong className="text-zinc-950 dark:text-white font-semibold">{formattedTargetDate}</strong></span>
                </div>

                {/* Digital Precision Ticker Blocks */}
                <div className="grid grid-cols-4 gap-2 sm:gap-3.5 max-w-lg">
                  {[
                    { label: t("days"), value: time.days },
                    { label: t("hours"), value: time.hours },
                    { label: t("mins"), value: time.minutes },
                    { label: t("secs"), value: time.seconds },
                  ].map((unit, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col items-center justify-center p-3 sm:p-4 rounded-2xl bg-zinc-100/90 dark:bg-white/[0.04] border border-zinc-200/90 dark:border-white/[0.08] shadow-xs backdrop-blur-md relative overflow-hidden group hover:border-moya-red/50 dark:hover:border-moya-red/40 transition-all"
                    >
                      <span className="font-mono font-black text-2xl sm:text-4xl text-zinc-950 dark:text-white tracking-tight">
                        {String(unit.value).padStart(2, "0")}
                      </span>
                      <span className="text-[9px] sm:text-[10px] font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mt-0.5 font-bold">
                        {unit.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Title & Lore Description */}
            <div className="mb-6">
              <h3 className="font-display font-black text-2xl sm:text-3xl text-zinc-950 dark:text-white mb-2">
                {dropName}
              </h3>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
                {locale === "es"
                  ? "Pieza de la serie icónica 0880 Good Luck. Bordado de alto relieve 3D, flancos con tridente y confección de alto gramaje para coleccionistas."
                  : "From the iconic 0880 Good Luck series. High-density 3D puff embroidery, signature devil pitchfork flanks, and heavyweight collectible craftsmanship."}
              </p>
            </div>

            {/* Price & Action Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 pt-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xl sm:text-2xl font-mono font-black text-emerald-600 dark:text-emerald-400">
                  ${activeDrop.priceUsd}.00 USD
                </span>
                <span className="text-xs text-zinc-500 font-mono">
                  / {activeDrop.stock} {locale === "es" ? "piezas" : "units allocated"}
                </span>
              </div>

              <div className="flex items-center gap-2.5 flex-1 justify-end">
                {isDropLive ? (
                  <button
                    onClick={() => addToCart(capForStore, 1, activeDrop.stock)}
                    className="flex-1 sm:flex-initial py-3 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 dark:shadow-emerald-950/50 transition-all active:scale-95"
                  >
                    <ShoppingBag className="w-4 h-4" />
                    <span>{locale === "es" ? "Comprar Ahora" : "Claim Cap Now"}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => openDropAlert(capForStore)}
                    className="flex-1 sm:flex-initial py-3 px-6 rounded-xl bg-moya-red hover:bg-rose-500 active:bg-moya-red-deep text-white font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-moya-red-deep/30 dark:shadow-moya-red-deep/40 transition-all active:scale-95"
                  >
                    <Bell className="w-4 h-4" />
                    <span>{t("claimAlert")}</span>
                  </button>
                )}

                <Link
                  href={`/caps/${activeDrop.variantId}`}
                  className="py-3 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-white/[0.05] dark:hover:bg-white/[0.1] border border-zinc-200 dark:border-white/[0.08] text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white font-display font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-xs"
                >
                  <span>{t("viewDrop")}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
