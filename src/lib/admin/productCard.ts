import { computedDropStatus } from "../../../convex/catalog/model";
import { attentionReasons } from "./productAttention";
import type { AttentionReason } from "./productAttention";
import { categoryOf } from "./productForm";
import type { AdminProduct } from "./productSearch";
import { stockLevel, totalStock } from "./stockLevel";
import type { StockLevel } from "./stockLevel";

/** What one card in the admin product grid shows (D16). */

export type Pill = "hidden" | "featured" | "drop" | "attention";

export type ProductCardVM = {
  id: string;
  name: string;
  slug: string;
  priceLabel: string;
  stock: number;
  stockLevel: StockLevel;
  imageUrl?: string;
  pills: Pill[];
  /** A scheduled or live drop; `date` is already formatted for the locale. */
  drop?: { date: string; subscribers: number; live: boolean };
  attention: AttentionReason[];
  archived: boolean;
  isTee: boolean;
};

const nonBlank = (url: string | undefined) => (url && url.trim() !== "" ? url : undefined);

/** The card image: the Product's Catalog Shot, the default Apparel Colorway's, then its legacy image. */
function cardImage(p: AdminProduct): string | undefined {
  const defaultShot = p.colorways?.find((c) => c.id === p.defaultColorway)?.catalogShot ?? p.colorways?.[0]?.catalogShot;
  return nonBlank(p.catalogShot) ?? nonBlank(defaultShot) ?? nonBlank(p.image);
}

/** "Oct 24, 6 PM": minutes only when not on the hour. */
export function formatDropDate(ms: number, locale: string): string {
  const date = new Date(ms);
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    ...(date.getMinutes() === 0 ? {} : { minute: "2-digit" }),
  }).format(date);
}

export function formatPrice(usd: number): string {
  return Number.isInteger(usd) ? `$${usd}` : `$${usd.toFixed(2)}`;
}

/** A Product's drop as the admin sees it: only a Product marked as a drop has one. */
export function dropState(p: AdminProduct, now: number): "scheduled" | "live" | undefined {
  if (!p.isDrop) return undefined;
  const status = computedDropStatus(p, now);
  return status === "archived" ? undefined : status;
}

export function toProductCard(p: AdminProduct, locale: string, now: number): ProductCardVM {
  const stock = totalStock(p);
  const attention = attentionReasons(p);
  const state = dropState(p, now);
  const drop = state && {
    date: p.dropDate === undefined ? "" : formatDropDate(p.dropDate, locale),
    subscribers: p.subscribersCount,
    live: state === "live",
  };

  const pills: Pill[] = [];
  if (!p.isAvailable) pills.push("hidden");
  if (p.isFeatured) pills.push("featured");
  if (drop) pills.push("drop");
  if (attention.length > 0) pills.push("attention");

  return {
    id: p.variantId,
    name: locale === "es" ? p.nameEs : p.nameEn,
    slug: p.variantId,
    priceLabel: formatPrice(p.priceUsd),
    stock,
    stockLevel: stockLevel(stock),
    imageUrl: cardImage(p),
    pills,
    drop,
    attention,
    archived: p.archivedAt !== undefined,
    isTee: categoryOf(p) === "apparel",
  };
}
