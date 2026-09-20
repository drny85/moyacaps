"use client";

import { useStore } from "@/store/useStore";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { X, ShoppingBag, MessageCircle, ShieldCheck, Check, ArrowUpRight, Bell } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";

export function ProductQuickView() {
  const { quickViewCap, closeQuickView, openDropAlert, addToCart, cart } = useStore();
  useLockBodyScroll(Boolean(quickViewCap));
  const t = useTranslations("quickView");
  const locale = useLocale();
  const [quantity, setQuantity] = useState(1);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const convexVariants = useQuery(api.products.getVariants, {});

  useEffect(() => {
    setIsMounted(true);
    setQuantity(1);
  }, [quickViewCap?.id]);

  if (!quickViewCap) return null;

  const liveVariant = convexVariants?.find((v) => v.variantId === quickViewCap.id);
  const stock = liveVariant ? (typeof liveVariant.stock === "number" ? liveVariant.stock : 0) : (quickViewCap.stock ?? 0);
  const isOutOfStock = stock <= 0;

  const dropStatus = liveVariant?.dropStatus ?? quickViewCap.dropStatus;
  const isDrop = Boolean(
    (liveVariant?.isDrop ?? quickViewCap.isDrop) &&
    dropStatus !== "live" &&
    (((liveVariant?.dropDate ?? quickViewCap.dropDate) &&
      Date.now() < (liveVariant?.dropDate ?? quickViewCap.dropDate ?? 0)) ||
      dropStatus === "scheduled")
  );

  const name = locale === "es" ? quickViewCap.nameEs : quickViewCap.nameEn;
  const inCartItem = isMounted ? cart.find((i) => i.id === quickViewCap.id) : undefined;
  const inCartQty = inCartItem?.quantity || 0;
  const isInCart = inCartQty > 0;
  const maxAvailableToAdd = Math.max(0, stock - inCartQty);

  const priceDisplay = `$${quickViewCap.priceUsd * Math.max(1, quantity)}.00 USD`;

  const handleAdd = () => {
    if (isDrop || isOutOfStock || maxAvailableToAdd <= 0) return;
    const addQty = Math.min(maxAvailableToAdd, Math.max(1, quantity));
    addToCart(quickViewCap, addQty, stock);
    setAddedSuccess(true);
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.7 },
      colors: ["#e11d48", "#059669", "#a855f7"],
    });
    setTimeout(() => {
      setAddedSuccess(false);
      closeQuickView();
    }, 1200);
  };

  const handleWhatsAppBuy = () => {
    if (isDrop) {
      closeQuickView();
      openDropAlert(quickViewCap);
      return;
    }
    if (isOutOfStock) return;
    const greeting =
      locale === "es"
        ? `¡Hola Moya Caps! Deseo comprar ${quantity} pieza(s) de la gorra: ${name} (Edición Good Luck 0880). Por favor indíquenme los métodos de pago disponibles.`
        : `Hi Moya Caps! I want to purchase ${quantity} piece(s) of: ${name} (Good Luck 0880 Edition). Please let me know how to complete my payment.`;

    const encoded = encodeURIComponent(greeting);
    window.open(`https://wa.me/5215500000000?text=${encoded}`, "_blank");
  };

  return (
    <AnimatePresence>
      <div
        onClick={closeQuickView}
        data-lenis-prevent
        className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 pt-3 sm:pt-4 pb-24 sm:pb-4 bg-black/80 backdrop-blur-md overflow-y-auto overscroll-contain"
        style={{ overscrollBehavior: "contain" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -15 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          data-lenis-prevent
          className="relative w-full max-w-3xl glass-card rounded-2xl sm:rounded-3xl p-4 sm:p-8 pb-6 sm:pb-8 border border-black/[0.08] dark:border-white/[0.06] shadow-2xl max-h-[86vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain"
          style={{ overscrollBehavior: "contain" }}
        >
          {/* Close */}
          <button
            onClick={closeQuickView}
            className="absolute top-4 right-4 p-2 rounded-full glass-dark text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors z-20"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-8 items-center">
            {/* Left: Image */}
            <div className="relative aspect-[4/3] sm:aspect-square rounded-2xl bg-gradient-to-b from-black/[0.02] dark:from-white/[0.03] to-transparent flex items-center justify-center p-3 sm:p-4 border border-black/[0.06] dark:border-white/[0.06]">
              <div className="relative w-full h-full">
                <Image
                  src={quickViewCap.image}
                  alt={name}
                  fill
                  className="object-contain drop-shadow-[0_20px_35px_rgba(0,0,0,0.25)] dark:drop-shadow-[0_20px_35px_rgba(0,0,0,0.8)]"
                />
              </div>

              {/* Colorway Badge */}
              <div className="absolute bottom-3 left-3 flex items-center gap-1.5 glass-dark px-2.5 py-1 rounded-full text-xs text-zinc-700 dark:text-zinc-400 border border-black/[0.06] dark:border-white/[0.06]">
                <span
                  className="w-3 h-3 rounded-full border border-white/40 dark:border-white/20"
                  style={{ backgroundColor: quickViewCap.primaryHex }}
                />
                <span
                  className="w-3 h-3 rounded-full border border-white/40 dark:border-white/20"
                  style={{ backgroundColor: quickViewCap.secondaryHex }}
                />
                <span className="font-mono text-[10px]">Dual Tone</span>
              </div>
            </div>

            {/* Right: Details */}
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-xs font-mono uppercase tracking-widest text-moya-red font-bold">
                  {quickViewCap.silhouette === "trucker" ? "Trucker Edition" : "6-Panel Snapback"}
                </span>
                <h2 className="text-2xl font-display font-bold text-zinc-900 dark:text-white mt-1">{name}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <div className="text-xl font-bold font-mono text-emerald-600 dark:text-moya-green-light">
                    {priceDisplay}
                  </div>
                  {isInCart && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 text-[11px] font-display font-semibold shadow-sm animate-pulse">
                      <Check className="w-3 h-3" />
                      <span>{t("inCartNotice", { count: inCartQty })}</span>
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2.5 text-xs text-zinc-700 dark:text-zinc-300 border-y border-black/[0.06] dark:border-white/[0.06] py-3">
                <div className="flex justify-between">
                  <span className="text-zinc-500">{t("silhouetteLabel")}:</span>
                  <span className="font-semibold text-zinc-900 dark:text-white font-display">
                    {quickViewCap.silhouette === "trucker"
                      ? t("silhouetteTrucker")
                      : t("silhouetteSnapback")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">{t("sizeLabel")}:</span>
                  <span className="font-semibold text-zinc-900 dark:text-white font-display">{t("sizeValue")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">{t("materialsLabel")}:</span>
                  <span className="font-semibold text-zinc-900 dark:text-white font-display">{t("materialsValue")}</span>
                </div>
              </div>

              {/* Quantity */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600 dark:text-zinc-500 font-display font-semibold">{t("qty")}:</span>
                  {isOutOfStock ? (
                    <span className="text-[10px] font-display font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                      {t("soldOut")}
                    </span>
                  ) : stock <= 5 ? (
                    <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                      {t("stockLeft", { count: stock })}
                    </span>
                  ) : null}
                </div>

                <div className="flex items-center glass-dark rounded-xl border border-black/[0.08] dark:border-white/[0.06]">
                  <button
                    disabled={isOutOfStock || quantity <= 1}
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className={`px-3 py-1.5 text-sm font-bold transition-colors ${
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
                    className={`px-3 py-1.5 text-sm font-bold transition-colors ${
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

              {/* Buttons */}
              <div className="flex flex-col gap-2.5 mt-2">
                {isDrop ? (
                  <button
                    onClick={() => {
                      closeQuickView();
                      openDropAlert(quickViewCap);
                    }}
                    className="w-full py-3.5 rounded-2xl font-display font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl shadow-moya-red-deep/40 bg-gradient-to-r from-moya-red via-rose-600 to-amber-600 hover:brightness-110 active:scale-[0.98] text-white"
                  >
                    <Bell className="w-4 h-4" />
                    <span>{locale === "es" ? "Solicitar Alerta VIP" : "Claim VIP Drop Alert"}</span>
                  </button>
                ) : (
                  <button
                    onClick={handleAdd}
                    disabled={addedSuccess || isOutOfStock || maxAvailableToAdd <= 0}
                    className={`w-full py-3.5 rounded-2xl font-display font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${
                      isOutOfStock || maxAvailableToAdd <= 0
                        ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
                        : addedSuccess
                        ? "bg-emerald-600 text-white shadow-xl shadow-emerald-950/50"
                        : isInCart
                        ? "bg-emerald-600/25 hover:bg-emerald-600/35 active:bg-emerald-600/45 text-emerald-300 border border-emerald-500/40 shadow-xl shadow-emerald-950/40"
                        : "bg-moya-red hover:bg-rose-500 text-white shadow-xl shadow-moya-red-deep/50"
                    }`}
                  >
                    {isOutOfStock ? (
                      <span>{t("soldOut")}</span>
                    ) : maxAvailableToAdd <= 0 ? (
                      <span>{t("maxReached")}</span>
                    ) : addedSuccess ? (
                      <>
                        <Check className="w-4 h-4 text-white" />
                        <span>{t("addedSuccess")}</span>
                      </>
                    ) : isInCart ? (
                      <>
                        <ShoppingBag className="w-4 h-4 text-emerald-400" />
                        <span>{t("addMoreBtn", { count: inCartQty })}</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        <span>{t("addToCart")}</span>
                      </>
                    )}
                  </button>
                )}

                {!isDrop && (
                  <button
                    onClick={handleWhatsAppBuy}
                    disabled={isOutOfStock}
                    className={`w-full py-3 rounded-2xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
                      isOutOfStock
                        ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed opacity-50"
                        : "bg-moya-green-deep/80 hover:bg-moya-green text-white shadow-moya-green-deep/40"
                    }`}
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{isOutOfStock ? t("soldOut") : t("buyNow")}</span>
                  </button>
                )}

                <Link
                  href={`/caps/${quickViewCap.id}`}
                  onClick={closeQuickView}
                  className="w-full py-2.5 rounded-xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white font-display font-semibold text-xs transition-all flex items-center justify-center gap-1.5 border border-black/[0.06] dark:border-white/[0.06] mt-0.5"
                >
                  <span>{t("viewFullSpecs")}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-moya-red" />
                </Link>
              </div>

              <div className="flex items-center gap-2 text-[10px] text-zinc-600 mt-1">
                <ShieldCheck className="w-4 h-4 text-moya-green shrink-0" />
                <span>{t("shippingNotice")}</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
