/**
 * Which caps the Try-On offers (ADR 0019), pure and tested: visible caps from the live
 * catalog that have a front-angle overlay. Tees are never offered.
 */
import type { CapVariant } from "../../data/caps";
import { isPurchasable, isTee } from "../shop";

export interface TryOnCap {
  product: CapVariant;
  /** Transparent, scale-normalised front angle drawn on the photo */
  overlay: string;
  /** Catalog Shot for the picker */
  thumb: string;
  purchasable: boolean;
}

/** `overlayFor` returns a cap's front-angle image, or null when it has none */
export function tryOnCaps(
  products: CapVariant[],
  now: number,
  overlayFor: (cap: CapVariant) => string | null
): TryOnCap[] {
  const out: TryOnCap[] = [];
  for (const product of products) {
    if (isTee(product) || product.isAvailable === false) continue;
    const overlay = overlayFor(product);
    if (!overlay) continue;
    out.push({ product, overlay, thumb: product.catalogShot ?? product.image, purchasable: isPurchasable(product, now) });
  }
  // Caps that can be bought first; catalog order otherwise
  return out.sort((a, b) => Number(b.purchasable) - Number(a.purchasable));
}

/** The cap to start on: the requested one if offered, else the first that can be bought */
export function initialTryOnCap(caps: TryOnCap[], requestedId?: string | null): TryOnCap | null {
  return caps.find((c) => c.product.id === requestedId) ?? caps.find((c) => c.purchasable) ?? caps[0] ?? null;
}
