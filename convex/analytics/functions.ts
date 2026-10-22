/**
 * Administrator analytics dashboard. The numbers come from model.ts.
 */
import { query } from "../_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "../lib/auth";
import { analyticsValidator, chartWindowStart, computeAnalytics, orderTotals } from "./model";
import { readStatusCells } from "./orderStats";
import { listCatalogVariants } from "../catalog/shared";
import { listSkus } from "../catalog/inventory";

/** Most orders the 30-day chart and best sellers read; totals are exact at any volume. */
const CHART_ORDER_LIMIT = 2000;

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
    const totals = orderTotals(await readStatusCells(ctx));
    const recentOrders = await ctx.db
      .query("orders")
      .withIndex("by_createdAt", (q) => q.gte("createdAt", chartWindowStart(args.clientTime)))
      .order("desc")
      .take(CHART_ORDER_LIMIT);
    const variants = await listCatalogVariants(ctx);
    const tees = variants.filter((variant) => variant.category === "apparel");
    const skus = (await Promise.all(tees.map((variant) => listSkus(ctx, variant.variantId)))).flat();
    return computeAnalytics(totals, recentOrders, variants, skus, args.clientTime, args.tzOffsetMinutes);
  },
});
