"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { useStore } from "@/store/useStore";
import type { CapVariant } from "@/data/caps";
import {
  ShoppingBag,
  MessageCircle,
  ShieldCheck,
  RotateCcw,
  Truck,
  ArrowLeft,
  Check,
  ChevronRight,
  Layers,
  Compass,
  Sparkles,
  Maximize2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

interface ProductDetailViewProps {
  cap: CapVariant;
  allCaps: CapVariant[];
}

type AngleKey = "hero" | "front" | "left" | "right" | "back";

export function ProductDetailView({ cap, allCaps }: ProductDetailViewProps) {
  const t = useTranslations("pdp");
  const tQuick = useTranslations("quickView");
  const locale = useLocale();
  const { addToCart, currency, cart } = useStore();

  const [activeAngle, setActiveAngle] = useState<AngleKey>("hero");
  const [quantity, setQuantity] = useState(1);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Reset to hero image when cap prop changes
    setActiveAngle("hero");
    setQuantity(1);
  }, [cap.id]);

  const name = locale === "es" ? cap.nameEs : cap.nameEn;
  const tag = locale === "es" ? cap.tagEs : cap.tagEn;

  const inCartItem = isMounted ? cart.find((i) => i.id === cap.id) : undefined;
  const inCartQty = inCartItem?.quantity || 0;
  const isInCart = inCartQty > 0;

  const priceSingle = cap.priceUsd;
  const priceDisplay = `$${priceSingle * quantity}.00 USD`;

  const angles: { key: AngleKey; label: string; desc: string; src: string }[] = [
    {
      key: "hero",
      label: t("angles.hero"),
      desc: t("anglesDesc.hero"),
      src: cap.image,
    },
    {
      key: "front",
      label: t("angles.front"),
      desc: t("anglesDesc.front"),
      src: "/caps/angles/front.png",
    },
    {
      key: "left",
      label: t("angles.left"),
      desc: t("anglesDesc.left"),
      src: "/caps/angles/left.png",
    },
    {
      key: "right",
      label: t("angles.right"),
      desc: t("anglesDesc.right"),
      src: "/caps/angles/right.png",
    },
    {
      key: "back",
      label: t("angles.back"),
      desc: t("anglesDesc.back"),
      src: "/caps/angles/back.png",
    },
  ];

  const currentMedia = angles.find((a) => a.key === activeAngle) || angles[0];

  const handleAdd = () => {
    addToCart(cap, quantity);
    setAddedSuccess(true);
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#e11d48", "#059669", "#a855f7", "#fbbf24"],
    });
    setTimeout(() => {
      setAddedSuccess(false);
    }, 1500);
  };

  const handleWhatsAppBuy = () => {
    const greeting =
      locale === "es"
        ? `¡Hola Moya Caps! Deseo ordenar ${quantity} pieza(s) de la gorra ${name} (Edición Good Luck 0880 - $${priceSingle * quantity} ${currency}). ¿Me podrían compartir los datos de pago y envío?`
        : `Hi Moya Caps! I would like to order ${quantity} piece(s) of ${name} (0880 Good Luck Edition - $${priceSingle * quantity} ${currency}). Please share payment and delivery details.`;

    const encoded = encodeURIComponent(greeting);
    window.open(`https://wa.me/5215500000000?text=${encoded}`, "_blank");
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      {/* ── Breadcrumb Navigation ── */}
      <nav className="flex items-center gap-2 text-xs text-zinc-500 mb-6 font-display">
        <Link
          href="/"
          className="hover:text-zinc-900 dark:hover:text-white transition-colors flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t("backToCatalog")}</span>
        </Link>
        <ChevronRight className="w-3 h-3 text-zinc-400 dark:text-zinc-600" />
        <span className="text-zinc-700 dark:text-zinc-400">{t("breadcrumbCollection")}</span>
        <ChevronRight className="w-3 h-3 text-zinc-400 dark:text-zinc-600" />
        <span className="text-zinc-900 dark:text-white font-semibold truncate max-w-[200px]">
          {name}
        </span>
      </nav>

      {/* ── Main Product Stage ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* ── Left Column: Multi-Angle Gallery ── */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          {/* Main Visualizer Stage */}
          <div className="relative aspect-square w-full rounded-2xl sm:rounded-3xl glass-card border border-black/[0.08] dark:border-white/[0.08] p-4 sm:p-8 flex items-center justify-center overflow-hidden group shadow-xl">
            {/* Ambient Blueprint Grid */}
            <div className="absolute inset-0 blueprint-grid opacity-15 dark:opacity-20 pointer-events-none" />

            {/* Silhouette & Code watermark */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-zinc-900/5 dark:bg-white/5 border border-zinc-900/10 dark:border-white/10 text-[10px] font-mono uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                {cap.silhouette === "trucker" ? "Trucker Edition" : "6-Panel Snapback"}
              </span>
              {tag && (
                <span className="sticker-badge sticker-badge--red text-[10px] py-0.5 px-2">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>{tag}</span>
                </span>
              )}
            </div>

            {/* Expand / Zoom Button */}
            <button
              onClick={() => setIsZoomed(!isZoomed)}
              className="absolute top-4 right-4 z-10 p-2 rounded-xl glass-dark text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              title="Toggle Zoom"
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Active Image Render */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentMedia.key + cap.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: isZoomed ? 1.25 : 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="relative w-full h-full flex items-center justify-center cursor-zoom-in"
                onClick={() => setIsZoomed(!isZoomed)}
              >
                <Image
                  src={currentMedia.src}
                  alt={`${name} - ${currentMedia.label}`}
                  fill
                  priority
                  className="object-contain drop-shadow-[0_25px_45px_rgba(0,0,0,0.22)] dark:drop-shadow-[0_25px_50px_rgba(0,0,0,0.85)] transition-transform duration-500"
                  sizes="(max-width: 1024px) 90vw, 55vw"
                />
              </motion.div>
            </AnimatePresence>

            {/* Active Angle Descriptor Pill */}
            <div className="absolute bottom-4 inset-x-4 sm:inset-x-8 z-10 flex items-center justify-between glass-dark px-3.5 py-2 rounded-xl border border-black/[0.06] dark:border-white/[0.06] text-xs">
              <span className="font-display font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-moya-red" />
                {currentMedia.label}
              </span>
              <span className="text-[11px] text-zinc-500 truncate max-w-[240px] sm:max-w-sm font-sans">
                {currentMedia.desc}
              </span>
            </div>
          </div>

          {/* Angle Thumbnails Switcher */}
          <div className="grid grid-cols-5 gap-2 sm:gap-3">
            {angles.map((ang) => {
              const isSelected = activeAngle === ang.key;
              return (
                <button
                  key={ang.key}
                  onClick={() => {
                    setActiveAngle(ang.key);
                    setIsZoomed(false);
                  }}
                  className={`relative aspect-square rounded-xl sm:rounded-2xl p-1 sm:p-2 glass-card border flex flex-col items-center justify-center transition-all ${
                    isSelected
                      ? "border-moya-red ring-2 ring-moya-red/30 shadow-lg shadow-moya-red-deep/20 scale-[1.02]"
                      : "border-black/[0.06] dark:border-white/[0.06] hover:border-zinc-400 dark:hover:border-zinc-600 opacity-80 hover:opacity-100"
                  }`}
                >
                  <div className="relative w-full h-full">
                    <Image
                      src={ang.src}
                      alt={ang.label}
                      fill
                      className="object-contain"
                      sizes="120px"
                    />
                  </div>
                  <span
                    className={`mt-1 text-[8px] sm:text-[10px] font-display font-semibold truncate ${
                      isSelected ? "text-moya-red font-bold" : "text-zinc-500"
                    }`}
                  >
                    {ang.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Right Column: Specs, Ordering & Actions ── */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Header & Title */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono uppercase tracking-widest text-moya-red font-bold">
                0880 GOOD LUCK SERIES
              </span>
              <span className="text-xs font-mono text-zinc-500">
                SKU: {cap.id.toUpperCase()}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-bold text-zinc-900 dark:text-white tracking-tight">
              {name}
            </h1>

            {/* Price & Cart Status */}
            <div className="flex flex-wrap items-baseline gap-3 mt-1">
              <div className="text-2xl sm:text-3xl font-mono font-bold text-emerald-600 dark:text-moya-green-light">
                {priceDisplay}
              </div>
              {isInCart && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-xs font-display font-semibold shadow-sm animate-pulse">
                  <Check className="w-3.5 h-3.5" />
                  <span>{tQuick("inCartNotice", { count: inCartQty })}</span>
                </span>
              )}
            </div>
          </div>

          {/* Colorway Spec Pill */}
          <div className="p-3.5 rounded-2xl glass-dark border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span
                className="w-4 h-4 rounded-full border border-white/60 dark:border-white/30 shadow-sm"
                style={{ backgroundColor: cap.primaryHex }}
              />
              <span
                className="w-4 h-4 rounded-full border border-white/60 dark:border-white/30 shadow-sm"
                style={{ backgroundColor: cap.secondaryHex }}
              />
              <span className="text-xs font-display font-semibold text-zinc-800 dark:text-zinc-200">
                {locale === "es" ? "Combinación Dual-Tone" : "Dual-Tone Contrast"}
              </span>
            </div>
            <span className="text-[11px] font-mono text-zinc-500">
              {cap.primaryHex} / {cap.secondaryHex}
            </span>
          </div>

          {/* Quantity Counter */}
          <div className="flex items-center justify-between py-2 border-y border-black/[0.06] dark:border-white/[0.06]">
            <span className="text-xs text-zinc-600 dark:text-zinc-400 font-display font-semibold">
              {tQuick("qty")}:
            </span>
            <div className="flex items-center glass-dark rounded-xl border border-black/[0.08] dark:border-white/[0.08]">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="px-3.5 py-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-bold transition-colors"
              >
                −
              </button>
              <span className="px-3 text-xs font-mono font-bold text-zinc-900 dark:text-white">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="px-3.5 py-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white font-bold transition-colors"
              >
                +
              </button>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={handleAdd}
              disabled={addedSuccess}
              className={`w-full py-4 rounded-2xl font-display font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                addedSuccess
                  ? "bg-emerald-600 text-white shadow-xl shadow-emerald-950/50"
                  : isInCart
                  ? "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-xl"
                  : "bg-moya-red hover:bg-rose-500 text-white shadow-xl shadow-moya-red-deep/40"
              }`}
            >
              {addedSuccess ? (
                <>
                  <Check className="w-5 h-5 text-white" />
                  <span>{tQuick("addedSuccess")}</span>
                </>
              ) : isInCart ? (
                <>
                  <ShoppingBag className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  <span>{tQuick("addMoreBtn", { count: inCartQty })}</span>
                </>
              ) : (
                <>
                  <ShoppingBag className="w-5 h-5" />
                  <span>{tQuick("addToCart")}</span>
                </>
              )}
            </button>

            <button
              onClick={handleWhatsAppBuy}
              className="w-full py-3.5 rounded-2xl bg-moya-green-deep/90 hover:bg-moya-green text-white font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-moya-green-deep/30 active:scale-[0.98]"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{tQuick("buyNow")}</span>
            </button>
          </div>

          {/* Trust Guarantees */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-black/[0.06] dark:border-white/[0.06] text-[10px] text-zinc-500 text-center">
            <div className="flex flex-col items-center gap-1 p-2 rounded-xl glass-dark">
              <Truck className="w-4 h-4 text-moya-gold" />
              <span className="font-display font-semibold text-zinc-800 dark:text-zinc-200">
                {t("freeShipping")}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 rounded-xl glass-dark">
              <RotateCcw className="w-4 h-4 text-moya-violet" />
              <span className="font-display font-semibold text-zinc-800 dark:text-zinc-200">
                {t("guarantee")}
              </span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 rounded-xl glass-dark">
              <ShieldCheck className="w-4 h-4 text-moya-green" />
              <span className="font-display font-semibold text-zinc-800 dark:text-zinc-200">
                100% Authentic 0880
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Technical Blueprint Specs Table ── */}
      <div className="mt-12 sm:mt-16 pt-8 border-t border-black/[0.08] dark:border-white/[0.08]">
        <div className="flex items-center gap-2 mb-6">
          <Compass className="w-5 h-5 text-moya-red" />
          <h2 className="text-xl sm:text-2xl font-display font-bold text-zinc-900 dark:text-white">
            {t("specsTitle")}
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {t("specCrown")}
            </span>
            <p className="mt-1 font-display font-bold text-sm text-zinc-900 dark:text-white">
              {t("specCrownVal")}
            </p>
          </div>

          <div className="p-4 rounded-2xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {t("specVisor")}
            </span>
            <p className="mt-1 font-display font-bold text-sm text-zinc-900 dark:text-white">
              {t("specVisorVal")}
            </p>
          </div>

          <div className="p-4 rounded-2xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {t("specStitch")}
            </span>
            <p className="mt-1 font-display font-bold text-sm text-zinc-900 dark:text-white">
              {t("specStitchVal")}
            </p>
          </div>

          <div className="p-4 rounded-2xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {t("specClosure")}
            </span>
            <p className="mt-1 font-display font-bold text-sm text-zinc-900 dark:text-white">
              {t("specClosureVal")}
            </p>
          </div>

          <div className="p-4 rounded-2xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {t("specFabric")}
            </span>
            <p className="mt-1 font-display font-bold text-sm text-zinc-900 dark:text-white">
              {t("specFabricVal")}
            </p>
          </div>

          <div className="p-4 rounded-2xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {t("specCare")}
            </span>
            <p className="mt-1 font-display font-bold text-sm text-zinc-900 dark:text-white">
              {t("specCareVal")}
            </p>
          </div>
        </div>
      </div>

      {/* ── Explore Alternative 16 Colorways ── */}
      <div className="mt-16 pt-8 border-t border-black/[0.08] dark:border-white/[0.08]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-display font-bold text-zinc-900 dark:text-white">
              {t("otherColorwaysTitle")}
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              {t("otherColorwaysSubtitle")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5 sm:gap-3">
          {allCaps.map((otherCap) => {
            const isCurrent = otherCap.id === cap.id;
            const otherName = locale === "es" ? otherCap.nameEs : otherCap.nameEn;
            return (
              <Link
                key={otherCap.id}
                href={`/caps/${otherCap.id}`}
                className={`group relative aspect-square rounded-xl p-2 glass-card border flex flex-col items-center justify-center transition-all ${
                  isCurrent
                    ? "border-moya-red ring-2 ring-moya-red/40 scale-105 shadow-lg shadow-moya-red-deep/20"
                    : "border-black/[0.06] dark:border-white/[0.06] hover:border-zinc-400 dark:hover:border-zinc-500 hover:scale-105"
                }`}
                title={otherName}
              >
                <div className="relative w-full h-full">
                  <Image
                    src={otherCap.image}
                    alt={otherName}
                    fill
                    className="object-contain"
                    sizes="80px"
                  />
                </div>
                {/* Swatch indicator */}
                <div className="absolute bottom-1 right-1 flex items-center gap-0.5">
                  <span
                    className="w-2 h-2 rounded-full border border-white/50"
                    style={{ backgroundColor: otherCap.primaryHex }}
                  />
                  <span
                    className="w-2 h-2 rounded-full border border-white/50"
                    style={{ backgroundColor: otherCap.secondaryHex }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
