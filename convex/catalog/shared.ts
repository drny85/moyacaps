/**
 * Database helpers shared by the catalog modules (catalog, catalogAdmin, drops,
 * catalogMigrations, orderDesk, analytics). Stock reads and writes stay in catalog/inventory.ts.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { diffFields, recordCatalogEvent, type CatalogEventType } from "./audit";
import { getVariant } from "./inventory";
import { nextUpdatedAt, versionOf } from "./model";
import { overlayProductImages, primaryImage, type CapAngles, type ResolvedImageRow } from "./images/overlay";

/**
 * Upper bound for whole-catalog reads. The catalog is ~30 products; the bound keeps
 * every variants scan bounded per the Convex guidelines. Raise it (or paginate) well
 * before the catalog approaches it.
 */
export const MAX_CATALOG_VARIANTS = 500;

/**
 * Upper bound for drop-alert subscriber counts. Counts clamp at this value; move to
 * @convex-dev/aggregate if a waitlist ever gets close.
 */
export const MAX_DROP_ALERTS_COUNTED = 1000;

export async function listCatalogVariants(ctx: QueryCtx) {
  return await ctx.db.query("variants").take(MAX_CATALOG_VARIANTS);
}

/** Variant by its public id, or throw (admin mutations). */
export async function requireVariant(ctx: QueryCtx, variantId: string) {
  const variant = await getVariant(ctx, variantId);
  if (!variant) {
    throw new ConvexError(`Variant ${variantId} not found`);
  }
  return variant;
}

/** Upper bound for one product's image rows (4 angles + catalog + lifestyle per colorway); see images/functions.ts. */
export const MAX_PRODUCT_IMAGE_ROWS = 60;

/** The product's `productImages` rows whose file still exists, with their URLs. One bounded read. */
async function resolvedImageRows(ctx: QueryCtx, variantId: string): Promise<ResolvedImageRow[]> {
  const rows = await ctx.db
    .query("productImages")
    .withIndex("by_variantId_and_role_and_order", (q) => q.eq("variantId", variantId))
    .take(MAX_PRODUCT_IMAGE_ROWS);
  const resolved: ResolvedImageRow[] = [];
  for (const row of rows) {
    const url = await ctx.storage.getUrl(row.storageId);
    if (url) resolved.push({ role: row.role, colorway: row.colorway, angle: row.angle, order: row.order, url });
  }
  return resolved;
}

async function legacyStorageUrl(ctx: QueryCtx, variant: Doc<"variants">): Promise<string | undefined> {
  return variant.storageId ? ((await ctx.storage.getUrl(variant.storageId)) ?? undefined) : undefined;
}

/**
 * A variant as the storefront and admin read it: `productImages` rows laid over the legacy
 * image fields (ADR 0021), `image` derived by `primaryImage` (so a product created with only
 * a Catalog Shot row still carries one into cart, checkout and orders), and the hidden-flag
 * defaulted to visible.
 */
export async function resolveProduct<T extends Doc<"variants">>(
  ctx: QueryCtx,
  variant: T
): Promise<T & { isAvailable: boolean; angles?: CapAngles }> {
  // Rows are grouped in memory by the pure overlay.
  const resolved = await resolvedImageRows(ctx, variant.variantId);
  return {
    ...overlayProductImages(variant, resolved),
    image: primaryImage({ ...variant, legacyUrl: await legacyStorageUrl(ctx, variant) }, resolved),
    isAvailable: variant.isAvailable !== false,
  };
}

/** Just the resolved `image` of a raw variant row (order snapshots read rows via `checkStock`). */
export async function resolveProductImage(ctx: QueryCtx, variant: Doc<"variants">): Promise<string> {
  return primaryImage({ ...variant, legacyUrl: await legacyStorageUrl(ctx, variant) }, await resolvedImageRows(ctx, variant.variantId));
}

/** True when the product has a Catalog Shot row (any colorway: tees keep one per colorway). */
export async function hasCatalogImageRow(ctx: QueryCtx, variantId: string): Promise<boolean> {
  const row = await ctx.db
    .query("productImages")
    .withIndex("by_variantId_and_role_and_order", (q) => q.eq("variantId", variantId).eq("role", "catalog"))
    .first();
  return row !== null;
}

export async function countDropAlerts(ctx: QueryCtx, variantId: string): Promise<number> {
  const alerts = await ctx.db
    .query("drop_alerts")
    .withIndex("by_variantId", (q) => q.eq("variantId", variantId))
    .take(MAX_DROP_ALERTS_COUNTED);
  return alerts.length;
}

/** Delete a stored file, ignoring one that is already gone. */
export async function deleteStorageQuietly(ctx: MutationCtx, storageId: Id<"_storage">) {
  try {
    await ctx.storage.delete(storageId);
  } catch (e) {
    // ignore if already deleted
  }
}

/**
 * Patch a variant, stamp `updatedAt` (so a concurrent full edit is detected as stale)
 * and record the audit event for the fields that changed. Writes nothing when no field differs.
 */
export async function patchVariantAudited(
  ctx: MutationCtx,
  variant: Doc<"variants">,
  fields: Partial<Doc<"variants">>,
  type: CatalogEventType,
  actor: string
) {
  const before: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) before[key] = (variant as Record<string, unknown>)[key];
  const changes = diffFields(before, { ...before, ...fields });
  if (changes.length === 0) return versionOf(variant);
  const updatedAt = nextUpdatedAt(variant, Date.now());
  await ctx.db.patch("variants", variant._id, { ...fields, updatedAt });
  await recordCatalogEvent(ctx, { variantId: variant.variantId, type, actor, changes });
  return updatedAt;
}

/** Optimistic concurrency: the caller edited `expectedUpdatedAt`; anything newer is a concurrent edit. */
export function requireVersion(variant: Doc<"variants">, expectedUpdatedAt: number) {
  if (versionOf(variant) !== expectedUpdatedAt) throw new ConvexError({ kind: "stale" });
}

/** Like `requireVariant`, but rejects archived products: they must be restored before they are edited. */
export async function requireActiveVariant(ctx: QueryCtx, variantId: string) {
  const variant = await requireVariant(ctx, variantId);
  if (variant.archivedAt !== undefined) throw new ConvexError({ kind: "archived" });
  return variant;
}
