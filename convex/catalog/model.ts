/**
 * Pure catalog rules (ADR 0015): category fallback, storefront filters, drop
 * status and the field merges behind the admin editor. No database access, so
 * every rule is unit-tested in catalogModel.test.ts.
 */
import type { Doc } from "../_generated/dataModel";
import { CATEGORIES, resolveTaxCode, validateProductFields } from "./rules";
import type { Category, FieldError, TeeColorwayInput } from "./rules";
import type { CategoryLaunches } from "../settings/launch";

export const TEE_SIZES = ["S", "M", "L", "XL", "2XL"] as const;

/** Tee stock lives on SKUs; the variant's `stock` is their sum and is never edited directly. */
export const TEE_STOCK_EDIT_ERROR = "Tee stock is tracked per colorway and size. Edit it in the SKU stock grid.";

export type DropStatus = "scheduled" | "live" | "archived";

/** Caps seeded before categories existed count as headwear; tees as apparel. */
export function variantCategory(variant: Pick<Doc<"variants">, "category" | "silhouette">): string {
  return variant.category ?? (variant.silhouette === "tee" ? "apparel" : "headwear");
}

/** The product's category as a Category Status key; rows without one count as Caps. */
export function catalogCategory(variant: Pick<Doc<"variants">, "category" | "silhouette">): Category {
  return variantCategory(variant) === "apparel" ? "apparel" : "headwear";
}

/**
 * Plan 0008 PR 4: checkout taxes a product by its own `taxCode`, else its category, and
 * refuses a product with neither. Rows saved before that (seed caps) get the category the
 * storefront already lists them under, then that category's code. An unknown category
 * (e.g. "hoodies") returns null: an Administrator must fix it. `{}` when nothing is missing.
 */
export function taxCodeBackfill(
  variant: Pick<Doc<"variants">, "category" | "silhouette" | "taxCode">
): { category?: Category; taxCode?: string } | null {
  const patch: { category?: Category; taxCode?: string } = {};
  let category = variant.category;
  if (category === undefined) category = patch.category = catalogCategory(variant);
  if (!variant.taxCode?.trim()) {
    if (!(CATEGORIES as readonly string[]).includes(category)) return null;
    patch.taxCode = resolveTaxCode(category as Category);
  }
  return patch;
}

/**
 * ADR 0022: what a Customer may see or buy. Not archived, turned on by an Administrator
 * (`isAvailable === true`; a missing flag is hidden), and its category Live.
 */
export function isCustomerVisible(
  variant: Pick<Doc<"variants">, "archivedAt" | "isAvailable" | "category" | "silhouette">,
  launches: CategoryLaunches
): boolean {
  return (
    variant.archivedAt === undefined &&
    variant.isAvailable === true &&
    launches[catalogCategory(variant)].status === "live"
  );
}

export type CatalogFilter = {
  silhouette?: string;
  category?: string;
  inStock?: boolean;
  includeUnavailable?: boolean;
  launches: CategoryLaunches;
};

/** Storefront filters for `catalog/queries:getVariants`; "all" means no filter. */
export function filterCatalogVariants<T extends Pick<Doc<"variants">, "isAvailable" | "archivedAt" | "silhouette" | "category" | "stock">>(
  variants: T[],
  filter: CatalogFilter
): T[] {
  // Archived products are never storefront-visible, even to `includeUnavailable` callers.
  let result = variants.filter((v) => v.archivedAt === undefined);
  if (!filter.includeUnavailable) {
    result = result.filter((v) => isCustomerVisible(v, filter.launches));
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
    variant.isAvailable === true &&
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
  // A row without the flag counts as hidden (ADR 0022), so toggling it shows it.
  return requested ?? current !== true;
}

/** Fields `catalog/admin:updateVariant` may change. Absent means "leave as stored". */
export type VariantPatch = {
  nameEn?: string;
  nameEs?: string;
  category?: Category;
  silhouette?: string;
  primaryHex?: string;
  secondaryHex?: string;
  stock?: number;
  priceUsd?: number;
  taxCode?: string;
  isFeatured?: boolean;
  isAvailable?: boolean;
  isDrop?: boolean;
  dropDate?: number;
  dropBadgeTextEn?: string;
  dropBadgeTextEs?: string;
  dropStatus?: DropStatus;
  descriptionEn?: string;
  descriptionEs?: string;
  badgeTextEn?: string;
  badgeTextEs?: string;
  fabricEn?: string;
  fabricEs?: string;
  fitEn?: string;
  fitEs?: string;
  defaultColorway?: string;
  colorways?: Doc<"variants">["colorways"];
  sizes?: string[];
};

/** Payload of `catalog/admin:createVariant`. */
export type NewVariantInput = VariantPatch & {
  variantId: string;
  nameEn: string;
  nameEs: string;
  category: Category;
  silhouette: string;
  primaryHex: string;
  secondaryHex: string;
  priceUsd: number;
  isFeatured: boolean;
};

/** The optimistic-concurrency token of a row; rows from before `updatedAt` existed use their creation time. */
export function versionOf(variant: Pick<Doc<"variants">, "updatedAt" | "_creationTime">): number {
  return variant.updatedAt ?? variant._creationTime;
}

/** Timestamp for a write: the clock, but always later than the row's current version. */
export function nextUpdatedAt(variant: Pick<Doc<"variants">, "updatedAt" | "_creationTime">, clock: number): number {
  return Math.max(clock, versionOf(variant) + 1);
}

/**
 * Patch for an existing variant: only the fields the editor sent, stamped with `now`.
 * Changing the category without a tax code resets the tax code to the new category's default.
 */
export function buildVariantPatch(existing: Doc<"variants">, input: VariantPatch, now: number): VariantPatch & { updatedAt: number } {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) patch[key] = value;
  }
  if (input.category !== undefined && input.taxCode === undefined && input.category !== variantCategory(existing)) {
    patch.taxCode = resolveTaxCode(input.category);
  }
  return { ...(patch as VariantPatch), updatedAt: now };
}

/**
 * Document for a new product. Its images are `productImages` rows attached after creation
 * (ADR 0021), so it starts with a blank legacy `image` and is saved hidden whatever
 * `isAvailable` says: a Product with no image must never reach the storefront grid.
 */
export function buildNewVariant(input: NewVariantInput, now: number) {
  return {
    variantId: input.variantId,
    nameEn: input.nameEn,
    nameEs: input.nameEs,
    silhouette: input.silhouette,
    category: input.category,
    taxCode: resolveTaxCode(input.category, input.taxCode),
    primaryHex: input.primaryHex,
    secondaryHex: input.secondaryHex,
    image: "",
    stock: input.stock ?? 0,
    priceUsd: input.priceUsd,
    isFeatured: input.isFeatured,
    isAvailable: false,
    isDrop: input.isDrop ?? false,
    dropDate: input.dropDate,
    dropBadgeTextEn: input.dropBadgeTextEn,
    dropBadgeTextEs: input.dropBadgeTextEs,
    dropStatus: input.dropStatus,
    descriptionEn: input.descriptionEn,
    descriptionEs: input.descriptionEs,
    badgeTextEn: input.badgeTextEn,
    badgeTextEs: input.badgeTextEs,
    fabricEn: input.fabricEn,
    fabricEs: input.fabricEs,
    fitEn: input.fitEn,
    fitEs: input.fitEs,
    defaultColorway: input.defaultColorway,
    colorways: input.colorways,
    sizes: input.sizes,
    updatedAt: now,
  };
}

/**
 * True when the patch would leave a visible product with no image (a Product with no image must never reach the grid).
 * `hasCatalogImage` is whether the product has a Catalog Shot row in `productImages` (ADR 0021).
 */
export function blankImageWhileVisible(existing: Doc<"variants">, patch: VariantPatch, hasCatalogImage = false): boolean {
  const merged = { ...existing, ...definedOnly(patch) };
  return merged.isAvailable === true && merged.image.trim() === "" && !merged.storageId && !hasCatalogImage;
}

/**
 * Validate a variant as it would look after `patch`. `only` limits the result to the
 * fields a single-field mutation touches, so an unrelated bad stored value cannot block it.
 */
export function validateMerged(existing: Doc<"variants">, patch: VariantPatch, only?: string[]): FieldError[] {
  const merged = { ...existing, ...definedOnly(patch) };
  const errors = validateProductFields({
    nameEn: merged.nameEn,
    nameEs: merged.nameEs,
    category: (patch.category ?? variantCategory(existing)) as Category,
    silhouette: merged.silhouette,
    primaryHex: merged.primaryHex,
    secondaryHex: merged.secondaryHex,
    priceUsd: merged.priceUsd,
    stock: merged.stock,
    taxCode: merged.taxCode,
    descriptionEn: merged.descriptionEn,
    descriptionEs: merged.descriptionEs,
    badgeTextEn: merged.badgeTextEn,
    badgeTextEs: merged.badgeTextEs,
  });
  return only ? errors.filter((e) => only.includes(e.field)) : errors;
}

function definedOnly<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, value]) => value !== undefined)) as Partial<T>;
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
    patch.colorways = existing.colorways.map((c) => ({
      ...c,
      lifestyleImage: renamedLifestyleShot(c.lifestyleImage),
    }));
  }
  return patch;
}

/**
 * Split a tee's current stock across its SKUs: an even share each, remainder to the
 * default colorway first in the most common sizes. The sum is unchanged.
 */
export function distributeStock(
  total: number,
  colorways: string[],
  defaultColorway: string,
  order: string[] = ["L", "M", "XL", "S", "2XL"]
) {
  const cws = [defaultColorway, ...colorways.filter((c) => c !== defaultColorway)];
  const cells = order.flatMap((size) => cws.map((colorway) => ({ colorway, size })));
  const base = Math.floor(total / cells.length);
  let remainder = total - base * cells.length;
  return cells.map((cell) => ({
    ...cell,
    stock: base + (remainder-- > 0 ? 1 : 0),
  }));
}

/**
 * Stored colorways for admin input: a kept colorway (same id) keeps its stored shot paths,
 * a new one starts blank because its images come from `productImages` rows.
 */
export function fillColorwayShots(input: TeeColorwayInput[], stored: Doc<"variants">["colorways"]) {
  return input.map((c) => {
    const kept = stored?.find((s) => s.id === c.id);
    return { ...c, lifestyleImage: kept?.lifestyleImage ?? "", catalogShot: kept?.catalogShot ?? "" };
  });
}
