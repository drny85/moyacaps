"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { useLocale } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import {
  Sparkles,
  ShoppingBag,
  MessageCircle,
  Check,
  ShieldCheck,
  RotateCcw,
  Maximize2,
  X,
  ChevronRight,
  ChevronLeft,
  ArrowRight,
  Flame,
  Layers,
  Info,
} from "lucide-react";
import {
  SHIRT_VARIANTS,
  APPAREL_COLORWAYS,
  ApparelColorwayOption,
  CapVariant,
} from "@/data/caps";
import { useStore } from "@/store/useStore";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { getWhatsAppInquiryUrl, formatUsd } from "@/lib/whatsapp";
import { Link } from "@/i18n/routing";

const TEE_SIZES = ["S", "M", "L", "XL", "2XL"] as const;
type TeeSize = (typeof TEE_SIZES)[number];

interface ModelLookbookStudioProps {
  initialTeeId?: string;
  isModal?: boolean;
  onClose?: () => void;
}

export function ModelLookbookStudio({
  initialTeeId,
  isModal = false,
  onClose,
}: ModelLookbookStudioProps) {
  const locale = useLocale();
  const { addToCart, apparelStudioTargetTee, closeApparelStudio } = useStore();
  const { playClick, playSuccessChime, playToggle } = useSoundEffects();

  // Selected Shirt Design
  const [selectedTeeId, setSelectedTeeId] = useState<string>(
    initialTeeId || apparelStudioTargetTee?.id || SHIRT_VARIANTS[0].id
  );

  const activeTee = useMemo(() => {
    return (
      SHIRT_VARIANTS.find((t: CapVariant) => t.id === selectedTeeId) ||
      SHIRT_VARIANTS[0]
    );
  }, [selectedTeeId]);

  // Selected Colorway (defaults to shirt's defaultColorway)
  const [selectedColorwayId, setSelectedColorwayId] = useState<string>(
    activeTee.defaultColorway || "washed-black"
  );

  // Active View: "model" (full streetwear model), "closeup" (chest & shirt focus), "graphic" (standalone artwork)
  const [activeView, setActiveView] = useState<"model" | "closeup" | "graphic">("model");
  const [selectedSize, setSelectedSize] = useState<TeeSize>("L");
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (apparelStudioTargetTee) {
      setSelectedTeeId(apparelStudioTargetTee.id);
      setSelectedColorwayId(apparelStudioTargetTee.defaultColorway || "washed-black");
    }
  }, [apparelStudioTargetTee]);

  useEffect(() => {
    setImageError(false);
  }, [selectedTeeId, selectedColorwayId, activeView]);

  // Available colorways for active shirt
  const colorwayOptions: ApparelColorwayOption[] = useMemo(() => {
    if (activeTee.colorways && activeTee.colorways.length > 0) {
      return activeTee.colorways;
    }
    return APPAREL_COLORWAYS.map((c) => ({
      id: c.id,
      nameEn: c.nameEn,
      nameEs: c.nameEs,
      hex: c.hex,
      borderHex: c.borderHex,
      modelImage: activeTee.image,
    }));
  }, [activeTee]);

  const activeColorway = useMemo(() => {
    return (
      colorwayOptions.find((c) => c.id === selectedColorwayId) ||
      colorwayOptions[0]
    );
  }, [colorwayOptions, selectedColorwayId]);

  // Determine current image to display in viewport
  const currentImage = useMemo(() => {
    if (activeView === "graphic" && activeTee.graphicImage) {
      return activeTee.graphicImage;
    }
    return activeColorway?.modelImage || activeTee.image;
  }, [activeView, activeTee, activeColorway]);

  const teeName = locale === "es" ? activeTee.nameEs : activeTee.nameEn;
  const colorwayName = locale === "es" ? activeColorway?.nameEs : activeColorway?.nameEn;
  const fabricDescription = locale === "es" ? activeTee.fabricEs : activeTee.fabricEn;
  const fitDescription = locale === "es" ? activeTee.fitEs : activeTee.fitEn;
  const priceDisplay = formatUsd(activeTee.priceUsd);

  const handleSelectTee = (tee: CapVariant) => {
    playClick();
    setSelectedTeeId(tee.id);
    setSelectedColorwayId(tee.defaultColorway || "washed-black");
    setActiveView("model");
  };

  const handleSelectColorway = (colorwayId: string) => {
    playToggle();
    setSelectedColorwayId(colorwayId);
    setActiveView("model");
  };

  const handleAddToCart = () => {
    addToCart(
      activeTee,
      1,
      activeTee.stock || 20,
      selectedSize,
      activeColorway?.id || selectedColorwayId,
      activeColorway?.nameEn || "Vintage Washed Black",
      currentImage
    );
    playSuccessChime();
    setAddedSuccess(true);
    confetti({
      particleCount: 50,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#e11d48", "#10b981", "#fbbf24", "#ffffff"],
    });
    setTimeout(() => {
      setAddedSuccess(false);
      if (isModal && onClose) {
        onClose();
      }
    }, 1200);
  };

  const handleWhatsAppOrder = () => {
    const url = getWhatsAppInquiryUrl({
      name: activeTee.nameEn,
      quantity: 1,
      priceSingle: activeTee.priceUsd,
      currency: "USD",
      locale,
      size: selectedSize,
      colorway: activeColorway?.nameEn || selectedColorwayId,
      silhouette: "tee",
    });
    window.open(url, "_blank");
  };

  const content = (
    <div className="w-full">
      {/* Studio Header */}
      <div className="mb-6 sm:mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-black/[0.08] dark:border-white/[0.08] pb-6">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-moya-red/10 border border-moya-red/20 text-moya-red text-xs font-mono font-bold uppercase tracking-wider mb-2.5">
            <Flame className="w-3.5 h-3.5" />
            <span>
              {locale === "es"
                ? "Lookbook Studio Oficial • Playeras 280-300 GSM"
                : "Official Lookbook Studio • 280-300 GSM Heavyweight"}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-zinc-900 dark:text-white tracking-tight">
            {locale === "es" ? "Pruébalo en el Modelo" : "Model Fit & Colorway Studio"}
          </h2>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1 max-w-xl">
            {locale === "es"
              ? "Explora nuestras 11 playeras gráficas premium puestas en modelo real. Selecciona entre los 4 colores de tela y revisa la caída oversized."
              : "Preview all 11 graphic tees on real streetwear models. Switch between 4 heavyweight fabric colorways and verify the boxy drape."}
          </p>
        </div>

        {/* Global GSM & US Delivery Badges */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="px-3 py-1.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/[0.06] dark:border-white/[0.06] text-right">
            <p className="text-[10px] font-mono uppercase text-zinc-500">
              {locale === "es" ? "Gramaje Textil" : "Fabric Weight"}
            </p>
            <p className="text-xs font-display font-bold text-zinc-900 dark:text-white">
              280 - 300 GSM
            </p>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-right">
            <p className="text-[10px] font-mono uppercase text-emerald-600 dark:text-emerald-400 font-semibold">
              {locale === "es" ? "Envío EE.UU." : "US Shipping"}
            </p>
            <p className="text-xs font-display font-bold text-emerald-600 dark:text-emerald-400">
              {locale === "es" ? "Express 2-4 Días" : "Express 2-4 Days"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Studio Workspace: 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column (Lg: 7 cols): High-Resolution Model Viewport */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="relative w-full aspect-[4/5] sm:aspect-[3/4] min-h-[460px] sm:min-h-[580px] rounded-2xl sm:rounded-3xl overflow-hidden bg-zinc-950 border border-black/[0.08] dark:border-white/[0.08] shadow-2xl group">
            {/* Model Image with smooth crossfade */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedTeeId}-${selectedColorwayId}-${activeView}`}
                initial={{ opacity: 0.85, scale: 0.99 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0.85 }}
                transition={{ duration: 0.22, ease: "easeOut" }}
                className="absolute inset-0 w-full h-full"
              >
                {!imageError ? (
                  <Image
                    src={currentImage}
                    alt={`${teeName} - ${colorwayName}`}
                    fill
                    priority
                    unoptimized
                    onError={() => setImageError(true)}
                    sizes="(max-width: 768px) 100vw, 60vw"
                    className={
                      activeView === "graphic"
                        ? "object-contain p-6 sm:p-10 bg-zinc-950"
                        : activeView === "closeup"
                          ? "object-cover object-[center_18%] scale-135 transition-transform duration-500"
                          : "object-cover object-top sm:object-[center_12%] transition-transform duration-500"
                    }
                  />
                ) : (
                  <img
                    src={currentImage}
                    alt={`${teeName} - ${colorwayName}`}
                    className={`w-full h-full ${
                      activeView === "graphic"
                        ? "object-contain p-6 bg-zinc-950"
                        : "object-cover object-top"
                    }`}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Gradient Overlays for Badges */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

            {/* Floating Top Left: Print Location & GSM */}
            <div className="absolute top-3.5 left-3.5 flex flex-wrap items-center gap-1.5 z-10">
              <span className="px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider bg-black/70 backdrop-blur-md text-white border border-white/15 shadow-lg">
                {activeTee.printPosition === "back"
                  ? locale === "es"
                    ? "Estampado en Espalda"
                    : "Back Print Graphic"
                  : locale === "es"
                    ? "Estampado Frontal"
                    : "Front Chest Graphic"}
              </span>
              <span className="px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-mono font-semibold bg-moya-red/80 backdrop-blur-md text-white shadow-lg">
                {activeTee.tagEn || "280 GSM Heavyweight"}
              </span>
            </div>

            {/* Floating Top Right: Zoom / Fullscreen Button */}
            <button
              onClick={() => setIsZoomOpen(true)}
              className="absolute top-3.5 right-3.5 p-2.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white border border-white/15 transition-all shadow-lg active:scale-95 z-10"
              title={locale === "es" ? "Ver en pantalla completa" : "View fullscreen photo"}
            >
              <Maximize2 className="w-4 h-4" />
            </button>

            {/* Floating Bottom Left: Colorway Live Hex Indicator */}
            <div className="absolute bottom-3.5 left-3.5 z-10 flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/80 backdrop-blur-md border border-white/20 text-white shadow-lg">
                <span
                  className="w-3.5 h-3.5 rounded-full border border-white/50 shadow-sm"
                  style={{ backgroundColor: activeColorway?.hex || "#18181b" }}
                />
                <span className="font-display font-bold text-xs tracking-wide">
                  {colorwayName}
                </span>
              </div>
            </div>

            {/* Floating Bottom Right: View Mode Toggle (Model vs Closeup vs Artwork) */}
            <div className="absolute bottom-3.5 right-3.5 z-10 flex items-center p-1 rounded-xl bg-black/85 backdrop-blur-md border border-white/20 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  playToggle();
                  setActiveView("model");
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-display font-bold transition-all ${
                  activeView === "model"
                    ? "bg-white text-zinc-950 shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {locale === "es" ? "En Modelo" : "On Model"}
              </button>
              <button
                type="button"
                onClick={() => {
                  playToggle();
                  setActiveView("closeup");
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-display font-bold transition-all ${
                  activeView === "closeup"
                    ? "bg-white text-zinc-950 shadow"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {locale === "es" ? "Ver Playera" : "Shirt Focus"}
              </button>
              {activeTee.graphicImage && (
                <button
                  type="button"
                  onClick={() => {
                    playToggle();
                    setActiveView("graphic");
                  }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-display font-bold transition-all ${
                    activeView === "graphic"
                      ? "bg-white text-zinc-950 shadow"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  {locale === "es" ? "Gráfico HD" : "Graphic HD"}
                </button>
              )}
            </div>
          </div>

          {/* Quick Fit & Specs Strip */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-3 rounded-2xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
              <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-0.5">
                {locale === "es" ? "Corte & Caída" : "Fit & Silhouette"}
              </span>
              <p className="font-display font-bold text-zinc-900 dark:text-white leading-tight">
                {fitDescription || "Boxy Drop-Shoulder Oversized"}
              </p>
            </div>
            <div className="p-3 rounded-2xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
              <span className="text-[10px] font-mono uppercase text-zinc-500 block mb-0.5">
                {locale === "es" ? "Tejido & Gramaje" : "Fabric & Material"}
              </span>
              <p className="font-display font-bold text-zinc-900 dark:text-white leading-tight truncate">
                {fabricDescription || "100% Combed Cotton • 280-300 GSM"}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column (Lg: 5 cols): Controls, Colorways, Sizes, Actions */}
        <div className="lg:col-span-5 flex flex-col gap-5">
          {/* Active Shirt Title & Price */}
          <div className="glass-card rounded-2xl sm:rounded-3xl p-5 border border-black/[0.08] dark:border-white/[0.08]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-moya-red">
                  Good Luck Heavyweight Apparel
                </span>
                <h3 className="text-xl sm:text-2xl font-display font-extrabold text-zinc-900 dark:text-white mt-0.5">
                  {teeName}
                </h3>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xl sm:text-2xl font-mono font-extrabold text-emerald-600 dark:text-moya-green-light block">
                  {priceDisplay} USD
                </span>
                <span className="text-[10px] font-mono text-zinc-400">
                  {locale === "es" ? "Impuestos incluidos" : "Taxes computed at bag"}
                </span>
              </div>
            </div>

            {/* ── 1. Colorway Picker (4 Core Colors) ── */}
            <div className="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-xs font-display font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  {locale === "es" ? "Color de la Playera" : "Apparel Colorway"}:{" "}
                  <span className="text-moya-red font-mono font-bold normal-case">
                    {colorwayName}
                  </span>
                </label>
                <span className="text-[10px] font-mono text-zinc-400">
                  {colorwayOptions.length} {locale === "es" ? "tonos" : "colorways"}
                </span>
              </div>

              <div className="grid grid-cols-4 gap-2.5">
                {colorwayOptions.map((cw) => {
                  const isSelected = selectedColorwayId === cw.id;
                  const displayName = locale === "es" ? cw.nameEs : cw.nameEn;
                  return (
                    <button
                      key={cw.id}
                      type="button"
                      onClick={() => handleSelectColorway(cw.id)}
                      className={`group relative flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                        isSelected
                          ? "border-moya-red bg-moya-red/10 shadow-sm scale-105"
                          : "border-black/[0.08] dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-zinc-500 bg-black/5 dark:bg-white/5"
                      }`}
                    >
                      <span
                        className="w-7 h-7 rounded-full shadow-inner border transition-transform group-hover:scale-110 flex items-center justify-center"
                        style={{
                          backgroundColor: cw.hex,
                          borderColor: cw.borderHex || "rgba(255,255,255,0.3)",
                        }}
                      >
                        {isSelected && (
                          <Check
                            className={`w-3.5 h-3.5 ${
                              cw.id === "crisp-white" || cw.id === "butter-cream"
                                ? "text-zinc-900"
                                : "text-white"
                            }`}
                          />
                        )}
                      </span>
                      <span className="text-[10px] font-display font-medium text-zinc-700 dark:text-zinc-300 truncate w-full text-center leading-tight">
                        {displayName.split(" ")[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── 2. Size Selector (S, M, L, XL, 2XL) ── */}
            <div className="mt-5 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-xs font-display font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  {locale === "es" ? "Talla Streetwear" : "Streetwear Size"}:{" "}
                  <span className="text-moya-red font-mono font-bold">{selectedSize}</span>
                </label>
                <span className="text-[10px] font-display text-zinc-500">
                  {locale === "es" ? "Corte Holgado Drop-Shoulder" : "Boxy Oversized Fit"}
                </span>
              </div>

              <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {TEE_SIZES.map((size) => {
                  const isSelected = selectedSize === size;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        playClick();
                        setSelectedSize(size);
                      }}
                      className={`py-2.5 rounded-xl font-mono font-bold text-xs sm:text-sm border transition-all ${
                        isSelected
                          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 border-zinc-900 dark:border-white shadow-md scale-[1.02]"
                          : "glass-dark text-zinc-700 dark:text-zinc-300 border-black/[0.08] dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-zinc-500"
                      }`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── 3. Action Buttons ── */}
            <div className="mt-6 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={addedSuccess}
                className="w-full py-4 rounded-2xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl bg-moya-red hover:bg-rose-500 text-white shadow-moya-red/30 active:scale-[0.99] cursor-pointer"
              >
                {addedSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white" />
                    <span>{locale === "es" ? "¡Agregada a la Bolsa!" : "Added to Bag!"}</span>
                  </>
                ) : (
                  <>
                    <ShoppingBag className="w-4 h-4" />
                    <span>
                      {locale === "es"
                        ? `Añadir a la Bolsa — ${priceDisplay} USD`
                        : `Add to Bag — ${priceDisplay} USD`}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleWhatsAppOrder}
                className="w-full py-3 rounded-2xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 active:scale-[0.99] cursor-pointer"
              >
                <MessageCircle className="w-4 h-4" />
                <span>
                  {locale === "es"
                    ? "Apartar por WhatsApp (Concierge 24h)"
                    : "Inquire via WhatsApp Concierge"}
                </span>
              </button>
            </div>

            {/* Guarantees */}
            <div className="mt-4 pt-3 border-t border-black/[0.06] dark:border-white/[0.06] flex items-center justify-center gap-3 text-[11px] text-zinc-500 font-mono">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-moya-green" />
                100% Streetwear Grade
              </span>
              <span>•</span>
              <span>US Domestic Express</span>
            </div>
          </div>

          {/* Full PDP Link */}
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <Info className="w-4 h-4 text-moya-red shrink-0" />
              <span>
                {locale === "es"
                  ? "¿Deseas ver la ficha técnica completa?"
                  : "Want to inspect the detailed specs & reviews?"}
              </span>
            </div>
            <Link
              href={`/products/${activeTee.id}`}
              className="text-xs font-display font-bold text-moya-red hover:underline flex items-center gap-1 shrink-0"
            >
              <span>{locale === "es" ? "Ver Ficha" : "Full PDP"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── 4. Graphic Design Selector: All 11 Heavyweight Tees ── */}
      <div className="mt-8 sm:mt-12 pt-6 border-t border-black/[0.08] dark:border-white/[0.08]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-moya-red" />
            <h3 className="text-base sm:text-lg font-display font-bold text-zinc-900 dark:text-white">
              {locale === "es"
                ? "Elige el Diseño Gráfico (11 Playeras Streetwear)"
                : "Select Graphic Design (11 Streetwear Tees)"}
            </h3>
          </div>
          <span className="text-xs font-mono text-zinc-500">
            {SHIRT_VARIANTS.length} {locale === "es" ? "diseños" : "designs"}
          </span>
        </div>

        {/* Thumbnail Carousel / Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {SHIRT_VARIANTS.map((tee: CapVariant) => {
            const isSelected = selectedTeeId === tee.id;
            const thumbName = locale === "es" ? tee.nameEs : tee.nameEn;
            const thumbImage = tee.graphicImage || tee.image;

            return (
              <button
                key={tee.id}
                type="button"
                onClick={() => handleSelectTee(tee)}
                className={`group relative flex flex-col text-left rounded-2xl overflow-hidden border transition-all p-2 ${
                  isSelected
                    ? "border-moya-red bg-moya-red/5 ring-2 ring-moya-red/20 shadow-lg scale-[1.02]"
                    : "border-black/[0.08] dark:border-white/[0.08] hover:border-zinc-400 dark:hover:border-zinc-500 bg-black/5 dark:bg-white/5"
                }`}
              >
                <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-zinc-950 mb-2">
                  <Image
                    src={thumbImage}
                    alt={thumbName}
                    fill
                    sizes="(max-width: 768px) 50vw, 20vw"
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {/* Position Pill */}
                  <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-black/80 text-white border border-white/10">
                    {tee.printPosition === "back" ? "Back" : "Front"}
                  </span>
                </div>
                <div className="flex-1 flex flex-col justify-between">
                  <p className="text-xs font-display font-bold text-zinc-900 dark:text-white truncate">
                    {thumbName}
                  </p>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] font-mono font-bold text-emerald-600 dark:text-moya-green-light">
                      $160 USD
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-moya-red animate-pulse" />
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Fullscreen Zoom Lightbox ── */}
      <AnimatePresence>
        {isZoomOpen && (
          <div
            onClick={() => setIsZoomOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl max-h-[90vh] w-full aspect-[3/4] rounded-3xl overflow-hidden shadow-2xl"
            >
              <Image
                src={currentImage}
                alt={`${teeName} - Fullscreen`}
                fill
                unoptimized
                className="object-contain"
              />
              <button
                onClick={() => setIsZoomOpen(false)}
                className="absolute top-4 right-4 p-3 rounded-full bg-black/70 hover:bg-black text-white border border-white/20 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="absolute bottom-4 inset-x-4 p-4 rounded-2xl bg-black/80 backdrop-blur-md text-white flex items-center justify-between">
                <div>
                  <h4 className="font-display font-bold text-base">{teeName}</h4>
                  <p className="text-xs text-zinc-400 font-mono">
                    {colorwayName} • {selectedSize} • $160 USD
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsZoomOpen(false);
                    handleAddToCart();
                  }}
                  className="px-5 py-2.5 rounded-xl bg-moya-red hover:bg-rose-500 font-display font-bold text-xs uppercase tracking-wider text-white transition-colors"
                >
                  {locale === "es" ? "Añadir a la Bolsa" : "Add to Bag"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  if (isModal) {
    return (
      <AnimatePresence>
        <div
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md overflow-y-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 15 }}
            transition={{ duration: 0.25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-5xl glass-card rounded-3xl p-5 sm:p-8 border border-black/[0.08] dark:border-white/[0.08] shadow-2xl max-h-[92vh] overflow-y-auto overscroll-contain my-auto"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2.5 rounded-full glass-dark text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors z-20 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
            {content}
          </motion.div>
        </div>
      </AnimatePresence>
    );
  }

  return (
    <section id="apparel-studio" className="relative py-12 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {content}
    </section>
  );
}
