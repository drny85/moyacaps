/**
 * Pure catalog rules (ADR 0015): category fallback, storefront filters, drop
 * status and the field merges behind the admin editor. No database access, so
 * every rule is unit-tested in catalogModel.test.ts.
 */
import type { Doc } from "../_generated/dataModel";

export const TEE_SIZES = ["S", "M", "L", "XL", "2XL"] as const;

/** Tee stock lives on SKUs; the variant's `stock` is their sum and is never edited directly. */
export const TEE_STOCK_EDIT_ERROR = "Tee stock is tracked per colorway and size. Edit it in the SKU stock grid.";

export type DropStatus = "scheduled" | "live" | "archived";

/** Caps seeded before categories existed count as headwear; tees as apparel. */
export function variantCategory(variant: Pick<Doc<"variants">, "category" | "silhouette">): string {
  return variant.category ?? (variant.silhouette === "tee" ? "apparel" : "headwear");
}

export type CatalogFilter = {
  silhouette?: string;
  category?: string;
  inStock?: boolean;
  includeUnavailable?: boolean;
};

/** Storefront filters for `catalog/queries:getVariants`; "all" means no filter. */
export function filterCatalogVariants<T extends Pick<Doc<"variants">, "isAvailable" | "silhouette" | "category" | "stock">>(
  variants: T[],
  filter: CatalogFilter
): T[] {
  let result = variants;
  if (!filter.includeUnavailable) {
    result = result.filter((v) => v.isAvailable !== false);
  }
  if (filter.silhouette && filter.silhouette !== "all") {
    result = result.filter((v) => v.silhouette === filter.silhouette);
  }
  if (filter.category && filter.category !== "all") {
    result = result.filter((v) => variantCategory(v) === filter.category);
  }
  if (filter.inStock) {
    result = result.filter((v) => v.stock > 0);
  }
  return result;
}

type DropFields = Pick<Doc<"variants">, "isDrop" | "dropDate" | "dropStatus" | "isAvailable">;

/** A visible drop whose release date is still ahead (storefront Drop Radar). */
export function isUpcomingDrop(variant: DropFields, now: number): boolean {
  return (
    variant.isDrop === true &&
    typeof variant.dropDate === "number" &&
    variant.isAvailable !== false &&
    now < variant.dropDate &&
    variant.dropStatus !== "live"
  );
}

/** Any variant that has ever carried drop attributes (admin drop desk). */
export function hasDropHistory(variant: DropFields): boolean {
  return variant.isDrop === true || variant.dropDate !== undefined || variant.dropStatus !== undefined;
}

/** Drop status shown on the admin drop desk. */
export function computedDropStatus(variant: DropFields, now: number): DropStatus {
  const isLive =
    variant.dropStatus === "live" || (typeof variant.dropDate === "number" && now >= variant.dropDate && variant.isDrop);
  const isScheduled =
    variant.isDrop === true && typeof variant.dropDate === "number" && now < variant.dropDate && variant.dropStatus !== "live";
  return isLive ? "live" : isScheduled ? "scheduled" : "archived";
}

/** Purchase gate: a drop cannot be bought until it is released. */
export function isPurchaseBlockedByDrop(variant: DropFields, now: number): boolean {
  return Boolean(
    variant.isDrop &&
      variant.dropStatus !== "live" &&
      ((typeof variant.dropDate === "number" && now < variant.dropDate) || variant.dropStatus === "scheduled")
  );
}

/** Toggle visibility, or set it outright when the Administrator passes a value. */
export function nextAvailability(current: boolean | undefined, requested: boolean | undefined): boolean {
  return requested !== undefined ? requested : !(current !== false);
}

/** Admin editor payload (`catalog/admin:saveVariant`). */
export type VariantInput = {
  variantId: string;
  nameEn: string;
  nameEs: string;
  silhouette: string;
  primaryHex: string;
  secondaryHex: string;
  image: string;
  storageId?: Doc<"variants">["storageId"];
  images?: string[];
  stock: number;
  priceUsd: number;
  isFeatured: boolean;
  isAvailable?: boolean;
  isDrop?: boolean;
  dropDate?: number;
  dropBadgeTextEn?: string;
  dropBadgeTextEs?: string;
  dropStatus?: DropStatus;
  category?: string;
  taxCode?: string;
};

/**
 * Patch for an existing variant: optional editor fields keep their stored value when
 * omitted, and tee stock stays the SKU aggregate (never overwritten from the editor).
 */
export function mergeVariantUpdate(existing: Doc<"variants">, input: VariantInput, image: string, teeHasSkus: boolean) {
  const keep = <K extends keyof VariantInput & keyof Doc<"variants">>(key: K) =>
    input[key] !== undefined ? input[key] : existing[key];
  return {
    nameEn: input.nameEn,
    nameEs: input.nameEs,
    silhouette: input.silhouette,
    category: keep("category"),
    taxCode: keep("taxCode"),
    primaryHex: input.primaryHex,
    secondaryHex: input.secondaryHex,
    image,
    storageId: keep("storageId"),
    images: keep("images"),
    stock: teeHasSkus ? existing.stock : input.stock,
    priceUsd: input.priceUsd,
    isFeatured: input.isFeatured,
    isAvailable: input.isAvailable !== undefined ? input.isAvailable : existing.isAvailable !== false,
    isDrop: keep("isDrop"),
    dropDate: keep("dropDate"),
    dropBadgeTextEn: keep("dropBadgeTextEn"),
    dropBadgeTextEs: keep("dropBadgeTextEs"),
    dropStatus: keep("dropStatus"),
  };
}

/** Document for a variant created from the admin editor. */
export function newVariantDoc(input: VariantInput, image: string) {
  return {
    variantId: input.variantId,
    nameEn: input.nameEn,
    nameEs: input.nameEs,
    silhouette: input.silhouette,
    category: input.category,
    taxCode: input.taxCode,
    primaryHex: input.primaryHex,
    secondaryHex: input.secondaryHex,
    image,
    storageId: input.storageId,
    images: input.images,
    stock: input.stock,
    priceUsd: input.priceUsd,
    isFeatured: input.isFeatured,
    isAvailable: input.isAvailable !== undefined ? input.isAvailable : true,
    isDrop: input.isDrop ?? false,
    dropDate: input.dropDate,
    dropBadgeTextEn: input.dropBadgeTextEn,
    dropBadgeTextEs: input.dropBadgeTextEs,
    dropStatus: input.dropStatus,
  };
}

/** Old Lifestyle Shot paths (still referenced by historical order snapshots) → canonical names */
export const LIFESTYLE_RENAMES: Record<string, string> = {
  "/shirts/gothic-angel-white.jpg": "/shirts/angel-clover-white.jpg",
  "/shirts/eagle-clover-black.png": "/shirts/eagle-clover-black.jpg",
  "/shirts/eagle-clover-grey.png": "/shirts/eagle-clover-grey.jpg",
};
export const renamedLifestyleShot = (path: string) => LIFESTYLE_RENAMES[path] ?? path;

/** Tee fields with no admin editor: the catalog data owns them, so the migration keeps them in sync. */
export const DATA_OWNED_TEE_FIELDS = new Set(["printPosition", "graphicImage"]);

type TeeRow = Pick<Doc<"variants">, "image" | "images" | "colorways"> & Record<string, unknown>;

/**
 * What the catalog migration changes on an existing tee row. Fields are only filled when
 * missing, so re-running never undoes an Administrator's edits, except data-owned fields,
 * which follow the catalog data; Lifestyle Shot paths still on old file names are renamed.
 */
export function teeFieldsPatch(existing: TeeRow, fields: Record<string, unknown>): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    const current = existing[key];
    if (current === undefined || (DATA_OWNED_TEE_FIELDS.has(key) && current !== value)) patch[key] = value;
  }
  if (LIFESTYLE_RENAMES[existing.image]) patch.image = renamedLifestyleShot(existing.image);
  if (existing.images?.some((path) => LIFESTYLE_RENAMES[path])) patch.images = existing.images.map(renamedLifestyleShot);
  if (existing.colorways?.some((c) => LIFESTYLE_RENAMES[c.lifestyleImage])) {
    patch.colorways = existing.colorways.map((c) => ({ ...c, lifestyleImage: renamedLifestyleShot(c.lifestyleImage) }));
  }
  return patch;
}

/**
 * Split a tee's current stock across its SKUs: an even share each, remainder to the
 * default colorway first in the most common sizes. The sum is unchanged.
 */
export function distributeStock(total: number, colorways: string[], defaultColorway: string) {
  const order = ["L", "M", "XL", "S", "2XL"];
  const cws = [defaultColorway, ...colorways.filter((c) => c !== defaultColorway)];
  const cells = order.flatMap((size) => cws.map((colorway) => ({ colorway, size })));
  const base = Math.floor(total / cells.length);
  let remainder = total - base * cells.length;
  return cells.map((cell) => ({ ...cell, stock: base + (remainder-- > 0 ? 1 : 0) }));
}
