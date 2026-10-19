/**
 * Database helpers shared by the catalog modules (catalog, catalogAdmin, drops,
 * catalogMigrations, orderDesk, analytics). Stock reads and writes stay in catalog/inventory.ts.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { diffFields, recordCatalogEvent, type CatalogEventType } from "./audit";
import { getVariant } from "./inventory";
import { nextUpdatedAt } from "./model";

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

/** Swap an uploaded image's storage id for its signed URL; hidden-flag defaults to visible. */
export async function resolveVariantWithStorageUrl<T extends { storageId?: Id<"_storage">; image: string; isAvailable?: boolean }>(
  ctx: { storage: { getUrl: (storageId: Id<"_storage">) => Promise<string | null> } },
  variant: T
): Promise<T & { isAvailable: boolean }> {
  let image = variant.image;
  if (variant.storageId) {
    const url = await ctx.storage.getUrl(variant.storageId);
    if (url) {
      image = url;
    }
  }
  return {
    ...variant,
    image,
    isAvailable: variant.isAvailable !== false,
  };
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
  if (changes.length === 0) return;
  await ctx.db.patch("variants", variant._id, { ...fields, updatedAt: nextUpdatedAt(variant, Date.now()) });
  await recordCatalogEvent(ctx, { variantId: variant.variantId, type, actor, changes });
}
