"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { useStore } from "@/store/useStore";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { CapVariant } from "@/data/caps";
import {
  ShoppingBag,
  MessageCircle,
  ShieldCheck,
  RotateCcw,
  Truck,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Layers,
  Compass,
  Sparkles,
  Maximize2,
  Bell,
  Clock,
  Share2,
  Scan,
  Camera,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { useProductShare } from "@/lib/useProductShare";
import { getWhatsAppInquiryUrl } from "@/lib/whatsapp";
import { EmbroideryLoupe } from "@/components/product/EmbroideryLoupe";
import { getCapColorwayManifest } from "@/data/capsManifest";
import { useSoundEffects } from "@/hooks/useSoundEffects";

interface ProductDetailViewProps {
  cap: CapVariant;
  allCaps: CapVariant[];
}

type AngleKey = "hero" | "front" | "left" | "right" | "back";

const TEE_SIZES = ["S", "M", "L", "XL", "2XL"] as const;
type TeeSize = (typeof TEE_SIZES)[number];

export function ProductDetailView({ cap, allCaps }: ProductDetailViewProps) {
  const t = useTranslations("pdp");
  const tQuick = useTranslations("quickView");
  const tShare = useTranslations("share");
  const locale = useLocale();
  const { addToCart, openDropAlert, currency, cart, openSneakerMatcher, openTryOn, openApparelStudio } = useStore();
  const { shareProduct } = useProductShare();
  const { playClick, playSuccessChime, playToggle } = useSoundEffects();

  const [activeAngle, setActiveAngle] = useState<AngleKey>("hero");
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<TeeSize>("L");
  const [selectedColorway, setSelectedColorway] = useState<string>(
    (cap as any).defaultColorway || "washed-black"
  );
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isLoupeMode, setIsLoupeMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const convexVariants = useQuery(api.products.getVariants, {});
  const displayAllCaps = useMemo(() => {
    if (convexVariants && convexVariants.length > 0) {
      return convexVariants.map((v) => {
        const localCap = allCaps.find((c) => c.id === v.variantId);
        return {
          id: v.variantId,
          nameEn: v.nameEn,
          nameEs: v.nameEs,
          silhouette: v.silhouette || (v.category === "apparel" ? "tee" : "snapback"),
          category: v.category || (v.silhouette === "tee" ? "apparel" : "headwear"),
          primaryHex: v.primaryHex,
          secondaryHex: v.secondaryHex,
          image: v.image,
          images: v.images && v.images.length > 2 ? v.images : (localCap?.images || v.images),
          graphicImage: (v as any).graphicImage || localCap?.graphicImage,
          stock: v.stock,
          priceUsd: v.priceUsd,
          isFeatured: v.isFeatured,
          isDrop: v.isDrop,
          dropDate: v.dropDate,
          dropBadgeTextEn: v.dropBadgeTextEn,
          dropBadgeTextEs: v.dropBadgeTextEs,
          dropStatus: v.dropStatus,
          fabricEn: (v as any).fabricEn || localCap?.fabricEn,
          fabricEs: (v as any).fabricEs || localCap?.fabricEs,
          fitEn: (v as any).fitEn || localCap?.fitEn,
          fitEs: (v as any).fitEs || localCap?.fitEs,
          defaultColorway: (v as any).defaultColorway || localCap?.defaultColorway,
          colorways: (v as any).colorways || localCap?.colorways,
          printPosition: (v as any).printPosition || localCap?.printPosition,
          tagEn: v.isFeatured ? (v.silhouette === "tee" ? "Heavyweight Drop" : "Signature Edition") : undefined,
          tagEs: v.isFeatured ? (v.silhouette === "tee" ? "Drop Heavyweight" : "Edición Insignia") : undefined,
        };
      });
    }
    return allCaps;
  }, [convexVariants, allCaps]);

  useEffect(() => {
    setIsMounted(true);
    // Reset to hero image when cap prop changes
    setActiveAngle("hero");
    setQuantity(1);
    setSelectedColorway((cap as any).defaultColorway || "washed-black");
  }, [cap.id, (cap as any).defaultColorway]);

  const name = locale === "es" ? cap.nameEs : cap.nameEn;
  const tag = locale === "es" ? cap.tagEs : cap.tagEn;

  const currentLiveCap = displayAllCaps.find((c) => c.id === cap.id) || cap;
  const isTee = currentLiveCap.silhouette === "tee" || currentLiveCap.category === "apparel";
  const currentStock = typeof currentLiveCap.stock === "number" ? currentLiveCap.stock : 0;
  const isOutOfStock = currentStock <= 0;

  const inCartItem = isMounted ? cart.find((i) => i.id === cap.id) : undefined;
  const inCartQty = inCartItem?.quantity || 0;
  const isInCart = inCartQty > 0;
  const maxAvailableToAdd = Math.max(0, currentStock - inCartQty);
  const isAtMaxStock = inCartQty >= currentStock || quantity >= maxAvailableToAdd;

  const priceSingle = cap.priceUsd;
  const priceDisplay = `$${priceSingle * Math.max(1, quantity)}.00 USD`;

  const activeColorway = (currentLiveCap as any).colorways?.find((c: any) => c.id === selectedColorway) ||
    (cap as any).colorways?.find((c: any) => c.id === selectedColorway);
  const modelHeroImage = (isTee && activeColorway?.modelImage) ? activeColorway.modelImage : currentLiveCap.image;

  const angles: { key: AngleKey; label: string; desc: string; src: string }[] = useMemo(() => {
    if (isTee) {
      const list: { key: AngleKey; label: string; desc: string; src: string }[] = [
        {
          key: "hero",
          label: locale === "es" ? "Lookbook Fit" : "Lookbook Fit",
          desc: locale === "es" ? "Caída streetwear boxy drop-shoulder en modelo real" : "Heavyweight boxy drop-shoulder drape on streetwear model",
          src: modelHeroImage,
        },
      ];

      const graphic = (currentLiveCap as any).graphicImage || (currentLiveCap.images && currentLiveCap.images[1]);
      if (graphic) {
        list.push({
          key: "front",
          label: locale === "es" ? "Serigrafía HD" : "Graphic Print",
          desc: locale === "es" ? "Detalle de arte en serigrafía resistente al lavado" : "High-density screen print artwork detail with vintage texture",
          src: graphic,
        });
      }

      if (currentLiveCap.images && currentLiveCap.images.length > 1 && currentLiveCap.images[1] !== graphic) {
        list.push({
          key: "left",
          label: locale === "es" ? "Colorway Alternativo" : "Alternate Colorway",
          desc: locale === "es" ? "Variante de color adicional de la colección" : "Secondary colorway view in street environment",
          src: currentLiveCap.images[1],
        });
      }

      list.push({
        key: "right",
        label: locale === "es" ? "Textura 280 GSM" : "280 GSM Texture",
        desc: locale === "es" ? "Detalle macro de tejido de algodón peinado" : "Macro surface detail of heavy combed cotton twill",
        src: currentLiveCap.image,
      });

      return list;
    }

    const manifestItem = getCapColorwayManifest(cap.id);
    return [
      {
        key: "hero",
        label: t("angles.hero"),
        desc: t("anglesDesc.hero"),
        src: manifestItem.angles.front,
      },
      {
        key: "front",
        label: t("angles.front"),
        desc: t("anglesDesc.front"),
        src: manifestItem.angles.front,
      },
      {
        key: "left",
        label: t("angles.left"),
        desc: t("anglesDesc.left"),
        src: manifestItem.angles.left,
      },
      {
        key: "right",
        label: t("angles.right"),
        desc: t("anglesDesc.right"),
        src: manifestItem.angles.right,
      },
      {
        key: "back",
        label: t("angles.back"),
        desc: t("anglesDesc.back"),
        src: manifestItem.angles.back,
      },
    ];
  }, [isTee, currentLiveCap, cap.id, cap.image, modelHeroImage, locale, t]);

  const currentMedia = angles.find((a) => a.key === activeAngle) || angles[0];

  const isDropUpcoming = Boolean(
    currentLiveCap.isDrop &&
    currentLiveCap.dropStatus !== "live" &&
    ((currentLiveCap.dropDate && Date.now() < currentLiveCap.dropDate) || currentLiveCap.dropStatus === "scheduled")
  );

  const handleAdd = () => {
    if (isDropUpcoming || isOutOfStock || maxAvailableToAdd <= 0) return;
    const addQty = Math.min(maxAvailableToAdd, Math.max(1, quantity));
    addToCart(
      currentLiveCap,
      addQty,
      currentStock,
      isTee ? selectedSize : undefined,
      isTee ? selectedColorway : undefined,
      isTee ? activeColorway?.nameEn : undefined,
      isTee ? modelHeroImage : undefined
    );
    playSuccessChime();
    setAddedSuccess(true);
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#e11d48", "#059669", "#a855f7", "#fbbf24"],
    });
    setTimeout(() => {
      setAddedSuccess(false);
      setQuantity(1);
    }, 1500);
  };

  const handleWhatsAppBuy = () => {
    if (!isDropUpcoming && isOutOfStock) return;
    const url = getWhatsAppInquiryUrl({
      name,
      quantity,
      priceSingle,
      currency,
      isDrop: isDropUpcoming,
      locale,
      size: isTee ? selectedSize : undefined,
      colorway: isTee ? activeColorway?.nameEn || selectedColorway : undefined,
      silhouette: currentLiveCap.silhouette,
    });
    window.open(url, "_blank");
  };

  const handleShare = () => {
    shareProduct({
      id: cap.id,
      name,
      image: cap.image,
    });
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
          <div className={`relative aspect-square w-full rounded-2xl sm:rounded-3xl glass-card border border-black/[0.08] dark:border-white/[0.08] flex items-center justify-center overflow-hidden group shadow-xl ${
            isTee ? "p-0 bg-zinc-950" : "p-4 sm:p-8"
          }`}>
            {/* Ambient Blueprint Grid */}
            <div className="absolute inset-0 blueprint-grid opacity-15 dark:opacity-20 pointer-events-none" />

            {/* Silhouette & Code watermark */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-md bg-zinc-900/5 dark:bg-white/5 border border-zinc-900/10 dark:border-white/10 text-[10px] font-mono uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                {isTee
                  ? (locale === "es" ? "Playera Heavyweight 280 GSM" : "Heavyweight 280 GSM Tee")
                  : cap.silhouette === "trucker"
                  ? "Trucker Edition"
                  : "6-Panel Snapback"}
              </span>
              {tag && (
                <span className="sticker-badge sticker-badge--red text-[10px] py-0.5 px-2">
                  <Sparkles className="w-2.5 h-2.5" />
                  <span>{tag}</span>
                </span>
              )}
            </div>

            {/* Action Tools: Loupe, Share & Zoom */}
            <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !isLoupeMode;
                  setIsLoupeMode(next);
                  playToggle(next);
                }}
                className={`p-2 rounded-xl transition-all border ${
                  isLoupeMode
                    ? "bg-moya-red text-white border-moya-red shadow-lg shadow-moya-red/30"
                    : "glass-dark text-zinc-500 hover:text-zinc-900 dark:hover:text-white border-black/[0.06] dark:border-white/[0.08]"
                }`}
                title={isLoupeMode ? "Exit 3D Macro Loupe" : "3D Embroidery Macro Loupe"}
              >
                <Scan className="w-4 h-4" />
              </button>
              <button
                onClick={handleShare}
                className="p-2 rounded-xl glass-dark text-zinc-500 hover:text-moya-red dark:hover:text-white transition-colors border border-black/[0.06] dark:border-white/[0.08]"
                title={tShare("tooltip")}
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  playClick();
                  setIsZoomed(!isZoomed);
                }}
                className="p-2 rounded-xl glass-dark text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors border border-black/[0.06] dark:border-white/[0.08]"
                title="Toggle Zoom"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>

            {/* Active Image Render / Loupe Mode */}
            {isLoupeMode ? (
              <div className="w-full h-full p-2 flex items-center justify-center">
                <EmbroideryLoupe
                  imageSrc={currentMedia.src}
                  alt={`${name} - ${currentMedia.label}`}
                  activeAngle={activeAngle}
                  capName={name}
                />
              </div>
            ) : (
              <>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentMedia.key + cap.id}
                    initial={{ opacity: 0.85, scale: 0.98 }}
                    animate={{ opacity: 1, scale: isZoomed ? 1.25 : 1 }}
                    exit={{ opacity: 0.85, scale: 0.98 }}
                    transition={{ duration: 0.25 }}
                    className="relative w-full h-full flex items-center justify-center cursor-zoom-in"
                    onClick={() => {
                      playClick();
                      setIsZoomed(!isZoomed);
                    }}
                  >
                    <Image
                      src={currentMedia.src}
                      alt={`${name} - ${currentMedia.label}`}
                      fill
                      priority
                      unoptimized
                      className={`${
                        isTee
                          ? "object-cover object-top sm:object-[center_15%]"
                          : "object-contain drop-shadow-[0_25px_45px_rgba(0,0,0,0.22)] dark:drop-shadow-[0_25px_50px_rgba(0,0,0,0.85)]"
                      } transition-transform duration-500`}
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
              </>
            )}
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

          {/* Colorway Swatches for Tees */}
          {isTee && ((cap as any).colorways || (currentLiveCap as any).colorways) && (
            <div className="flex flex-col gap-2.5 p-4 rounded-2xl glass-dark border border-black/[0.06] dark:border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-display font-semibold text-zinc-800 dark:text-zinc-200">
                    {locale === "es" ? "Colorway en Modelo" : "Model Colorway"}:
                  </span>
                  <span className="text-xs font-mono font-bold text-moya-red">
                    {locale === "es" ? activeColorway?.nameEs : activeColorway?.nameEn}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => openApparelStudio(cap)}
                  className="text-[11px] font-mono text-moya-red hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>{locale === "es" ? "Ver en Lookbook Studio" : "Open Lookbook Studio"}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {(((cap as any).colorways || (currentLiveCap as any).colorways) as any[]).map((cw) => {
                  const isSelected = selectedColorway === cw.id;
                  const label = locale === "es" ? cw.nameEs : cw.nameEn;
                  return (
                    <button
                      key={cw.id}
                      type="button"
                      onClick={() => {
                        setSelectedColorway(cw.id);
                        setActiveAngle("hero");
                        playToggle();
                      }}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "border-moya-red bg-moya-red/10 shadow-sm ring-1 ring-moya-red/50"
                          : "border-black/[0.08] dark:border-white/[0.08] hover:border-zinc-400 bg-black/[0.02] dark:bg-white/[0.02]"
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-black/20 dark:border-white/20 shrink-0"
                        style={{ backgroundColor: cw.hex }}
                      />
                      <span className="text-xs font-display font-medium text-zinc-700 dark:text-zinc-300 truncate">
                        {label.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Size Selector for Tees or Sizing Notice for Caps */}
          {isTee ? (
            <div className="flex flex-col gap-2.5 p-4 rounded-2xl glass-dark border border-black/[0.06] dark:border-white/[0.06]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-display font-semibold text-zinc-800 dark:text-zinc-200">
                    {locale === "es" ? "Talla Streetwear" : "Streetwear Size"}:
                  </span>
                  <span className="text-xs font-mono font-bold text-moya-red">
                    {selectedSize} • {locale === "es" ? "Corte Boxy" : "Boxy Fit"}
                  </span>
                </div>
                <span className="text-[11px] font-display text-zinc-500">
                  {locale === "es" ? "Fiel a la talla" : "True to size"}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-2">
                {TEE_SIZES.map((size) => {
                  const isSelected = selectedSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setSelectedSize(size);
                        playToggle();
                      }}
                      className={`py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                        isSelected
                          ? "bg-zinc-950 text-white dark:bg-white dark:text-zinc-950 shadow-md scale-[1.02] ring-2 ring-moya-red/50"
                          : "bg-black/[0.04] dark:bg-white/[0.04] text-zinc-700 dark:text-zinc-300 hover:bg-black/[0.08] dark:hover:bg-white/[0.08]"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>

              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-display">
                {locale === "es"
                  ? "Tejido heavyweight 280 GSM con caída pesada. Elige tu talla habitual para un fit relajado o una menos para fit entallado."
                  : "Heavyweight 280 GSM combed cotton. Boxy drop-shoulder cut. Order regular size for signature streetwear drape."}
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl glass-dark border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-display font-semibold text-zinc-800 dark:text-zinc-200">
                  {tQuick("sizeLabel")}:
                </span>
                <span className="text-xs font-mono text-zinc-600 dark:text-zinc-300">
                  {tQuick("sizeValue")}
                </span>
              </div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-bold">
                {locale === "es" ? "Ajustable" : "Adjustable"}
              </span>
            </div>
          )}

          {/* Quantity Counter & Stock Status */}
          <div className="flex items-center justify-between py-2 border-y border-black/[0.06] dark:border-white/[0.06]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-600 dark:text-zinc-400 font-display font-semibold">
                {tQuick("qty")}:
              </span>
              {isOutOfStock ? (
                <span className="text-[10px] font-display font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                  {t("soldOut")}
                </span>
              ) : currentStock <= 5 ? (
                <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                  {t("stockLeft", { count: currentStock })}
                </span>
              ) : null}
            </div>

            <div className="flex items-center glass-dark rounded-xl border border-black/[0.08] dark:border-white/[0.08]">
              <button
                disabled={isOutOfStock || quantity <= 1}
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className={`px-3.5 py-1.5 text-sm font-bold transition-colors ${
                  isOutOfStock || quantity <= 1
                    ? "text-zinc-300 dark:text-zinc-600 cursor-not-allowed opacity-40"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                −
              </button>
              <span className="px-3 text-xs font-mono font-bold text-zinc-900 dark:text-white">
                {isOutOfStock ? 0 : quantity}
              </span>
              <button
                disabled={isOutOfStock || quantity >= maxAvailableToAdd}
                onClick={() => setQuantity(Math.min(maxAvailableToAdd, quantity + 1))}
                className={`px-3.5 py-1.5 text-sm font-bold transition-colors ${
                  isOutOfStock || quantity >= maxAvailableToAdd
                    ? "text-zinc-300 dark:text-zinc-600 cursor-not-allowed opacity-40"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                }`}
                title={quantity >= maxAvailableToAdd ? t("maxReached") : undefined}
              >
                +
              </button>
            </div>
          </div>

          {/* Drop Countdown / VIP Telemetry Banner */}
          {isDropUpcoming && (
            <div className="p-4 rounded-2xl bg-zinc-100/90 dark:bg-gradient-to-br dark:from-zinc-950/80 dark:via-zinc-900/90 dark:to-zinc-950 border border-moya-red/40 text-zinc-900 dark:text-white shadow-md dark:shadow-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-moya-red/15 dark:bg-moya-red/20 border border-moya-red/40 flex items-center justify-center text-moya-red shrink-0">
                  <Bell className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-moya-red font-bold">
                      {locale === "es" ? "PRÓXIMO DROP EXCLUSIVO" : "UPCOMING EXCLUSIVE DROP"}
                    </span>
                  </div>
                  <p className="text-xs font-display text-zinc-600 dark:text-zinc-300">
                    {locale === "es" ? "Lanzamiento programado:" : "Scheduled Release:"}{" "}
                    <span className="text-zinc-950 dark:text-white font-mono font-bold">
                      {new Date(currentLiveCap.dropDate!).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className="flex flex-col gap-3">
            {isDropUpcoming ? (
              <>
                <button
                  onClick={() => openDropAlert(currentLiveCap)}
                  className="w-full py-4 rounded-2xl font-display font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl shadow-moya-red-deep/40 bg-gradient-to-r from-moya-red via-rose-600 to-amber-600 hover:brightness-110 active:scale-[0.98] text-white"
                >
                  <Bell className="w-5 h-5" />
                  <span>{locale === "es" ? "Solicitar Alerta VIP" : "Claim VIP Drop Alert"}</span>
                </button>

                <button
                  type="button"
                  onClick={handleWhatsAppBuy}
                  className="w-full py-2.5 rounded-xl font-display text-xs text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center gap-1.5 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{locale === "es" ? "¿Preguntas sobre este drop? Chat con Concierge" : "Questions about this drop? Chat with Concierge"}</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleAdd}
                  disabled={addedSuccess || isOutOfStock || maxAvailableToAdd <= 0}
                  className={`w-full py-4 rounded-2xl font-display font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                    isOutOfStock || maxAvailableToAdd <= 0
                      ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                      : addedSuccess
                      ? "bg-emerald-600 text-white shadow-xl shadow-emerald-950/50"
                      : isInCart
                      ? "bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 shadow-xl"
                      : "bg-moya-red hover:bg-rose-500 text-white shadow-xl shadow-moya-red-deep/40"
                  }`}
                >
                  {isOutOfStock ? (
                    <span>{t("soldOut")}</span>
                  ) : maxAvailableToAdd <= 0 ? (
                    <span>{t("maxReached")}</span>
                  ) : addedSuccess ? (
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
                  type="button"
                  onClick={handleWhatsAppBuy}
                  disabled={isOutOfStock}
                  className="w-full py-2.5 rounded-xl font-display text-xs text-zinc-600 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-40"
                >
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                  <span>{locale === "es" ? "¿Dudas sobre talla o bordado? Consulta con Concierge" : "Questions on sizing or embroidery? Chat with Concierge"}</span>
                </button>
              </>
            )}

            {/* Virtual Try-On Launcher */}
            <button
              type="button"
              onClick={() => {
                playClick();
                openTryOn(currentLiveCap);
              }}
              className="w-full py-3.5 rounded-2xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 bg-gradient-to-r from-moya-red/10 via-rose-500/10 to-moya-gold/10 hover:from-moya-red/20 hover:via-rose-500/20 hover:to-moya-gold/20 text-zinc-900 dark:text-white border border-moya-red/30 hover:border-moya-red/60 shadow-lg shadow-moya-red/5 active:scale-[0.98]"
            >
              <Camera className="w-4 h-4 text-moya-red" />
              <span>
                {locale === "es"
                  ? "Probar en Mi Rostro (Virtual Try-On)"
                  : "Try On Your Face (Virtual Try-On)"}
              </span>
            </button>

            {/* Sneaker & Fit Matcher Trigger */}
            <button
              type="button"
              onClick={() => {
                playClick();
                openSneakerMatcher(cap);
              }}
              className="w-full py-3 rounded-2xl font-display font-semibold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-zinc-900 to-zinc-800 dark:from-white/10 dark:to-white/5 text-white border border-black/10 dark:border-white/10 hover:border-moya-gold/50 hover:shadow-lg hover:shadow-moya-gold/10 active:scale-[0.98]"
            >
              <Sparkles className="w-4 h-4 text-moya-gold" />
              <span>
                {locale === "es"
                  ? "Combinar Con Tus Tenis (Sneaker Match)"
                  : "Pair With Your Kicks (Sneaker Match)"}
              </span>
            </button>

            {/* Share Cap Action */}
            <button
              onClick={handleShare}
              className="w-full py-3 rounded-2xl font-display font-semibold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white border border-black/[0.08] dark:border-white/[0.08] active:scale-[0.98]"
            >
              <Share2 className="w-4 h-4 text-moya-red" />
              <span>{tShare("button")}</span>
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
              {isTee ? (locale === "es" ? "Corte & Silueta" : "Silhouette & Cut") : t("specCrown")}
            </span>
            <p className="mt-1 font-display font-bold text-sm text-zinc-900 dark:text-white">
              {isTee ? (locale === "es" ? "Boxy Drop-Shoulder Streetwear" : "Boxy Drop-Shoulder Oversized") : t("specCrownVal")}
            </p>
          </div>

          <div className="p-4 rounded-2xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {isTee ? (locale === "es" ? "Gramaje Textil" : "Fabric Weight") : t("specVisor")}
            </span>
            <p className="mt-1 font-display font-bold text-sm text-zinc-900 dark:text-white">
              {isTee ? (locale === "es" ? "Heavyweight 280-300 GSM" : "Heavyweight 280-300 GSM") : t("specVisorVal")}
            </p>
          </div>

          <div className="p-4 rounded-2xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {isTee ? (locale === "es" ? "Técnica de Serigrafía" : "Print Technique") : t("specStitch")}
            </span>
            <p className="mt-1 font-display font-bold text-sm text-zinc-900 dark:text-white">
              {isTee ? (locale === "es" ? "Serigrafía HD Resistente al Lavado" : "High-Density Screen Print / Crack-Resistant") : t("specStitchVal")}
            </p>
          </div>

          <div className="p-4 rounded-2xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {isTee ? (locale === "es" ? "Cuello & Costuras" : "Collar & Hems") : t("specClosure")}
            </span>
            <p className="mt-1 font-display font-bold text-sm text-zinc-900 dark:text-white">
              {isTee ? (locale === "es" ? "Cuello Acanalado 1.25\" Doble Costura" : "1.25\" Thick Ribbed Neckband with Twin-Needle Stitching") : t("specClosureVal")}
            </p>
          </div>

          <div className="p-4 rounded-2xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {isTee ? (locale === "es" ? "Composición" : "Material") : t("specFabric")}
            </span>
            <p className="mt-1 font-display font-bold text-sm text-zinc-900 dark:text-white">
              {isTee ? (locale === "es" ? "100% Algodón Peinado Ringspun • Lavado Vintage" : "100% Combed Ringspun Cotton • Vintage Stone Wash") : t("specFabricVal")}
            </p>
          </div>

          <div className="p-4 rounded-2xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-500">
              {t("specCare")}
            </span>
            <p className="mt-1 font-display font-bold text-sm text-zinc-900 dark:text-white">
              {isTee ? (locale === "es" ? "Lavar en frío al revés • Secado al aire" : "Machine wash cold inside-out • Hang dry or tumble low") : t("specCareVal")}
            </p>
          </div>
        </div>
      </div>

      {/* ── Explore Collection ── */}
      <div className="mt-16 pt-8 border-t border-black/[0.08] dark:border-white/[0.08]">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
          <div>
            <h3 className="text-xl sm:text-2xl font-display font-bold text-zinc-900 dark:text-white">
              {isTee
                ? (locale === "es" ? "Colección Streetwear Heavyweight" : "Heavyweight Streetwear Collection")
                : t("otherColorwaysTitle")}
            </h3>
            <p className="text-xs text-zinc-500 mt-1">
              {isTee
                ? (locale === "es" ? "Mismo gramaje de 280 GSM y corte boxy en gráficos icónicos Good Luck" : "Same 280 GSM heavyweight cotton and boxy drop-shoulder cut across iconic drops")
                : t("otherColorwaysSubtitle")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2.5 sm:gap-3">
          {displayAllCaps.map((otherCap) => {
            const isCurrent = otherCap.id === cap.id;
            const otherName = locale === "es" ? otherCap.nameEs : otherCap.nameEn;
            return (
              <Link
                key={otherCap.id}
                href={`/products/${otherCap.id}`}
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
