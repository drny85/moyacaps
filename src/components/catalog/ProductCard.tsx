"use client";

import Image from "next/image";
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { CapVariant } from "@/data/caps";
import { isPurchasable, isTee, type ShopItem } from "@/lib/shop";

/**
 * One Product in a grid (ADR 0016): the Catalog Shot on the shared backdrop, then name and
 * price. Tees show their colorways; tapping one swaps the shot without leaving the grid.
 * On a mouse, hovering reveals the Lifestyle Shot (loaded only on first hover).
 */
export function ProductCard({
  item,
  now,
  priority = false,
}: {
  item: ShopItem;
  now: number;
  priority?: boolean;
}) {
  const t = useTranslations("shop");
  const locale = useLocale();
  const { product } = item;
  const tee = isTee(product);
  const name = locale === "es" ? product.nameEs : product.nameEn;

  const [colorwayId, setColorwayId] = useState(item.colorway ?? product.defaultColorway ?? product.colorways?.[0]?.id);
  const colorway = tee ? product.colorways?.find((c) => c.id === colorwayId) : undefined;
  const shot = colorway?.catalogShot ?? item.image;
  const lifestyle = tee ? colorway?.modelImage : product.images?.find((src) => src !== product.image) ?? undefined;
  const [hovered, setHovered] = useState(false);

  const href = `/products/${product.id}${tee && colorway ? `?colorway=${colorway.id}` : ""}`;

  return (
    <article className="group relative flex flex-col">
      <Link
        href={href}
        className="relative block aspect-[4/5] overflow-hidden rounded-[14px] bg-[#ECEAE6] outline-none focus-visible:ring-2 focus-visible:ring-moya-red focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950"
        onPointerEnter={(e) => e.pointerType === "mouse" && setHovered(true)}
      >
        <Image
          src={shot}
          alt={colorway ? `${name} — ${locale === "es" ? colorway.nameEs : colorway.nameEn}` : name}
          fill
          sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw"
          priority={priority}
          fetchPriority={priority ? "high" : undefined}
          className="object-cover transition-transform duration-500 ease-out motion-safe:group-hover:scale-[1.03]"
        />
        {lifestyle && hovered && (
          <Image
            src={lifestyle}
            alt=""
            aria-hidden
            fill
            sizes="(min-width: 1280px) 22vw, (min-width: 768px) 30vw, 50vw"
            className="object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}
        <StatusBadge product={product} now={now} t={t} locale={locale} />
      </Link>

      <div className="mt-3 flex items-start justify-between gap-3 px-0.5">
        <Link
          href={href}
          className="min-w-0 font-display text-[15px] font-semibold leading-snug text-zinc-900 hover:text-moya-red dark:text-zinc-100 line-clamp-2"
        >
          {name}
        </Link>
        <span className="shrink-0 font-display text-[15px] font-bold tabular-nums text-zinc-900 dark:text-white">
          ${product.priceUsd}
        </span>
      </div>

      <p className="mt-1 px-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">
        {tee
          ? colorway
            ? locale === "es"
              ? colorway.nameEs
              : colorway.nameEn
            : t("tee")
          : product.silhouette === "trucker"
            ? t("trucker")
            : t("snapback")}
      </p>

      {tee && product.colorways && product.colorways.length > 1 && (
        <div className="mt-2 flex gap-1.5 px-0.5" role="radiogroup" aria-label={t("colorwaysOf", { name })}>
          {product.colorways.map((c) => {
            const active = c.id === colorwayId;
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={locale === "es" ? c.nameEs : c.nameEn}
                onClick={() => setColorwayId(c.id)}
                className={`relative h-7 w-7 rounded-full p-[3px] transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red ${
                  active ? "ring-[1.5px] ring-zinc-900 dark:ring-white" : "ring-1 ring-transparent hover:ring-zinc-400"
                }`}
              >
                <span
                  className="block h-full w-full rounded-full border"
                  style={{ backgroundColor: c.hex, borderColor: c.borderHex }}
                />
              </button>
            );
          })}
        </div>
      )}
    </article>
  );
}

function StatusBadge({
  product,
  now,
  t,
  locale,
}: {
  product: CapVariant;
  now: number;
  t: ReturnType<typeof useTranslations>;
  locale: string;
}) {
  const upcoming =
    product.isDrop && product.dropStatus !== "live" && ((product.dropDate ?? 0) > now || product.dropStatus === "scheduled");
  let label: string | null = null;
  let tone = "bg-zinc-900 text-white";
  if (upcoming) {
    label = product.dropDate
      ? t("dropsOn", { date: new Date(product.dropDate).toLocaleDateString(locale, { month: "short", day: "numeric" }) })
      : t("comingSoon");
    tone = "bg-moya-red text-white";
  } else if (!isPurchasable(product, now)) {
    label = t("soldOut");
    tone = "bg-white/90 text-zinc-900";
  } else if (product.stock <= 3) {
    label = t("fewLeft", { count: product.stock });
  }
  if (!label) return null;
  return (
    <span className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[12px] font-semibold ${tone}`}>
      {label}
    </span>
  );
}
