/**
 * Administrator analytics dashboard. The numbers come from analyticsModel.ts.
 */
import { query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./auth";
import { analyticsValidator, computeAnalytics } from "./analyticsModel";
import { listCatalogVariants } from "./catalogShared";

/** Most recent orders the dashboard aggregates over. */
const ANALYTICS_ORDER_WINDOW = 2000;

export const getAnalyticsAdmin = query({
  args: {
    // Caller-supplied (minute granularity): queries must not read the wall clock.
    clientTime: v.number(),
  },
  returns: analyticsValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const orders = await ctx.db.query("orders").order("desc").take(ANALYTICS_ORDER_WINDOW);
    const variants = await listCatalogVariants(ctx);
    return computeAnalytics(orders, variants, args.clientTime);
  },
});
