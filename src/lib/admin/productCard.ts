import { computedDropStatus } from "../../../convex/catalog/model";
import { attentionReasons } from "./productAttention";
import type { AttentionReason } from "./productAttention";
import { categoryOf } from "./productForm";
import type { AdminProduct } from "./productSearch";
import { stockLevel, totalStock } from "./stockLevel";
import type { StockLevel } from "./stockLevel";

/** What one card in the admin product grid shows (D16). */

export type Pill = "hidden" | "featured" | "drop" | "attention";

/** One color the Product comes in: an Apparel Colorway, or a Cap's crown (fill) and visor (ring). */
export type Swatch = { id: string; name: string; hex: string; borderHex?: string };

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
  swatches: Swatch[];
};

const nonBlank = (url: string | undefined) => (url && url.trim() !== "" ? url : undefined);

/** The card image: the Product's Catalog Shot, the default Apparel Colorway's, then its legacy image. */
function cardImage(p: AdminProduct): string | undefined {
  const defaultShot = p.colorways?.find((c) => c.id === p.defaultColorway)?.catalogShot ?? p.colorways?.[0]?.catalogShot;
  return nonBlank(p.catalogShot) ?? nonBlank(defaultShot) ?? nonBlank(p.image);
}

/** The colors a Product comes in: a tee's Apparel Colorways in order, or one two-tone swatch for a cap. */
function swatchesOf(p: AdminProduct, name: string, locale: string, isTee: boolean): Swatch[] {
  if (isTee) {
    return (p.colorways ?? [])
      .filter((c): c is typeof c & { hex: string } => Boolean(c.hex))
      .map((c) => ({ id: c.id, name: (locale === "es" ? c.nameEs : c.nameEn) || c.id, hex: c.hex, borderHex: c.borderHex }));
  }
  return p.primaryHex ? [{ id: p.variantId, name, hex: p.primaryHex, borderHex: p.secondaryHex }] : [];
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

  const name = locale === "es" ? p.nameEs : p.nameEn;
  const isTee = categoryOf(p) === "apparel";
  return {
    id: p.variantId,
    name,
    slug: p.variantId,
    priceLabel: formatPrice(p.priceUsd),
    stock,
    stockLevel: stockLevel(stock),
    imageUrl: cardImage(p),
    pills,
    drop,
    attention,
    archived: p.archivedAt !== undefined,
    isTee,
    swatches: swatchesOf(p, name, locale, isTee),
  };
}
