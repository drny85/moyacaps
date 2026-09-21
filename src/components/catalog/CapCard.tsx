"use client";

import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { useStore } from "@/store/useStore";
import type { CapVariant } from "@/data/caps";
import { ShoppingBag, Eye, Sparkles, Check, Bell, Clock, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { useRef, useCallback, useState, useEffect } from "react";
import { useProductShare } from "@/lib/useProductShare";

export function CapCard({ cap, index = 0 }: { cap: CapVariant; index?: number }) {
  const t = useTranslations("catalog");
  const tShare = useTranslations("share");
  const locale = useLocale();
  const { addToCart, openQuickView, openDropAlert, currency, cart } = useStore();
  const { shareProduct } = useProductShare();
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const inCartItem = isMounted ? cart.find((i) => i.id === cap.id) : undefined;
  const inCartQty = inCartItem?.quantity || 0;
  const isInCart = inCartQty > 0;
  const stock = typeof cap.stock === "number" ? cap.stock : 0;
  const isOutOfStock = stock <= 0;
  const isMaxInCart = inCartQty >= stock;

  const isDropUpcoming = Boolean(
    cap.isDrop &&
    cap.dropStatus !== "live" &&
    ((cap.dropDate && Date.now() < cap.dropDate) || cap.dropStatus === "scheduled")
  );
  const dropBadge = locale === "es" ? cap.dropBadgeTextEs || cap.dropBadgeTextEn : cap.dropBadgeTextEn;

  const name = locale === "es" ? cap.nameEs : cap.nameEn;
  const tag = locale === "es" ? cap.tagEs : cap.tagEn;
  const priceDisplay = `$${cap.priceUsd} USD`;

  const handleShare = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      shareProduct({
        id: cap.id,
        name,
        image: cap.image,
      });
    },
    [cap.id, cap.image, name, shareProduct]
  );

  // 3D tilt effect on mouse move (desktop hover only)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (typeof window !== "undefined" && window.matchMedia("(hover: none)").matches) {
      return;
    }
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
      className="w-full min-w-0"
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={`group relative glass-card rounded-xl sm:rounded-2xl p-2 sm:p-3 flex flex-col border transition-all duration-500 ease-out cursor-pointer shadow-lg hover:shadow-2xl w-full min-w-0 overflow-hidden ${
          isInCart
            ? "border-emerald-500/40 shadow-emerald-950/10 dark:shadow-emerald-950/20 bg-emerald-950/[0.03] dark:bg-emerald-950/[0.05] hover:border-emerald-400/60 hover:shadow-emerald-950/30"
            : "border-black/[0.06] dark:border-white/[0.06] hover:border-moya-red/30 hover:shadow-moya-red-deep/10 dark:hover:shadow-moya-red-deep/20"
        }`}
        style={{ transformStyle: "preserve-3d", transition: "transform 0.4s cubic-bezier(0.23, 1, 0.32, 1), border-color 0.3s, box-shadow 0.3s" }}
      >
        {/* ── Tags Row ── */}
        <div className="flex items-center justify-between mb-1.5 sm:mb-2 z-10 w-full min-w-0">
          <div className="flex items-center gap-1 sm:gap-1.5 overflow-hidden min-w-0 flex-1">
            {isDropUpcoming ? (
              <span className="inline-flex items-center gap-1 text-[7.5px] sm:text-[9px] py-0.5 px-1.5 sm:px-2 rounded-full bg-gradient-to-r from-moya-red/20 to-amber-500/20 border border-moya-red/50 text-moya-red dark:text-moya-red-light font-mono font-bold uppercase tracking-wider shrink-0 animate-pulse">
                <Bell className="w-2 sm:w-2.5 h-2 sm:h-2.5 shrink-0" />
                <span className="truncate max-w-[65px] xs:max-w-[85px] sm:max-w-none">{dropBadge || t("upcomingDrop")}</span>
              </span>
            ) : tag ? (
              <span className="sticker-badge sticker-badge--red text-[7.5px] sm:text-[9px] py-0.5 px-1 sm:px-2 shrink-0">
                <Sparkles className="w-2 h-2 shrink-0" />
                <span className="truncate max-w-[45px] xs:max-w-[70px] sm:max-w-none">{tag}</span>
              </span>
            ) : (
              <span className="text-[8px] sm:text-[10px] font-display font-semibold text-zinc-600 dark:text-zinc-500 uppercase tracking-wider truncate">
                {cap.silhouette === "trucker" ? "Trucker" : "Snapback"}
              </span>
            )}

            {isInCart && (
              <span className="flex items-center gap-0.5 sm:gap-1 px-1 sm:px-2 py-0.5 rounded-full bg-emerald-500/15 dark:bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-display font-semibold text-[7.5px] sm:text-[9px] shadow-sm shrink-0">
                <Check className="w-2 sm:w-2.5 h-2 sm:h-2.5 shrink-0" />
                <span className="truncate max-w-[50px] sm:max-w-none">{inCartQty > 1 ? inCartQty : t("inCartBadge", { count: inCartQty })}</span>
              </span>
            )}
          </div>

          {/* Colorway swatches & Share action */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 ml-1">
            <button
              onClick={handleShare}
              className="p-1 rounded-full text-zinc-400 hover:text-moya-red hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
              title={tShare("tooltip")}
              aria-label={tShare("button")}
            >
              <Share2 className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            </button>
            <div className="flex items-center gap-0.5 sm:gap-1">
              <span
                className="w-2 sm:w-2.5 md:w-3 h-2 sm:h-2.5 md:h-3 rounded-full border border-white/40 dark:border-white/20 shadow-sm"
                style={{ backgroundColor: cap.primaryHex }}
                title="Crown"
              />
              <span
                className="w-2 sm:w-2.5 md:w-3 h-2 sm:h-2.5 md:h-3 rounded-full border border-white/40 dark:border-white/20 shadow-sm"
                style={{ backgroundColor: cap.secondaryHex }}
                title="Accent"
              />
            </div>
          </div>
        </div>

        {/* ── Cap Image ── */}
        <div
          onClick={() => openQuickView(cap)}
          className="relative w-full aspect-square rounded-lg sm:rounded-xl bg-gradient-to-b from-black/[0.02] dark:from-white/[0.03] to-transparent flex items-center justify-center p-1.5 sm:p-2 overflow-hidden"
        >
          {/* Skeleton shimmer while loading */}
          {!imageLoaded && <div className="absolute inset-[10%] skeleton rounded-xl" />}

          <div className="relative w-full h-full transition-transform duration-500 ease-out group-hover:scale-105">
            <Image
              src={cap.image}
              alt={name}
              fill
              className={`object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.18)] dark:drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)] transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              sizes="(max-width: 640px) 48vw, (max-width: 1024px) 33vw, 25vw"
              onLoad={() => setImageLoaded(true)}
            />
          </div>

          {/* ── Slide-up Quick View (hover reveal on desktop) ── */}
          <div className="hidden sm:block absolute bottom-0 inset-x-0 p-2 slide-up-reveal">
            <button
              onClick={(e) => {
                e.stopPropagation();
                openQuickView(cap);
              }}
              className="w-full py-2 rounded-xl glass-dark text-zinc-900 dark:text-white text-[11px] font-display font-semibold flex items-center justify-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/15 transition-colors shadow-md"
            >
              <Eye className="w-3 h-3" />
              <span>{t("quickView")}</span>
            </button>
          </div>
        </div>

        {/* ── Product Info ── */}
        <div className="mt-2 sm:mt-3 pt-1.5 sm:pt-2 border-t border-black/[0.06] dark:border-white/[0.05] flex flex-col gap-1 sm:gap-1.5 w-full min-w-0">
          <div className="flex items-baseline justify-between gap-1 w-full min-w-0">
            <Link
              href={`/caps/${cap.id}`}
              className="font-display font-bold text-[11px] sm:text-sm text-zinc-900 dark:text-white hover:text-moya-red transition-colors truncate min-w-0 flex-1"
              title={name}
            >
              {name}
            </Link>
            <span className="text-[10px] sm:text-xs font-mono font-bold text-emerald-600 dark:text-moya-green-light shrink-0 whitespace-nowrap">
              {priceDisplay}
            </span>
          </div>

          {/* Stock indicator (desktop) */}
          <div className="hidden sm:flex items-center justify-between text-[10px] text-zinc-500">
            {isDropUpcoming ? (
              <span className="flex items-center gap-1 text-moya-red dark:text-moya-red-light text-[10px] font-mono font-semibold">
                <Clock className="w-3 h-3 text-amber-500" />
                <span>{t("upcomingDrop")}</span>
              </span>
            ) : isOutOfStock ? (
              <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400 text-[10px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400" />
                {t("soldOut")}
              </span>
            ) : stock <= 5 ? (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[10px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400 animate-pulse" />
                {t("limited")} ({stock})
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-600 dark:text-moya-green text-[10px] font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-moya-green animate-pulse" />
                {t("inStock")}
              </span>
            )}
            <span className="font-mono uppercase tracking-wider">
              0880
            </span>
          </div>

          {/* ── Add to Cart / VIP Drop Alert ── */}
          {isDropUpcoming ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openDropAlert(cap);
              }}
              className="w-full py-1.5 sm:py-2.5 px-1.5 sm:px-2 rounded-lg sm:rounded-xl bg-gradient-to-r from-moya-red via-rose-600 to-amber-600 hover:brightness-110 active:scale-95 text-white font-display font-bold text-[9px] sm:text-xs uppercase tracking-wider transition-all shadow-md shadow-moya-red-deep/30 flex items-center justify-center gap-1 sm:gap-1.5 mt-0.5 min-w-0"
            >
              <Bell className="w-3 sm:w-3.5 h-3 sm:h-3.5 shrink-0" />
              <span className="truncate">{t("vipAlert")}</span>
            </button>
          ) : isOutOfStock ? (
            <button
              disabled
              className="w-full py-1.5 sm:py-2.5 px-1.5 sm:px-2 rounded-lg sm:rounded-xl bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 font-display font-bold text-[9px] sm:text-xs uppercase tracking-wider cursor-not-allowed mt-0.5 min-w-0"
            >
              <span>{t("soldOut")}</span>
            </button>
          ) : isMaxInCart ? (
            <button
              disabled
              className="w-full py-1.5 sm:py-2.5 px-1.5 sm:px-2 rounded-lg sm:rounded-xl bg-emerald-600/10 dark:bg-emerald-600/15 text-emerald-700 dark:text-emerald-400/80 border border-emerald-500/30 font-display font-bold text-[9px] sm:text-xs uppercase tracking-wider cursor-not-allowed mt-0.5 min-w-0"
            >
              <Check className="w-3 sm:w-3.5 h-3 sm:h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">{t("maxStockReached")} ({inCartQty})</span>
            </button>
          ) : isInCart ? (
            <button
              onClick={() => addToCart(cap, 1, stock)}
              className="w-full py-1.5 sm:py-2.5 px-1.5 sm:px-2 rounded-lg sm:rounded-xl bg-emerald-600/15 dark:bg-emerald-600/20 hover:bg-emerald-600/25 dark:hover:bg-emerald-600/30 active:bg-emerald-600/40 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 font-display font-bold text-[9px] sm:text-xs uppercase tracking-wider transition-all hover:shadow-lg hover:shadow-emerald-950/10 dark:hover:shadow-emerald-950/40 flex items-center justify-center gap-1 sm:gap-1.5 active:scale-95 mt-0.5 min-w-0"
            >
              <Check className="w-3 sm:w-3.5 h-3 sm:h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">{t("inCartBtn", { count: inCartQty })}</span>
            </button>
          ) : (
            <button
              onClick={() => addToCart(cap, 1, stock)}
              className="w-full py-1.5 sm:py-2.5 px-1.5 sm:px-2 rounded-lg sm:rounded-xl bg-moya-red hover:bg-rose-500 active:bg-moya-red-deep text-white font-display font-bold text-[9px] sm:text-xs uppercase tracking-wider transition-all hover:shadow-lg hover:shadow-moya-red-deep/40 flex items-center justify-center gap-1 sm:gap-1.5 active:scale-95 mt-0.5 min-w-0"
            >
              <ShoppingBag className="w-3 sm:w-3.5 h-3 sm:h-3.5 shrink-0" />
              <span className="truncate">{t("addToCart")}</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
