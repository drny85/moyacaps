/**
 * Pure admin analytics: revenue, pipeline, top sellers, stock health and the
 * 7-day sales chart. Covered by analyticsModel.test.ts.
 */
import type { Doc } from "./_generated/dataModel";
import { isPaidLike } from "./orderModel";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/** Analytics low-stock threshold (units). */
export const ANALYTICS_LOW_STOCK_UNITS = 5;
/** Order-desk attention low-stock threshold (units). */
export const ATTENTION_LOW_STOCK_UNITS = 2;

export function computeAnalytics(orders: Doc<"orders">[], variants: Doc<"variants">[], now: number) {
  let totalRevenue = 0;
  let completedOrdersCount = 0;
  let stripeRevenue = 0;
  let stripeOrdersCount = 0;
  let whatsappRevenue = 0;
  let whatsappPaidCount = 0;
  let whatsappPipelineValue = 0;
  let whatsappPipelineCount = 0;

  const statusCounts: Record<string, number> = {
    pending: 0,
    paid: 0,
    dispatched: 0,
    delivered: 0,
    cancelled: 0,
    whatsapp_initiated: 0,
  };

  const variantSalesMap: Record<string, { name: string; units: number; revenue: number; image: string }> = {};

  // Last 7 days, keyed by UTC date, ending at `now`.
  const dailyMap: Record<string, { date: string; revenue: number; orders: number }> = {};
  for (let i = 6; i >= 0; i--) {
    const key = new Date(now - i * ONE_DAY_MS).toISOString().split("T")[0];
    dailyMap[key] = { date: key, revenue: 0, orders: 0 };
  }

  for (const o of orders) {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;

    if (isPaidLike(o.status)) {
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
    } else if (o.status === "whatsapp_initiated") {
      whatsappPipelineValue += o.total;
      whatsappPipelineCount += 1;
    }
  }

  const aov = completedOrdersCount > 0 ? Math.round(totalRevenue / completedOrdersCount) : 0;

  const topVariants = Object.entries(variantSalesMap)
    .map(([variantId, stats]) => ({ variantId, ...stats }))
    .sort((a, b) => b.units - a.units)
    .slice(0, 5);

  const lowStockVariants = variants
    .filter((v) => v.stock <= ANALYTICS_LOW_STOCK_UNITS)
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
    whatsappPipeline: {
      value: whatsappPipelineValue,
      count: whatsappPipelineCount,
    },
    paymentBreakdown: {
      stripe: { revenue: stripeRevenue, orders: stripeOrdersCount },
      whatsapp: { revenue: whatsappRevenue, orders: whatsappPaidCount },
    },
    statusCounts,
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

/** Order-desk attention counters over the bounded paid / WhatsApp queues. */
export function computeAttentionStats(
  paidOrders: Array<{ createdAt?: number }>,
  whatsappOrders: unknown[],
  latestOrderTimestamp: number,
  variants: Doc<"variants">[],
  now: number
) {
  const twentyFourHoursAgo = now - ONE_DAY_MS;
  const unfulfilledPaid = paidOrders.length;
  const pendingWhatsApp = whatsappOrders.length;
  const overduePaid = paidOrders.filter((o) => (o.createdAt || 0) < twentyFourHoursAgo).length;

  const lowStockVariants = variants
    .filter((v) => v.stock <= ATTENTION_LOW_STOCK_UNITS)
    .map((v) => ({
      variantId: v.variantId,
      nameEn: v.nameEn,
      nameEs: v.nameEs,
      stock: v.stock,
    }));

  return {
    totalActionRequired: unfulfilledPaid + pendingWhatsApp,
    unfulfilledPaid,
    overduePaid,
    pendingWhatsApp,
    lowStockCount: lowStockVariants.length,
    lowStockVariants,
    latestOrderTimestamp,
  };
}
