/**
 * Administrator analytics dashboard. The numbers come from model.ts.
 */
import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/auth";
import { analyticsValidator, computeAnalytics } from "./model";
import { listCatalogVariants } from "../catalog/shared";

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
