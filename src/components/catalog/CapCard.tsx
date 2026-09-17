"use client";

import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { useStore } from "@/store/useStore";
import type { CapVariant } from "@/data/caps";
import { ShoppingBag, Eye, Sparkles, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useRef, useCallback, useState, useEffect } from "react";

export function CapCard({ cap, index = 0 }: { cap: CapVariant; index?: number }) {
  const t = useTranslations("catalog");
  const locale = useLocale();
  const { addToCart, openQuickView, currency, cart } = useStore();
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const inCartItem = isMounted ? cart.find((i) => i.id === cap.id) : undefined;
  const inCartQty = inCartItem?.quantity || 0;
  const isInCart = inCartQty > 0;

  const name = locale === "es" ? cap.nameEs : cap.nameEn;
  const tag = locale === "es" ? cap.tagEs : cap.tagEn;
  const priceDisplay =
    currency === "USD" ? `$${cap.priceUsd}` : `$${cap.priceMxn} MXN`;

  // 3D tilt effect on mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) scale(1.02)`;
  }, []);

  const handleMouseLeave = useCallback(() => {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = "perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)";
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`group relative glass-card rounded-2xl p-2.5 sm:p-3 flex flex-col border transition-all duration-500 ease-out cursor-pointer shadow-lg hover:shadow-2xl ${
          isInCart
            ? "border-emerald-500/40 shadow-emerald-950/20 bg-emerald-950/[0.05] hover:border-emerald-400/60 hover:shadow-emerald-950/40"
            : "border-white/[0.06] hover:border-moya-red/30 hover:shadow-moya-red-deep/20"
        }`}
        style={{ transformStyle: "preserve-3d", transition: "transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.3s, box-shadow 0.3s" }}
      >
        {/* ── Tags Row ── */}
        <div className="flex items-center justify-between mb-2 z-10">
          <div className="flex items-center gap-1.5 overflow-hidden">
            {tag ? (
              <span className="sticker-badge sticker-badge--red text-[8px] sm:text-[9px] py-0.5 px-1.5 sm:px-2">
                <Sparkles className="w-2 h-2" />
                <span className="truncate max-w-[65px] sm:max-w-none">{tag}</span>
              </span>
            ) : (
              <span className="text-[9px] sm:text-[10px] font-display font-semibold text-zinc-500 uppercase tracking-wider">
                {cap.silhouette === "trucker" ? "Trucker" : "Snapback"}
              </span>
            )}

            {isInCart && (
              <span className="flex items-center gap-1 px-1.5 sm:px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-display font-semibold text-[8px] sm:text-[9px] shadow-sm animate-pulse">
                <Check className="w-2.5 h-2.5" />
                <span>{t("inCartBadge", { count: inCartQty })}</span>
              </span>
            )}
          </div>

          {/* Colorway swatches */}
          <div className="flex items-center gap-1 shrink-0">
            <span
              className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full border-2 border-white/20 shadow-sm"
              style={{ backgroundColor: cap.primaryHex }}
              title="Crown"
            />
            <span
              className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full border-2 border-white/20 shadow-sm"
              style={{ backgroundColor: cap.secondaryHex }}
              title="Accent"
            />
          </div>
        </div>

        {/* ── Cap Image ── */}
        <div
          onClick={() => openQuickView(cap)}
          className="relative w-full aspect-square rounded-xl bg-gradient-to-b from-white/[0.03] to-transparent flex items-center justify-center p-2 overflow-hidden"
        >
          {/* Skeleton shimmer while loading */}
          {!imageLoaded && <div className="absolute inset-[10%] skeleton rounded-2xl" />}

          <div className="relative w-full h-full transition-transform duration-600 ease-out group-hover:scale-110">
            <Image
              src={cap.image}
              alt={name}
              fill
              className={`object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.7)] transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              onLoad={() => setImageLoaded(true)}
            />
          </div>

          {/* ── Slide-up Quick View (hover reveal) ── */}
          <div className="absolute bottom-0 inset-x-0 p-2 slide-up-reveal">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openQuickView(cap);
              }}
              className="w-full py-2 rounded-xl glass-dark text-white text-[11px] font-display font-semibold flex items-center justify-center gap-1.5 hover:bg-white/15 transition-colors"
            >
              <Eye className="w-3 h-3" />
              <span>{t("quickView")}</span>
            </button>
          </div>
        </div>

        {/* ── Product Info ── */}
        <div className="mt-2.5 sm:mt-3 pt-2 border-t border-white/[0.05] flex flex-col gap-1.5">
          <div className="flex items-start justify-between gap-1">
            <h3
              onClick={() => openQuickView(cap)}
              className="font-display font-bold text-xs sm:text-sm text-white hover:text-moya-red-light transition-colors cursor-pointer line-clamp-1"
            >
              {name}
            </h3>
            <span className="text-xs font-mono font-bold text-moya-green-light shrink-0">
              {priceDisplay}
            </span>
          </div>

          {/* Stock indicator (desktop) */}
          <div className="hidden sm:flex items-center justify-between text-[10px] text-zinc-500">
            <span className="flex items-center gap-1 text-moya-green text-[10px] font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-moya-green animate-pulse" />
              {t("inStock")}
            </span>
            <span className="font-mono uppercase tracking-wider">
              0880
            </span>
          </div>

          {/* ── Add to Cart ── */}
          {isInCart ? (
            <button
              onClick={() => addToCart(cap)}
              className="w-full py-2 sm:py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 active:bg-emerald-600/40 text-emerald-300 border border-emerald-500/40 font-display font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all hover:shadow-lg hover:shadow-emerald-950/40 flex items-center justify-center gap-1.5 active:scale-95 mt-0.5"
            >
              <Check className="w-3 sm:w-3.5 h-3 sm:h-3.5 text-emerald-400" />
              <span>{t("inCartBtn", { count: inCartQty })}</span>
            </button>
          ) : (
            <button
              onClick={() => addToCart(cap)}
              className="w-full py-2 sm:py-2.5 rounded-xl bg-moya-red hover:bg-rose-500 active:bg-moya-red-deep text-white font-display font-bold text-[10px] sm:text-xs uppercase tracking-wider transition-all hover:shadow-lg hover:shadow-moya-red-deep/40 flex items-center justify-center gap-1.5 active:scale-95 mt-0.5"
            >
              <ShoppingBag className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
              <span>{t("addToCart")}</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
