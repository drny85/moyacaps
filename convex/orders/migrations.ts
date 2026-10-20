/**
 * One-off order migrations. Run from the CLI after the deploy that ships them, e.g.
 * `npx convex run orders/migrations:unsetLegacyOrderStatus --prod`.
 */
import { internalMutation, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

const BATCH = 100;

/**
 * ADR 0024 narrow step: clear the legacy single `status` from every Order so the field can
 * leave the schema (Convex refuses a schema that existing documents violate). Every Order
 * already carries Payment Status and Fulfillment Status, which the schema now requires.
 * Walks the whole table in batches and re-schedules itself until done; an Order without the
 * field is skipped, so it is safe to run twice.
 */
export const unsetLegacyOrderStatus = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({ scanned: v.number(), updated: v.number(), done: v.boolean() }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? BATCH;
    const page = await ctx.db.query("orders").paginate({ numItems: batchSize, cursor: args.cursor ?? null });

    let updated = 0;
    for (const order of page.page) {
      if (order.status === undefined) continue;
      await ctx.db.patch("orders", order._id, { status: undefined });
      updated += 1;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.orders.migrations.unsetLegacyOrderStatus, {
        cursor: page.continueCursor,
        batchSize,
      });
    }
    return { scanned: page.page.length, updated, done: page.isDone };
  },
});

/** Orders still holding the legacy `status` (bounded scan): 0 once the unset has finished. */
export const countOrdersWithLegacyStatus = internalQuery({
  args: {},
  returns: v.object({ remaining: v.number(), scanned: v.number() }),
  handler: async (ctx) => {
    const SCAN = 5000;
    const orders = await ctx.db.query("orders").take(SCAN);
    const remaining = orders.filter((o) => o.status !== undefined).length;
    return { remaining, scanned: orders.length };
  },
});
