/**
 * Pure admin analytics: revenue, pipeline, top sellers, stock health and the
 * 7-day sales chart. Covered by analyticsModel.test.ts.
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

export function computeAnalytics(orders: Doc<"orders">[], allVariants: Doc<"variants">[], now: number) {
  // Archived products are out of the catalog: they do not count toward stock or low-stock views.
  const variants = allVariants.filter((v) => v.archivedAt === undefined);
  let totalRevenue = 0;
  let completedOrdersCount = 0;
  let stripeRevenue = 0;
  let stripeOrdersCount = 0;
  let whatsappRevenue = 0;
  let whatsappPaidCount = 0;

  // Orders on each axis (ADR 0024). Cancelled Orders are counted once, apart; fulfillment
  // counts only settled Orders, so abandoned checkouts do not swell "unfulfilled".
  const paymentStatusCounts = Object.fromEntries(PAYMENT_STATUSES.map((s) => [s, 0])) as Record<PaymentStatus, number>;
  const fulfillmentStatusCounts = Object.fromEntries(FULFILLMENT_STATUSES.map((s) => [s, 0])) as Record<
    FulfillmentStatus,
    number
  >;
  let cancelledCount = 0;

  const variantSalesMap: Record<string, { name: string; units: number; revenue: number; image: string }> = {};

  // Last 7 days, keyed by UTC date, ending at `now`.
  const dailyMap: Record<string, { date: string; revenue: number; orders: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const key = new Date(now - i * ONE_DAY_MS).toISOString().split("T")[0];
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

      if (o.paymentMethod === "stripe") {
        stripeRevenue += o.total;
        stripeOrdersCount += 1;
      } else if (o.paymentMethod === "whatsapp") {
        whatsappRevenue += o.total;
        whatsappPaidCount += 1;
      }

      for (const item of o.items) {
        if (!variantSalesMap[item.variantId]) {
          variantSalesMap[item.variantId] = { name: item.name, units: 0, revenue: 0, image: item.image };
        }
        variantSalesMap[item.variantId].units += item.quantity;
        variantSalesMap[item.variantId].revenue += item.price * item.quantity;
      }

      const orderDate = new Date(o.createdAt).toISOString().split("T")[0];
      if (dailyMap[orderDate]) {
        dailyMap[orderDate].revenue += o.total;
        dailyMap[orderDate].orders += 1;
      }
    }
  }

  const aov = completedOrdersCount > 0 ? Math.round(totalRevenue / completedOrdersCount) : 0;

  const topVariants = Object.entries(variantSalesMap)
    .map(([variantId, stats]) => ({ variantId, ...stats }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  const lowStockVariants = variants
    .filter((v) => isLowStock(v.stock))
    .map((v) => ({
      _id: v._id,
      variantId: v.variantId,
      nameEn: v.nameEn,
      nameEs: v.nameEs,
      stock: v.stock,
      silhouette: v.silhouette,
      priceUsd: v.priceUsd,
      image: v.image,
      primaryHex: v.primaryHex,
    }))
    .sort((a, b) => a.stock - b.stock);

  return {
    totalRevenue,
    completedOrdersCount,
    totalOrdersCount: orders.length,
    aov,
    paymentBreakdown: {
      stripe: { revenue: stripeRevenue, orders: stripeOrdersCount },
      // Historical WhatsApp/Zelle sales (ADR 0023): no new ones are created.
      whatsapp: { revenue: whatsappRevenue, orders: whatsappPaidCount },
    },
    paymentStatusCounts,
    fulfillmentStatusCounts,
    cancelledCount,
    topVariants,
    lowStockVariants,
    inventorySummary: {
      totalVariantsCount: variants.length,
      totalInventoryUnits: variants.reduce((sum, v) => sum + v.stock, 0),
      outOfStockCount: variants.filter((v) => v.stock === 0).length,
    },
    dailySales: Object.values(dailyMap),
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
  paymentBreakdown: v.object({ stripe: revenueCount, whatsapp: revenueCount }),
  paymentStatusCounts: v.record(v.string(), v.number()),
  fulfillmentStatusCounts: v.record(v.string(), v.number()),
  cancelledCount: v.number(),
  topVariants: v.array(
    v.object({ variantId: v.string(), name: v.string(), units: v.number(), revenue: v.number(), image: v.string() })
  ),
  lowStockVariants: v.array(
    v.object({
      _id: v.id("variants"),
      variantId: v.string(),
      nameEn: v.string(),
      nameEs: v.string(),
      stock: v.number(),
      silhouette: v.string(),
      priceUsd: v.number(),
      image: v.string(),
      primaryHex: v.string(),
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
