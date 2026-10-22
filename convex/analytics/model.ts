/**
 * Pure admin analytics: revenue, pipeline, top sellers, stock health and the
 * 30-day sales chart. All-time totals come from status cells (the `orderStats`
 * aggregate); the chart and top sellers from the last 30 days of orders.
 * Covered by model.test.ts.
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
  type StatusSource,
} from "../orders/status";

import { isLowStock } from "../catalog/stock";
import { matchesDeskFilter } from "../orders/deskFilters";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
/** Days on the Home chart; the 7-day and today windows are slices of it. */
const CHART_DAYS = 30;

/** Earliest `createdAt` the chart can show: 30 days back plus a day of slack for any time zone. */
export function chartWindowStart(now: number): number {
  return now - (CHART_DAYS + 1) * ONE_DAY_MS;
}

/** `orderStats` key of an Order: [cancelled ? 1 : 0, Payment Status, Fulfillment Status]. */
export type OrderStatsKey = [number, PaymentStatus, FulfillmentStatus];

export function orderStatsKey(order: StatusSource): OrderStatsKey {
  const axes = statusAxes(order);
  return [axes.cancelledAt !== undefined ? 1 : 0, axes.paymentStatus, axes.fulfillmentStatus];
}

/** How many Orders share one status combination, and their summed totals. */
export type StatusCell = {
  cancelled: boolean;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  count: number;
  revenue: number;
};

/**
 * All-time counters from the status cells, by the same rules the Order list uses: Cancelled
 * Orders are counted once, apart; fulfillment counts only settled Orders (ADR 0024), so
 * abandoned checkouts do not swell "unfulfilled"; Problems is the desk's own queue rule.
 */
export function orderTotals(cells: StatusCell[]) {
  const paymentStatusCounts = Object.fromEntries(PAYMENT_STATUSES.map((s) => [s, 0])) as Record<PaymentStatus, number>;
  const fulfillmentStatusCounts = Object.fromEntries(FULFILLMENT_STATUSES.map((s) => [s, 0])) as Record<
    FulfillmentStatus,
    number
  >;
  const totals = {
    totalRevenue: 0,
    completedOrdersCount: 0,
    totalOrdersCount: 0,
    paymentStatusCounts,
    fulfillmentStatusCounts,
    cancelledCount: 0,
    problemsCount: 0,
  };
  for (const cell of cells) {
    if (cell.count === 0) continue;
    // A cell stands for its Orders: only the status axes matter to these rules (`now` is unused by "problems").
    const order: StatusSource = {
      paymentStatus: cell.paymentStatus,
      fulfillmentStatus: cell.fulfillmentStatus,
      ...(cell.cancelled && { cancelledAt: 0 }),
    };
    totals.totalOrdersCount += cell.count;
    if (cell.cancelled) totals.cancelledCount += cell.count;
    else {
      paymentStatusCounts[cell.paymentStatus] += cell.count;
      if (hasSettled(order)) fulfillmentStatusCounts[cell.fulfillmentStatus] += cell.count;
    }
    if (matchesDeskFilter(order, "problems", 0)) totals.problemsCount += cell.count;
    if (countsAsSale(order)) {
      totals.totalRevenue += cell.revenue;
      totals.completedOrdersCount += cell.count;
    }
  }
  return totals;
}

export type OrderTotals = ReturnType<typeof orderTotals>;

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

/**
 * The dashboard: `totals` from `orderTotals`, and `recentOrders` (at least the chart window,
 * see `chartWindowStart`) for the 30-day chart and best sellers.
 */
export function computeAnalytics(
  totals: OrderTotals,
  recentOrders: Doc<"orders">[],
  allVariants: Doc<"variants">[],
  skus: Doc<"skus">[],
  now: number,
  tzOffsetMinutes: number
) {
  // Archived products are out of the catalog: they do not count toward stock or low-stock views.
  const variants = allVariants.filter((v) => v.archivedAt === undefined);
  const { totalRevenue, completedOrdersCount } = totals;

  const variantSalesMap: Record<string, { name: string; units: number; revenue: number; image: string }> = {};

  // Last 30 local days ending at `now`.
  const dailyMap: Record<string, DayBucket> = {};
  for (let i = CHART_DAYS - 1; i >= 0; i--) {
    const key = localDayKey(now - i * ONE_DAY_MS, tzOffsetMinutes);
    dailyMap[key] = { date: key, revenue: 0, orders: 0 };
  }

  for (const o of recentOrders) {
    if (!countsAsSale(o)) continue;
    // Best sellers and the chart share the 30-day window; the totals are all-time.
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

  const aov = completedOrdersCount > 0 ? Math.round(totalRevenue / completedOrdersCount) : 0;

  const topVariants = Object.entries(variantSalesMap)
    .map(([variantId, stats]) => ({ variantId, ...stats }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  const dailySales = Object.values(dailyMap);

  return {
    ...totals,
    aov,
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
  problemsCount: v.number(),
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
