/**
 * "Is this storage file still referenced?" — single definition shared by the replace/remove
 * cleanup (`deleteStorageFile`) and the orphan sweep so they cannot drift apart.
 * Referenced means: a `productImages` row points at it, or a variant's legacy `storageId` does.
 * No other table holds `v.id("_storage")` (order labels are stored as URLs).
 */
import type { Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { listCatalogVariants } from "../shared";

/** Legacy single-image `variants.storageId` values (dropped in a later task); catalog-sized scan. */
export async function legacyVariantStorageIds(ctx: QueryCtx): Promise<Set<Id<"_storage">>> {
  const ids = new Set<Id<"_storage">>();
  for (const variant of await listCatalogVariants(ctx)) {
    if (variant.storageId) ids.add(variant.storageId);
  }
  return ids;
}

/** Pass `legacyIds` (from `legacyVariantStorageIds`) to reuse one variant scan across many checks. */
export async function isStorageIdReferenced(
  ctx: QueryCtx,
  storageId: Id<"_storage">,
  legacyIds?: ReadonlySet<Id<"_storage">>,
): Promise<boolean> {
  const row = await ctx.db
    .query("productImages")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .first();
  if (row) return true;
  return (legacyIds ?? (await legacyVariantStorageIds(ctx))).has(storageId);
}
