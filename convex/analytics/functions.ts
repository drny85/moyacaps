/**
 * Administrator analytics dashboard. The numbers come from model.ts.
 */
import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/auth";
import { analyticsValidator, computeAnalytics } from "./model";
import { listCatalogVariants } from "../catalog/shared";
import { listSkus } from "../catalog/inventory";

/** Most recent orders the dashboard aggregates over. */
const ANALYTICS_ORDER_WINDOW = 2000;

export const getAnalyticsAdmin = query({
  args: {
    // Caller-supplied (minute granularity): queries must not read the wall clock.
    clientTime: v.number(),
    // The browser's Date#getTimezoneOffset, so days bucket by the Administrator's local day.
    tzOffsetMinutes: v.number(),
  },
  returns: analyticsValidator,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const orders = await ctx.db.query("orders").order("desc").take(ANALYTICS_ORDER_WINDOW);
    const variants = await listCatalogVariants(ctx);
    const tees = variants.filter((variant) => variant.category === "apparel");
    const skus = (await Promise.all(tees.map((variant) => listSkus(ctx, variant.variantId)))).flat();
    return computeAnalytics(orders, variants, skus, args.clientTime, args.tzOffsetMinutes);
  },
});
