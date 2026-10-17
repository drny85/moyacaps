/**
 * Shop page model (ADR 0016): category, filters and sort over every Product, with the
 * state kept in the URL query so a filtered view can be shared. Pure functions only.
 */
import type { CapVariant } from "../data/caps";

export const COLOR_FAMILIES = [
  "black",
  "white",
  "grey",
  "cream",
  "brown",
  "red",
  "pink",
  "purple",
  "blue",
  "green",
] as const;
export type ColorFamily = (typeof COLOR_FAMILIES)[number];

/** Swatch shown on the filter chip for each family */
export const COLOR_FAMILY_SWATCH: Record<ColorFamily, string> = {
  black: "#18181b",
  white: "#f7f7f4",
  grey: "#9ca3af",
  cream: "#efe4c4",
  brown: "#5b3a1e",
  red: "#dc2626",
  pink: "#f472b6",
  purple: "#7e22ce",
  blue: "#1d4ed8",
  green: "#166534",
};

export type Category = "all" | "caps" | "tees";
export type SortKey = "featured" | "newest" | "price-asc" | "price-desc";
export type Silhouette = "snapback" | "trucker";
export type PrintSide = "front" | "back";

export interface ShopState {
  category: Category;
  colors: ColorFamily[];
  silhouettes: Silhouette[];
  prints: PrintSide[];
  inStock: boolean;
  sort: SortKey;
}

export const DEFAULT_STATE: ShopState = {
  category: "all",
  colors: [],
  silhouettes: [],
  prints: [],
  inStock: false,
  sort: "featured",
};

/** Colour family of a hex: neutrals by lightness, warm light tones as cream, the rest by hue. */
export function colorFamily(hex: string): ColorFamily {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "grey";
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const chroma = max - min;
  const l = (max + min) / 2;

  let h = 0;
  if (chroma > 0) {
    if (max === r) h = ((g - b) / chroma) % 6;
    else if (max === g) h = (b - r) / chroma + 2;
    else h = (r - g) / chroma + 4;
    h = (h * 60 + 360) % 360;
  }

  // Butter cream, beige: warm and light, even when barely saturated
  if (chroma > 0.06 && h >= 25 && h <= 70 && l > 0.6) return "cream";
  // Neutrals: little colour overall, or little relative to brightness (Tailwind-style blue-greys)
  if (chroma < 0.08 || chroma / max < 0.35) {
    if (l < 0.25) return "black";
    if (l > 0.88) return "white";
    return "grey";
  }
  if (h < 15 || h >= 345) return l > 0.7 ? "pink" : "red";
  if (h < 45) return l < 0.45 ? "brown" : "cream";
  if (h < 70) return "cream";
  if (h < 170) return "green";
  if (h < 260) return "blue";
  if (h < 290) return "purple";
  return l > 0.55 ? "pink" : "purple";
}

export function isTee(p: Pick<CapVariant, "silhouette" | "category">): boolean {
  return p.silhouette === "tee" || p.category === "apparel";
}

/** Families a product comes in: the crown colour for caps, every colorway for tees. */
export function productFamilies(p: CapVariant): ColorFamily[] {
  if (isTee(p) && p.colorways?.length) {
    return [...new Set(p.colorways.map((c) => colorFamily(c.hex)))];
  }
  return [colorFamily(p.primaryHex)];
}

export interface ShopItem {
  product: CapVariant;
  /** Image for the card: the Catalog Shot, matched to the filtered colour for tees */
  image: string;
  /** Tee colorway the card opens on, when a colour filter picked one */
  colorway?: string;
}

function itemFor(p: CapVariant, colors: ColorFamily[]): ShopItem {
  if (isTee(p) && p.colorways?.length) {
    const preferred =
      (colors.length > 0 && p.colorways.find((c) => colors.includes(colorFamily(c.hex)))) ||
      p.colorways.find((c) => c.id === p.defaultColorway) ||
      p.colorways[0];
    return {
      product: p,
      image: preferred.catalogShot ?? p.catalogShot ?? preferred.modelImage ?? p.image,
      colorway: colors.length > 0 ? preferred.id : undefined,
    };
  }
  return { product: p, image: p.catalogShot ?? p.image };
}

/** A drop that is scheduled but not released is browsable, never "in stock". */
export function isPurchasable(p: CapVariant, now: number): boolean {
  const upcoming =
    p.isDrop && p.dropStatus !== "live" && ((p.dropDate ?? 0) > now || p.dropStatus === "scheduled");
  return p.stock > 0 && p.isAvailable !== false && !upcoming;
}

export function applyShop(products: CapVariant[], state: ShopState, now: number): ShopItem[] {
  const filtered = products.filter((p) => {
    const tee = isTee(p);
    if (state.category === "caps" && tee) return false;
    if (state.category === "tees" && !tee) return false;
    if (state.colors.length && !productFamilies(p).some((f) => state.colors.includes(f))) return false;
    // Cap-only and tee-only facets narrow their own category and leave the other untouched
    if (state.silhouettes.length && !tee && !state.silhouettes.includes(p.silhouette as Silhouette)) return false;
    if (state.prints.length && tee && !state.prints.includes(p.printPosition ?? "front")) return false;
    if (state.inStock && !isPurchasable(p, now)) return false;
    return true;
  });

  const indexed = filtered.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => {
    switch (state.sort) {
      case "price-asc":
        return a.p.priceUsd - b.p.priceUsd || a.i - b.i;
      case "price-desc":
        return b.p.priceUsd - a.p.priceUsd || a.i - b.i;
      case "newest":
        return (b.p.createdAt ?? 0) - (a.p.createdAt ?? 0) || a.i - b.i;
      default: {
        // Featured first, then purchasable, then catalog order
        const rank = (p: CapVariant) => (p.isFeatured ? 0 : 1) * 2 + (isPurchasable(p, now) ? 0 : 1);
        return rank(a.p) - rank(b.p) || a.i - b.i;
      }
    }
  });
  return indexed.map(({ p }) => itemFor(p, state.colors));
}

/** Facet counts for the current category, so chips can show how many products they match. */
export function familyCounts(products: CapVariant[], category: Category): Partial<Record<ColorFamily, number>> {
  const counts: Partial<Record<ColorFamily, number>> = {};
  for (const p of products) {
    if (category === "caps" && isTee(p)) continue;
    if (category === "tees" && !isTee(p)) continue;
    for (const f of productFamilies(p)) counts[f] = (counts[f] ?? 0) + 1;
  }
  return counts;
}

// ── URL query <-> state ────────────────────────────────────────────────────────

const list = <T extends string>(raw: string | null, allowed: readonly T[]): T[] =>
  raw ? [...new Set(raw.split(",").filter((v): v is T => (allowed as readonly string[]).includes(v)))] : [];

export function parseShopState(params: URLSearchParams): ShopState {
  const category = params.get("category");
  const sort = params.get("sort");
  return {
    category: category === "caps" || category === "tees" ? category : "all",
    colors: list(params.get("color"), COLOR_FAMILIES),
    silhouettes: list(params.get("silhouette"), ["snapback", "trucker"] as const),
    prints: list(params.get("print"), ["front", "back"] as const),
    inStock: params.get("stock") === "1",
    sort: sort === "newest" || sort === "price-asc" || sort === "price-desc" ? sort : "featured",
  };
}

/** Query string for a state; defaults are omitted so the plain Shop URL stays clean. */
export function serializeShopState(state: ShopState): string {
  const params = new URLSearchParams();
  if (state.category !== "all") params.set("category", state.category);
  if (state.colors.length) params.set("color", state.colors.join(","));
  if (state.silhouettes.length && state.category !== "tees") params.set("silhouette", state.silhouettes.join(","));
  if (state.prints.length && state.category !== "caps") params.set("print", state.prints.join(","));
  if (state.inStock) params.set("stock", "1");
  if (state.sort !== "featured") params.set("sort", state.sort);
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function activeFilterCount(state: ShopState): number {
  return state.colors.length + state.silhouettes.length + state.prints.length + (state.inStock ? 1 : 0);
}
