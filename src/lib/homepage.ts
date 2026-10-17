/**
 * What the homepage shows, derived from the live catalog (ADR 0016). Pure functions only:
 * sections render whatever these return, so new products appear without code changes.
 */
import type { CapVariant } from "../data/caps";
import { isPurchasable, isTee, type ShopItem } from "./shop";

const toItem = (p: CapVariant): ShopItem => {
  if (isTee(p) && p.colorways?.length) {
    const cw = p.colorways.find((c) => c.id === p.defaultColorway) ?? p.colorways[0];
    return { product: p, image: cw.catalogShot ?? p.catalogShot ?? cw.modelImage ?? p.image };
  }
  return { product: p, image: p.catalogShot ?? p.image };
};

/**
 * Featured row: purchasable products only, featured ones first, alternating caps and tees
 * so both categories are always visible above the fold of the section.
 */
export function pickFeatured(products: CapVariant[], count: number, now: number): ShopItem[] {
  const pool = products.filter((p) => isPurchasable(p, now));
  const rank = (list: CapVariant[]) =>
    list
      .map((p, i) => ({ p, i }))
      .sort((a, b) => Number(Boolean(b.p.isFeatured)) - Number(Boolean(a.p.isFeatured)) || a.i - b.i)
      .map(({ p }) => p);
  const caps = rank(pool.filter((p) => !isTee(p)));
  const tees = rank(pool.filter(isTee));

  const out: CapVariant[] = [];
  for (let i = 0; out.length < count && (i < caps.length || i < tees.length); i++) {
    if (i < caps.length) out.push(caps[i]);
    if (out.length < count && i < tees.length) out.push(tees[i]);
  }
  return out.map(toItem);
}

export interface CategoryEntry {
  category: "caps" | "tees";
  count: number;
  /** Lowest price in the category, for "from $X" */
  fromPrice: number;
  image: string;
}

/** The two entry tiles under the hero; a category with no products is left out. */
export function categoryEntries(products: CapVariant[], preferred: { caps?: string; tees?: string } = {}): CategoryEntry[] {
  const entries: CategoryEntry[] = [];
  for (const category of ["caps", "tees"] as const) {
    const list = products.filter((p) => (category === "tees" ? isTee(p) : !isTee(p)));
    if (list.length === 0) continue;
    const lead = list.find((p) => p.id === preferred[category]) ?? list.find((p) => p.isFeatured) ?? list[0];
    entries.push({
      category,
      count: list.length,
      fromPrice: Math.min(...list.map((p) => p.priceUsd)),
      image: toItem(lead).image,
    });
  }
  return entries;
}

export interface LookbookShot {
  productId: string;
  colorway: string;
  src: string;
  name: { en: string; es: string };
  colorwayName: { en: string; es: string };
}

/**
 * Street-photo strip: one Lifestyle Shot per tee, on its default colorway, featured tees
 * first. Each shot links to the product opened on that colorway.
 */
export function lookbookShots(products: CapVariant[], count: number): LookbookShot[] {
  return products
    .filter((p) => isTee(p) && p.colorways?.length && p.isAvailable !== false)
    .map((p, i) => ({ p, i }))
    .sort((a, b) => Number(Boolean(b.p.isFeatured)) - Number(Boolean(a.p.isFeatured)) || a.i - b.i)
    .slice(0, count)
    .map(({ p }) => {
      const cw = p.colorways!.find((c) => c.id === p.defaultColorway) ?? p.colorways![0];
      return {
        productId: p.id,
        colorway: cw.id,
        src: cw.modelImage,
        name: { en: p.nameEn, es: p.nameEs },
        colorwayName: { en: cw.nameEn, es: cw.nameEs },
      };
    });
}
