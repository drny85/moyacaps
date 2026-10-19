/** Daily sweep of storage files nothing points at (abandoned uploads, missed replace/remove deletes). */
import { v } from "convex/values";
import { internal } from "../../_generated/api";
import { internalMutation } from "../../_generated/server";
import { deleteStorageQuietly } from "../shared";
import { isStorageIdReferenced, legacyVariantStorageIds } from "./references";

/** A file younger than this may be an upload still waiting to be attached. */
export const ORPHAN_AGE_MS = 24 * 60 * 60 * 1000;

export const SWEEP_BATCH_SIZE = 200;

export const sweepOrphans = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())), now: v.optional(v.number()) },
  returns: v.object({ scanned: v.number(), deleted: v.number() }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const page = await ctx.db.system
      .query("_storage")
      .paginate({ numItems: SWEEP_BATCH_SIZE, cursor: args.cursor ?? null });

    const legacyIds = await legacyVariantStorageIds(ctx);
    let deleted = 0;
    for (const file of page.page) {
      if (now - file._creationTime < ORPHAN_AGE_MS) continue;
      if (await isStorageIdReferenced(ctx, file._id, legacyIds)) continue;
      await deleteStorageQuietly(ctx, file._id);
      deleted += 1;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.catalog.images.cleanup.sweepOrphans, {
        cursor: page.continueCursor,
        now,
      });
    }
    return { scanned: page.page.length, deleted };
  },
});
