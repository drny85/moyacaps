/**
 * "Is this storage file still referenced?" — single definition shared by the replace/remove
 * cleanup (`deleteStorageFile`) and the orphan sweep so they cannot drift apart.
 * Referenced means: a `productImages` row points at it, or a variant's legacy `storageId` does.
 * No other table holds `v.id("_storage")` (order labels are stored as URLs).
 */
import type { Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";
import { MAX_CATALOG_VARIANTS } from "../shared";

export type LegacyStorageIds = { ids: Set<Id<"_storage">>; truncated: boolean };

/**
 * Legacy single-image `variants.storageId` values (dropped in a later task); catalog-sized scan.
 * `truncated` means the catalog outgrew the scan cap, so `ids` is incomplete.
 */
export async function legacyVariantStorageIds(ctx: QueryCtx): Promise<LegacyStorageIds> {
  const variants = await ctx.db.query("variants").take(MAX_CATALOG_VARIANTS + 1);
  const ids = new Set<Id<"_storage">>();
  for (const variant of variants.slice(0, MAX_CATALOG_VARIANTS)) {
    if (variant.storageId) ids.add(variant.storageId);
  }
  return { ids, truncated: variants.length > MAX_CATALOG_VARIANTS };
}

/**
 * Fails safe: with a truncated variant scan an unlisted id counts as referenced.
 * Pass `legacy` (from `legacyVariantStorageIds`) to reuse one variant scan across many checks.
 */
export async function isStorageIdReferenced(
  ctx: QueryCtx,
  storageId: Id<"_storage">,
  legacy?: LegacyStorageIds,
): Promise<boolean> {
  const row = await ctx.db
    .query("productImages")
    .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
    .first();
  if (row) return true;
  const { ids, truncated } = legacy ?? (await legacyVariantStorageIds(ctx));
  return truncated || ids.has(storageId);
}
