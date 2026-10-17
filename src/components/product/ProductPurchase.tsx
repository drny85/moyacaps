"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, Camera, Check, MessageCircle, Share2 } from "lucide-react";
import type { CapVariant } from "@/data/caps";
import { useStore } from "@/store/useStore";
import { useSoundEffects } from "@/hooks/useSoundEffects";
import { useProductShare } from "@/lib/useProductShare";
import { getWhatsAppInquiryUrl } from "@/lib/whatsapp";
import { isTee } from "@/lib/shop";
import { DURATION, EASE } from "@/lib/motion";
import {
  cartLineId,
  colorwayStock,
  purchaseState,
  skuStock,
  teeSizes,
  type PurchaseState,
  type Selection,
  type SkuStock,
} from "@/lib/productOptions";

/**
 * Options and the one call to action for a Product (ADR 0015): colour and size for tees,
 * stock from the live SKUs, and a sticky add bar on phones once the main button scrolls away.
 */
export function ProductPurchase({
  product,
  skus,
  selection,
  onSelect,
  now,
}: {
  product: CapVariant;
  skus: SkuStock[];
  selection: Selection;
  onSelect: (next: Selection) => void;
  now: number;
}) {
  const t = useTranslations("product");
  const locale = useLocale();
  const reduceMotion = useReducedMotion() ?? false;
  const { addToCart, openCart, openDropAlert, openTryOn, currency } = useStore();
  const cart = useStore((s) => s.cart);
  const { playSuccessChime } = useSoundEffects();
  const { shareProduct } = useProductShare();

  const tee = isTee(product);
  const name = locale === "es" ? product.nameEs : product.nameEn;
  const colorway = product.colorways?.find((c) => c.id === selection.colorway);
  const colorwayName = colorway ? (locale === "es" ? colorway.nameEs : colorway.nameEn) : undefined;

  // The bag is persisted in localStorage: read it only after mount so SSR and hydration agree.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const inBag = mounted ? cart.find((i) => i.id === cartLineId(product, selection))?.quantity ?? 0 : 0;

  const state = purchaseState(product, selection, skus, inBag, now);
  const [justAdded, setJustAdded] = useState(false);
  const [sizePrompt, setSizePrompt] = useState(false);
  const sizeGroupRef = useRef<HTMLFieldSetElement>(null);

  const handlePrimary = () => {
    if (state.kind === "drop-upcoming") return openDropAlert(product);
    if (state.kind === "select-size") {
      setSizePrompt(true);
      sizeGroupRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      (sizeGroupRef.current?.querySelector("button:not([disabled])") as HTMLButtonElement | null)?.focus({ preventScroll: true });
      return;
    }
    if (state.kind !== "available") return;
    const lineStock = tee ? skuStock(skus, selection.colorway, selection.size) : product.stock;
    addToCart(
      product,
      1,
      lineStock,
      tee ? selection.size : undefined,
      tee ? selection.colorway : undefined,
      tee ? colorway?.nameEn : undefined,
      tee ? colorway?.catalogShot ?? colorway?.modelImage : undefined
    );
    playSuccessChime();
    setJustAdded(true);
  };

  useEffect(() => {
    if (!justAdded) return;
    const id = setTimeout(() => setJustAdded(false), 1800);
    return () => clearTimeout(id);
  }, [justAdded]);

  const handleWhatsApp = () => {
    const url = getWhatsAppInquiryUrl({
      name,
      quantity: 1,
      priceSingle: product.priceUsd,
      currency,
      isDrop: state.kind === "drop-upcoming",
      locale,
      size: tee ? selection.size : undefined,
      colorway: tee ? colorway?.nameEn : undefined,
      silhouette: product.silhouette,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Sticky add bar (phones): visible once the main button has scrolled above the viewport.
  const primaryRef = useRef<HTMLDivElement>(null);
  const [showSticky, setShowSticky] = useState(false);
  useEffect(() => {
    const el = primaryRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => {
      setShowSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const label = ctaLabel(state, t, product);
  const enabled = state.kind === "available" || state.kind === "select-size" || state.kind === "drop-upcoming";
  const lowStock =
    state.kind === "available" && state.available + state.inBag <= 3 ? state.available + state.inBag : null;

  return (
    <div className="flex flex-col gap-6">
      {tee && product.colorways && product.colorways.length > 0 && (
        <fieldset>
          <legend className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            {t("colour")}: <span className="font-semibold text-zinc-900 dark:text-white">{colorwayName}</span>
          </legend>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("colour")}>
            {product.colorways.map((c) => {
              const active = c.id === selection.colorway;
              const empty = skus.length > 0 && colorwayStock(skus, c.id) <= 0;
              const cName = locale === "es" ? c.nameEs : c.nameEn;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={empty ? `${cName}, ${t("soldOut")}` : cName}
                  onClick={() => onSelect({ ...selection, colorway: c.id })}
                  className={`relative h-11 w-11 rounded-full p-1 transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red ${
                    active ? "ring-2 ring-zinc-900 dark:ring-white" : "ring-1 ring-zinc-300 hover:ring-zinc-500 dark:ring-white/20"
                  }`}
                >
                  <span className="block h-full w-full rounded-full border" style={{ backgroundColor: c.hex, borderColor: c.borderHex }} />
                  {empty && (
                    <span aria-hidden className="absolute inset-0 grid place-items-center">
                      <span className="h-[2px] w-9 rotate-45 rounded bg-zinc-500" />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {tee ? (
        <fieldset ref={sizeGroupRef}>
          <legend className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
            {t("size")}
            {selection.size && <span className="font-semibold text-zinc-900 dark:text-white">: {selection.size}</span>}
          </legend>
          <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={t("size")}>
            {teeSizes(product).map((size) => {
              const stock = skuStock(skus, selection.colorway, size);
              const soldOut = stock <= 0;
              const active = size === selection.size;
              return (
                <button
                  key={size}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={soldOut}
                  aria-label={soldOut ? t("sizeUnavailable", { size }) : size}
                  onClick={() => {
                    setSizePrompt(false);
                    onSelect({ ...selection, size });
                  }}
                  className={`relative h-12 rounded-xl border font-display text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red ${
                    active
                      ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-950"
                      : soldOut
                        ? "cursor-not-allowed border-dashed border-zinc-300 text-zinc-400 line-through dark:border-white/15 dark:text-zinc-600"
                        : sizePrompt
                          ? "border-moya-red text-zinc-900 dark:text-white"
                          : "border-zinc-300 text-zinc-900 hover:border-zinc-900 dark:border-white/20 dark:text-white dark:hover:border-white"
                  }`}
                >
                  {size}
                  {!soldOut && stock <= 3 && (
                    <span className={`absolute -bottom-5 left-0 right-0 text-[11px] font-medium no-underline ${active ? "text-moya-red" : "text-zinc-500"}`}>
                      {t("sizeLeft", { count: stock })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {sizePrompt && (
            <p role="alert" className="mt-6 text-sm font-medium text-moya-red">
              {t("selectSize")}
            </p>
          )}
        </fieldset>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {product.silhouette === "trucker" ? t("truckerOneSize") : t("oneSize")}
        </p>
      )}

      <div ref={primaryRef} className={`flex flex-col gap-2 ${tee ? "pt-2" : ""}`}>
        <PrimaryButton label={label} enabled={enabled} added={justAdded} state={state} onClick={handlePrimary} t={t} />
        <StatusLine state={state} lowStock={lowStock} onViewBag={openCart} t={t} />

        <div className="mt-2 flex flex-wrap gap-2">
          <SecondaryButton onClick={handleWhatsApp} icon={<MessageCircle className="h-4 w-4" />}>
            {t("askWhatsApp")}
          </SecondaryButton>
          <SecondaryButton
            onClick={() => shareProduct({ id: product.id, name, image: colorway?.catalogShot ?? product.catalogShot ?? product.image })}
            icon={<Share2 className="h-4 w-4" />}
          >
            {t("share")}
          </SecondaryButton>
          {!tee && (
            <SecondaryButton onClick={() => openTryOn(product)} icon={<Camera className="h-4 w-4" />}>
              {t("tryOn")}
            </SecondaryButton>
          )}
        </div>
      </div>

      {/* Sticky add bar for phones; the global action bar is hidden on product pages */}
      <AnimatePresence>
        {showSticky && (
          <motion.div
            className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-white/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-md dark:border-white/[0.08] dark:bg-zinc-950/95 lg:hidden"
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: DURATION.fast, ease: EASE.out }}
          >
            <div className="mx-auto flex max-w-md items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{name}</p>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">
                  ${product.priceUsd}
                  {colorwayName ? ` · ${colorwayName}` : ""}
                  {selection.size ? ` · ${selection.size}` : ""}
                </p>
              </div>
              <div className="w-[52%] shrink-0">
                <PrimaryButton label={label} enabled={enabled} added={justAdded} state={state} onClick={handlePrimary} t={t} compact />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type T = ReturnType<typeof useTranslations>;

function ctaLabel(state: PurchaseState, t: T, product: CapVariant): string {
  switch (state.kind) {
    case "drop-upcoming":
      return t("notifyMe");
    case "sold-out":
      return t("soldOut");
    case "colorway-sold-out":
      return t("colourSoldOut");
    case "select-size":
      return t("selectSize");
    case "size-sold-out":
      return t("sizeSoldOut");
    case "max-in-bag":
      return t("inBag", { count: state.inBag });
    case "available":
      return `${t("addToBag")} · $${product.priceUsd}`;
  }
}

function PrimaryButton({
  label,
  enabled,
  added,
  state,
  onClick,
  t,
  compact = false,
}: {
  label: string;
  enabled: boolean;
  added: boolean;
  state: PurchaseState;
  onClick: () => void;
  t: T;
  compact?: boolean;
}) {
  const isDrop = state.kind === "drop-upcoming";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled && !added}
      aria-live="polite"
      className={`inline-flex w-full items-center justify-center gap-2 rounded-full font-display font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950 ${
        compact ? "h-12 text-[15px]" : "h-14 text-base"
      } ${
        added
          ? "bg-moya-green text-white"
          : enabled
            ? isDrop
              ? "bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-950"
              : "bg-moya-red text-white hover:bg-moya-red-deep"
            : "cursor-not-allowed bg-zinc-200 text-zinc-500 dark:bg-white/10 dark:text-zinc-400"
      }`}
    >
      {added ? (
        <>
          <Check className="h-5 w-5" />
          {t("added")}
        </>
      ) : (
        <>
          {isDrop && <Bell className="h-4 w-4" />}
          {label}
        </>
      )}
    </button>
  );
}

function StatusLine({
  state,
  lowStock,
  onViewBag,
  t,
}: {
  state: PurchaseState;
  lowStock: number | null;
  onViewBag: () => void;
  t: T;
}) {
  const inBag = state.kind === "available" || state.kind === "max-in-bag" ? state.inBag : 0;
  if (state.kind === "drop-upcoming" && state.dropDate) {
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {t("dropsOn", { date: new Date(state.dropDate).toLocaleDateString(undefined, { month: "long", day: "numeric" }) })}
      </p>
    );
  }
  if (!inBag && !lowStock) return null;
  return (
    <p className="flex flex-wrap items-center gap-x-3 text-sm text-zinc-600 dark:text-zinc-400">
      {lowStock && <span className="font-medium text-moya-red">{t("fewLeft", { count: lowStock })}</span>}
      {state.kind === "max-in-bag" ? <span>{t("maxInBag")}</span> : inBag > 0 && <span>{t("inBag", { count: inBag })}</span>}
      {inBag > 0 && (
        <button type="button" onClick={onViewBag} className="font-semibold text-zinc-900 underline underline-offset-4 dark:text-white">
          {t("viewBag")}
        </button>
      )}
    </p>
  );
}

function SecondaryButton({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 items-center gap-2 rounded-full border border-zinc-300 px-4 text-sm font-semibold text-zinc-800 hover:border-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red dark:border-white/15 dark:text-zinc-200 dark:hover:border-white"
    >
      {icon}
      {children}
    </button>
  );
}
