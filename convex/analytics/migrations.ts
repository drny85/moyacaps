/**
 * Analytics data jobs. Run on each deployment after the code that needs them ships.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../lib/functions";
import { orderStats } from "./orderStats";

/** Orders one backfill batch adds before it schedules the next. */
const BACKFILL_BATCH = 200;

/**
 * M8: add every existing order to `orderStats`. Idempotent (an order already in it is left
 * alone) and safe alongside live writes, so it can run right after the deploy. Run once per deployment:
 *   npx convex run analytics/migrations:backfillOrderStats
 */
export const backfillOrderStats = internalMutation({
  args: { cursor: v.optional(v.union(v.string(), v.null())) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const page = await ctx.db.query("orders").paginate({ numItems: BACKFILL_BATCH, cursor: args.cursor ?? null });
    for (const order of page.page) await orderStats.insertIfDoesNotExist(ctx, order);
    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.analytics.migrations.backfillOrderStats, { cursor: page.continueCursor });
    }
    return null;
  },
});
