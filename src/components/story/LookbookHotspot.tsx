"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, X } from "lucide-react";
import { Link } from "@/i18n/routing";
import type { ShoppableHotspot } from "@/lib/lookbook";

/**
 * A tappable dot on a tee in a lookbook photo. Opening it shows a small product card
 * (Catalog Shot, name, price, link); Escape or a tap elsewhere closes it.
 */
export function LookbookHotspot({
  hotspot,
  open,
  onToggle,
  onClose,
}: {
  hotspot: ShoppableHotspot;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("home");
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);
  const { product } = hotspot;
  const name = locale === "es" ? product.nameEs : product.nameEn;
  const colours = product.colorways?.length ?? 0;

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  // Keep the card inside the photo: open towards the centre
  const alignRight = hotspot.x > 55;
  const openUp = hotspot.y > 58;

  return (
    <div ref={ref} className="absolute z-10" style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={t("shopHotspot", { name })}
        className="relative -ml-[22px] -mt-[22px] grid h-11 w-11 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <span aria-hidden className="absolute h-7 w-7 rounded-full bg-white/40 motion-safe:animate-ping" />
        <span
          aria-hidden
          className={`relative grid h-7 w-7 place-items-center rounded-full bg-white text-zinc-950 shadow-lg transition-transform ${open ? "rotate-45" : ""}`}
        >
          <Plus className="h-4 w-4" />
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={name}
          className={`absolute w-60 rounded-2xl bg-white p-3 text-zinc-950 shadow-2xl ${alignRight ? "right-0" : "left-0"} ${
            openUp ? "bottom-8" : "top-8"
          }`}
        >
          <div className="flex gap-3">
            <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-[#ECEAE6]">
              <Image src={hotspot.image} alt="" fill sizes="64px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-display text-sm font-semibold leading-snug">{name}</p>
              <p className="mt-1 font-display text-sm font-bold tabular-nums">${product.priceUsd}</p>
              <p className="mt-0.5 text-[12px] text-zinc-500">
                {hotspot.shownColorSold ? t("asShown") : t("otherColours", { count: colours })}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={t("closeCard")}
              className="-mr-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-zinc-500 hover:text-zinc-950"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <Link
            href={hotspot.href}
            className="mt-3 flex h-10 items-center justify-center rounded-full bg-zinc-950 font-display text-sm font-semibold text-white hover:bg-moya-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red"
          >
            {t("viewTee")}
          </Link>
        </div>
      )}
    </div>
  );
}
