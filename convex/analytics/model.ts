/**
 * Pure admin analytics: revenue, pipeline, top sellers, stock health and the
 * 30-day sales chart. Covered by model.test.ts.
 */
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import {
  countsAsSale,
  FULFILLMENT_STATUSES,
  hasSettled,
  PAYMENT_STATUSES,
  statusAxes,
  type FulfillmentStatus,
  type PaymentStatus,
} from "../orders/status";

import { isLowStock } from "../catalog/stock";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
/** Days on the Home chart; the 7-day and today windows are slices of it. */
const CHART_DAYS = 30;

/** "YYYY-MM-DD" of `ts` in the caller's local time (`tzOffsetMinutes` as `Date#getTimezoneOffset`). */
function localDayKey(ts: number, tzOffsetMinutes: number): string {
  return new Date(ts - tzOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

type DayBucket = { date: string; revenue: number; orders: number };

function sumWindow(days: DayBucket[]): { revenue: number; orders: number } {
  return days.reduce((acc, d) => ({ revenue: acc.revenue + d.revenue, orders: acc.orders + d.orders }), { revenue: 0, orders: 0 });
}

export type LowStockRow = {
  variantId: string;
  nameEn: string;
  nameEs: string;
  colorway?: string;
  size?: string;
  stock: number;
  image: string;
};

/** Low stock rows: one per SKU for a Heavyweight Tee, one per Cap. Lowest first. */
function lowStockRows(variants: Doc<"variants">[], skus: Doc<"skus">[]): LowStockRow[] {
  const rows: LowStockRow[] = [];
  for (const v of variants) {
    const base = { variantId: v.variantId, nameEn: v.nameEn, nameEs: v.nameEs };
    if (v.category === "apparel") {
      // A tee's Catalog Shot is per Apparel Colorway; fall back to its Lifestyle Shot, then the variant image.
      for (const s of skus) {
        if (s.variantId !== v.variantId || !isLowStock(s.stock)) continue;
        const cw = v.colorways?.find((c) => c.id === s.colorway);
        const image = cw?.catalogShot || cw?.lifestyleImage || v.image;
        rows.push({ ...base, colorway: s.colorway, size: s.size, stock: s.stock, image });
      }
    } else if (isLowStock(v.stock)) {
      rows.push({ ...base, stock: v.stock, image: v.catalogShot || v.image });
    }
  }
  return rows.sort((a, b) => a.stock - b.stock);
}

export function computeAnalytics(
  orders: Doc<"orders">[],
  allVariants: Doc<"variants">[],
  skus: Doc<"skus">[],
  now: number,
  tzOffsetMinutes: number
) {
  // Archived products are out of the catalog: they do not count toward stock or low-stock views.
  const variants = allVariants.filter((v) => v.archivedAt === undefined);
  let totalRevenue = 0;
  let completedOrdersCount = 0;

  // Orders on each axis (ADR 0024). Cancelled Orders are counted once, apart; fulfillment
  // counts only settled Orders, so abandoned checkouts do not swell "unfulfilled".
  const paymentStatusCounts = Object.fromEntries(PAYMENT_STATUSES.map((s) => [s, 0])) as Record<PaymentStatus, number>;
  const fulfillmentStatusCounts = Object.fromEntries(FULFILLMENT_STATUSES.map((s) => [s, 0])) as Record<
    FulfillmentStatus,
    number
  >;
  let cancelledCount = 0;

  const variantSalesMap: Record<string, { name: string; units: number; revenue: number; image: string }> = {};

  // Last 30 local days ending at `now`.
  const dailyMap: Record<string, DayBucket> = {};
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const key = localDayKey(now - i * ONE_DAY_MS, tzOffsetMinutes);
    dailyMap[key] = { date: key, revenue: 0, orders: 0 };
  }

  for (const o of orders) {
    const axes = statusAxes(o);
    if (axes.cancelledAt !== undefined) cancelledCount += 1;
    else {
      paymentStatusCounts[axes.paymentStatus] += 1;
      if (hasSettled(o)) fulfillmentStatusCounts[axes.fulfillmentStatus] += 1;
    }

    if (countsAsSale(o)) {
      totalRevenue += o.total;
      completedOrdersCount += 1;

      // Best sellers and the chart share the 30-day window; totals above are all-time.
      const orderDate = localDayKey(o.createdAt, tzOffsetMinutes);
      if (!dailyMap[orderDate]) continue;
      dailyMap[orderDate].revenue += o.total;
      dailyMap[orderDate].orders += 1;

      for (const item of o.items) {
        if (!variantSalesMap[item.variantId]) {
          variantSalesMap[item.variantId] = { name: item.name, units: 0, revenue: 0, image: item.image };
        }
        variantSalesMap[item.variantId].units += item.quantity;
        variantSalesMap[item.variantId].revenue += item.price * item.quantity;
      }
    }
  }

  const aov = completedOrdersCount > 0 ? Math.round(totalRevenue / completedOrdersCount) : 0;

  const topVariants = Object.entries(variantSalesMap)
    .map(([variantId, stats]) => ({ variantId, ...stats }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  const dailySales = Object.values(dailyMap);

  return {
    totalRevenue,
    completedOrdersCount,
    totalOrdersCount: orders.length,
    aov,
    paymentStatusCounts,
    fulfillmentStatusCounts,
    cancelledCount,
    windows: {
      today: sumWindow(dailySales.slice(-1)),
      d7: sumWindow(dailySales.slice(-7)),
      d30: sumWindow(dailySales),
    },
    topVariants,
    lowStock: lowStockRows(variants, skus),
    inventorySummary: {
      totalVariantsCount: variants.length,
      totalInventoryUnits: variants.reduce((sum, v) => sum + v.stock, 0),
      outOfStockCount: variants.filter((v) => v.stock === 0).length,
    },
    dailySales,
  };
}

/** Order-desk attention counters over the bounded packing queue (orders/status `awaitsFulfillment`). */
export function computeAttentionStats(
  paidOrders: Array<{ createdAt?: number }>,
  latestOrderTimestamp: number,
  allVariants: Doc<"variants">[],
  now: number
) {
  const variants = allVariants.filter((v) => v.archivedAt === undefined);
  const twentyFourHoursAgo = now - ONE_DAY_MS;
  const unfulfilledPaid = paidOrders.length;
  const overduePaid = paidOrders.filter((o) => (o.createdAt || 0) < twentyFourHoursAgo).length;

  const lowStockVariants = variants
    .filter((v) => isLowStock(v.stock))
    .map((v) => ({
      variantId: v.variantId,
      nameEn: v.nameEn,
      nameEs: v.nameEs,
      stock: v.stock,
    }));

  return {
    totalActionRequired: unfulfilledPaid,
    unfulfilledPaid,
    overduePaid,
    lowStockCount: lowStockVariants.length,
    lowStockVariants,
    latestOrderTimestamp,
  };
}

// ── Return validators (keep in step with the functions above) ───────────────

const revenueCount = v.object({ revenue: v.number(), orders: v.number() });

export const analyticsValidator = v.object({
  totalRevenue: v.number(),
  completedOrdersCount: v.number(),
  totalOrdersCount: v.number(),
  aov: v.number(),
  paymentStatusCounts: v.record(v.string(), v.number()),
  fulfillmentStatusCounts: v.record(v.string(), v.number()),
  cancelledCount: v.number(),
  windows: v.object({ today: revenueCount, d7: revenueCount, d30: revenueCount }),
  topVariants: v.array(
    v.object({ variantId: v.string(), name: v.string(), units: v.number(), revenue: v.number(), image: v.string() })
  ),
  lowStock: v.array(
    v.object({
      variantId: v.string(),
      nameEn: v.string(),
      nameEs: v.string(),
      colorway: v.optional(v.string()),
      size: v.optional(v.string()),
      stock: v.number(),
      image: v.string(),
    })
  ),
  inventorySummary: v.object({
    totalVariantsCount: v.number(),
    totalInventoryUnits: v.number(),
    outOfStockCount: v.number(),
  }),
  dailySales: v.array(v.object({ date: v.string(), revenue: v.number(), orders: v.number() })),
});

export const attentionStatsValidator = v.object({
  totalActionRequired: v.number(),
  unfulfilledPaid: v.number(),
  overduePaid: v.number(),
  lowStockCount: v.number(),
  lowStockVariants: v.array(v.object({ variantId: v.string(), nameEn: v.string(), nameEs: v.string(), stock: v.number() })),
  latestOrderTimestamp: v.number(),
});
