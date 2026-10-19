import type { ResolvedVariant } from "./productForm";

/**
 * The admin list's row shape, narrowed to what the list helpers read so tests can
 * build rows by hand. Every `getAllProductsAdmin` row satisfies it.
 */
export type AdminProduct = Pick<
  ResolvedVariant,
  "variantId" | "nameEn" | "nameEs" | "silhouette" | "image" | "stock" | "priceUsd" | "isAvailable" | "isFeatured" | "subscribersCount" | "skus"
> &
  Partial<Pick<ResolvedVariant, "category" | "catalogShot" | "angles" | "defaultColorway" | "archivedAt" | "isDrop" | "dropDate" | "dropStatus" | "primaryHex" | "secondaryHex">> & {
    colorways?: { id: string; nameEn: string; nameEs: string; catalogShot: string; hex?: string; borderHex?: string }[];
  };

/** Lower-case and strip accents, so "GÓTICO" and "gotico" compare equal. */
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Everything the search box matches: names in both languages, the slug, and Apparel Colorway names. */
export function searchableText(p: AdminProduct): string {
  const colorways = (p.colorways ?? []).flatMap((c) => [c.id, c.nameEn, c.nameEs]);
  return foldText([p.nameEn, p.nameEs, p.variantId, ...colorways].join(" "));
}

/** True when every whitespace-separated token of `q` appears in the Product's searchable text. */
export function matchesQuery(p: AdminProduct, q: string): boolean {
  const tokens = foldText(q).split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const text = searchableText(p);
  return tokens.every((token) => text.includes(token));
}
