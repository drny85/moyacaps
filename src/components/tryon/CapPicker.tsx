"use client";

import Image from "next/image";
import { useRef, type KeyboardEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { TryOnCap } from "@/lib/tryOn/catalog";

/** Cap choice as a radio group: a swipeable strip on phones, a grid on desktop */
export function CapPicker({
  caps,
  selectedId,
  onSelect,
}: {
  caps: TryOnCap[];
  selectedId: string | null;
  onSelect: (cap: TryOnCap) => void;
}) {
  const t = useTranslations("tryOn");
  const locale = useLocale();
  const listRef = useRef<HTMLDivElement>(null);

  // Roving focus: arrow keys move the selection, as in a native radio group
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step || caps.length === 0) return;
    e.preventDefault();
    const index = Math.max(0, caps.findIndex((c) => c.product.id === selectedId));
    const next = caps[(index + step + caps.length) % caps.length];
    onSelect(next);
    listRef.current?.querySelector<HTMLButtonElement>(`[data-cap="${next.product.id}"]`)?.focus();
  };

  return (
    <div
      ref={listRef}
      role="radiogroup"
      aria-label={t("pickCap")}
      onKeyDown={onKeyDown}
      className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0"
    >
      {caps.map((cap) => {
        const { product } = cap;
        const name = (locale === "es" ? product.nameEs : product.nameEn).split(" / ")[0];
        const checked = product.id === selectedId;
        return (
          <button
            key={product.id}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked ? 0 : -1}
            data-cap={product.id}
            onClick={() => onSelect(cap)}
            className={`group w-[5.5rem] shrink-0 snap-start text-left focus-visible:outline-none lg:w-auto ${cap.purchasable ? "" : "opacity-60"}`}
          >
            <span
              className={`relative block aspect-[4/5] overflow-hidden rounded-xl bg-[#ECEAE6] ring-2 ring-offset-2 transition-shadow group-focus-visible:ring-moya-red dark:ring-offset-zinc-950 ${
                checked ? "ring-zinc-950 dark:ring-white" : "ring-transparent"
              }`}
            >
              <Image src={cap.thumb} alt="" fill sizes="96px" className="object-cover" />
            </span>
            <span className="mt-1.5 block truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">{name}</span>
            {!cap.purchasable && <span className="block text-[11px] text-zinc-500">{t("unavailable")}</span>}
          </button>
        );
      })}
    </div>
  );
}
