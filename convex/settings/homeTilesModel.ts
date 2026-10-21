import type { Category, FieldError } from "../catalog/rules";

// Pure homepage tile rules shared by Convex functions and the Next.js client.

/** The Product each homepage category tile shows, by variantId. */
export type HomeTiles = Record<Category, string>;

/** What the tiles showed before an Administrator could choose; used until one is picked. */
export const DEFAULT_HOME_TILES: HomeTiles = { headwear: "negro-rojo", apparel: "butterfly-grunge-tee" };

type PickCandidate = { category?: string; silhouette: string; archivedAt?: number };

/** A tile shows a listed (not archived) Product of its own category. */
export function validateHomeTilePick(category: Category, variant: PickCandidate | null): FieldError[] {
  if (!variant) return [{ field: "variantId", code: "required" }];
  if (variant.archivedAt !== undefined) return [{ field: "variantId", code: "range" }];
  const own = variant.category === "apparel" || variant.category === "headwear" ? variant.category : variant.silhouette === "tee" ? "apparel" : "headwear";
  return own === category ? [] : [{ field: "variantId", code: "mismatch" }];
}
