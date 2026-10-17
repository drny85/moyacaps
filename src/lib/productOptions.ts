/**
 * Product page purchase model (ADR 0015): which colorway and size are selected, how many
 * units that choice has, and which call to action the page shows. Pure functions only.
 */
import type { CapVariant } from "../data/caps";
import { isTee } from "./shop";

export const DEFAULT_TEE_SIZES = ["S", "M", "L", "XL", "2XL"] as const;

export interface SkuStock {
  colorway: string;
  size: string;
  stock: number;
}

export interface Selection {
  colorway?: string;
  size?: string;
}

export function teeSizes(p: CapVariant): string[] {
  return p.sizes?.length ? p.sizes : [...DEFAULT_TEE_SIZES];
}

/**
 * Selection from the URL query: a colorway or size the product doesn't offer is ignored.
 * Tees fall back to their default colorway; size is never preselected, so nobody buys
 * the wrong size by accident.
 */
export function initialSelection(p: CapVariant, query: { colorway?: string | null; size?: string | null }): Selection {
  if (!isTee(p)) return {};
  const colorways = p.colorways ?? [];
  const colorway =
    colorways.find((c) => c.id === query.colorway)?.id ??
    colorways.find((c) => c.id === p.defaultColorway)?.id ??
    colorways[0]?.id;
  const size = query.size && teeSizes(p).includes(query.size) ? query.size : undefined;
  return { colorway, size };
}

export function skuStock(skus: SkuStock[], colorway?: string, size?: string): number {
  if (!colorway || !size) return 0;
  return skus.find((s) => s.colorway === colorway && s.size === size)?.stock ?? 0;
}

/** Units left across every size of one colorway (0 when none is in stock). */
export function colorwayStock(skus: SkuStock[], colorway?: string): number {
  return skus.filter((s) => s.colorway === colorway).reduce((sum, s) => sum + s.stock, 0);
}

/** Cart line id, matching useStore's addToCart. */
export function cartLineId(p: CapVariant, sel: Selection): string {
  return `${p.id}${sel.colorway ? `-${sel.colorway}` : ""}${sel.size ? `-${sel.size}` : ""}`;
}

export type PurchaseState =
  | { kind: "drop-upcoming"; dropDate?: number }
  | { kind: "sold-out" }
  | { kind: "colorway-sold-out" }
  | { kind: "select-size" }
  | { kind: "size-sold-out" }
  | { kind: "max-in-bag"; inBag: number }
  | { kind: "available"; available: number; inBag: number };

export function isDropUpcoming(p: CapVariant, now: number): boolean {
  return Boolean(
    p.isDrop && p.dropStatus !== "live" && (((p.dropDate ?? 0) > now) || p.dropStatus === "scheduled")
  );
}

/**
 * The single call to action for the current choice.
 * For tees, `skus` must be the live SKU stock; for caps it is ignored.
 */
export function purchaseState(
  p: CapVariant,
  sel: Selection,
  skus: SkuStock[],
  inBag: number,
  now: number
): PurchaseState {
  if (isDropUpcoming(p, now)) return { kind: "drop-upcoming", dropDate: p.dropDate };
  if (p.isAvailable === false || p.stock <= 0) return { kind: "sold-out" };

  let stock: number;
  if (isTee(p)) {
    if (colorwayStock(skus, sel.colorway) <= 0) return { kind: "colorway-sold-out" };
    if (!sel.size) return { kind: "select-size" };
    stock = skuStock(skus, sel.colorway, sel.size);
    if (stock <= 0) return { kind: "size-sold-out" };
  } else {
    stock = p.stock;
  }

  const available = Math.max(0, stock - inBag);
  if (available <= 0) return { kind: "max-in-bag", inBag };
  return { kind: "available", available, inBag };
}

/** Images for the gallery, Catalog Shot first (ADR 0016). */
export interface GallerySlide {
  src: string;
  alt: string;
  /** Transparent cut-outs sit on the catalog backdrop; photos fill the frame */
  fit: "contain" | "cover";
  kind: "catalog" | "lifestyle" | "artwork" | "angle";
}

export function gallerySlides(
  p: CapVariant,
  sel: Selection,
  name: string,
  angles: Partial<Record<"front" | "left" | "back" | "right", string>> | null,
  labels: { lifestyle: string; artwork: string; angle: (a: string) => string; colorway?: string }
): GallerySlide[] {
  if (isTee(p)) {
    const cw = p.colorways?.find((c) => c.id === sel.colorway);
    const withColor = labels.colorway ? `${name} — ${labels.colorway}` : name;
    const slides: GallerySlide[] = [];
    const catalog = cw?.catalogShot ?? p.catalogShot;
    if (catalog) slides.push({ src: catalog, alt: withColor, fit: "cover", kind: "catalog" });
    const lifestyle = cw?.modelImage ?? p.image;
    if (lifestyle) slides.push({ src: lifestyle, alt: `${withColor} — ${labels.lifestyle}`, fit: "cover", kind: "lifestyle" });
    if (p.graphicImage) slides.push({ src: p.graphicImage, alt: `${name} — ${labels.artwork}`, fit: "contain", kind: "artwork" });
    return slides;
  }

  const slides: GallerySlide[] = [];
  if (p.catalogShot) slides.push({ src: p.catalogShot, alt: name, fit: "cover", kind: "catalog" });
  if (angles) {
    for (const a of ["left", "back", "right"] as const) {
      if (angles[a]) slides.push({ src: angles[a]!, alt: `${name} — ${labels.angle(a)}`, fit: "contain", kind: "angle" });
    }
  }
  if (slides.length === 0) slides.push({ src: p.image, alt: name, fit: "contain", kind: "catalog" });
  return slides;
}
