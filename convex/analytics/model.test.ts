import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { computeAnalytics, computeAttentionStats } from "./model";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 9, 17, 12);

const order = (overrides: Partial<Doc<"orders">>): Doc<"orders"> =>
  ({
    _id: "o" as Id<"orders">,
    _creationTime: 0,
    orderNumber: "GL-1",
    items: [{ variantId: "cap", name: "Cap", quantity: 1, price: 100, image: "/c.png" }],
    currency: "USD",
    total: 108,
    paymentStatus: "paid",
    fulfillmentStatus: "unfulfilled",
    paymentMethod: "stripe",
    createdAt: NOW,
    ...overrides,
  }) as Doc<"orders">;

const variant = (variantId: string, stock: number): Doc<"variants"> =>
  ({
    _id: variantId as Id<"variants">,
    _creationTime: 0,
    variantId,
    nameEn: variantId,
    nameEs: variantId,
    silhouette: "snapback",
    primaryHex: "#000",
    secondaryHex: "#fff",
    image: `/${variantId}.png`,
    stock,
    priceUsd: 100,
    isFeatured: false,
  }) as Doc<"variants">;

describe("computeAnalytics", () => {
  const orders = [
    order({ total: 108 }),
    order({ total: 200, paymentMethod: "whatsapp", fulfillmentStatus: "delivered", items: [{ variantId: "tee", name: "Tee", quantity: 2, price: 80, image: "/t.png" }] }),
    order({ total: 50, paymentStatus: "awaiting_payment", paymentMethod: "whatsapp" }),
    order({ total: 999, cancelledAt: NOW }),
    order({ total: 300, createdAt: NOW - 10 * DAY }),
    order({ total: 70, paymentStatus: "partially_refunded", fulfillmentStatus: "delivered", refundedAmount: 10 }),
    // Not yet backfilled: read through the legacy status.
    order({ total: 40, paymentStatus: undefined, fulfillmentStatus: undefined, status: "dispatched", createdAt: NOW - 10 * DAY, items: [{ variantId: "old", name: "Old", quantity: 1, price: 40, image: "/o.png" }] }),
  ];
  const result = computeAnalytics(orders, [variant("cap", 0), variant("tee", 4), variant("big", 30)], NOW);

  it("counts revenue only from paid, uncancelled orders, split by payment method", () => {
    expect(result.totalRevenue).toBe(648);
    expect(result.completedOrdersCount).toBe(4);
    expect(result.totalOrdersCount).toBe(7);
    expect(result.aov).toBe(162);
    expect(result.paymentBreakdown).toEqual({ stripe: { revenue: 448, orders: 3 }, whatsapp: { revenue: 200, orders: 1 } });
  });

  it("counts each axis apart, cancelled orders once", () => {
    expect(result.paymentStatusCounts).toEqual({
      awaiting_payment: 1,
      paid: 4,
      partially_refunded: 1,
      refunded: 0,
      disputed: 0,
    });
    // Only settled orders count toward fulfillment.
    expect(result.fulfillmentStatusCounts).toEqual({
      unfulfilled: 2,
      label_purchased: 0,
      in_transit: 1,
      delivered: 2,
      delivery_exception: 0,
      returned: 0,
    });
    expect(result.cancelledCount).toBe(1);
  });

  it("ranks top variants by units sold; ties keep first-sold order", () => {
    expect(result.topVariants.map((v) => [v.variantId, v.units, v.revenue])).toEqual([
      ["cap", 2, 200],
      ["tee", 2, 160],
      ["old", 1, 40],
    ]);
  });

  it("charts the last 7 UTC days ending today; older sales fall outside", () => {
    expect(result.dailySales).toHaveLength(7);
    expect(result.dailySales.at(-1)).toEqual({ date: "2026-10-17", revenue: 308, orders: 2 });
    expect(result.dailySales.reduce((sum, d) => sum + d.orders, 0)).toBe(2);
  });

  it("lists low stock (≤ 5) lowest first and summarizes inventory", () => {
    expect(result.lowStockVariants.map((v) => v.variantId)).toEqual(["cap", "tee"]);
    expect(result.inventorySummary).toEqual({ totalVariantsCount: 3, totalInventoryUnits: 34, outOfStockCount: 1 });
  });

  it("has a zero average order value with no sales", () => {
    expect(computeAnalytics([], [], NOW).aov).toBe(0);
  });
});

describe("computeAttentionStats", () => {
  it("counts the paid queue, overdue paid orders and low stock (≤ 2)", () => {
    const stats = computeAttentionStats(
      [{ createdAt: NOW }, { createdAt: NOW - 2 * DAY }, {}],
      NOW,
      [variant("cap", 2), variant("tee", 3)],
      NOW
    );
    expect(stats).toEqual({
      totalActionRequired: 3,
      unfulfilledPaid: 3,
      overduePaid: 2,
      lowStockCount: 1,
      lowStockVariants: [{ variantId: "cap", nameEn: "cap", nameEs: "cap", stock: 2 }],
      latestOrderTimestamp: NOW,
    });
  });
});

describe("archived products", () => {
  const archived = { ...variant("old-cap", 0), archivedAt: NOW };

  it("computeAnalytics ignores them in stock totals and low-stock", () => {
    const result = computeAnalytics([], [variant("cap", 3), archived], NOW);
    expect(result.lowStockVariants.map((v) => v.variantId)).toEqual(["cap"]);
    expect(result.inventorySummary).toMatchObject({ totalVariantsCount: 1, totalInventoryUnits: 3, outOfStockCount: 0 });
  });

  it("computeAttentionStats ignores them in the low-stock list", () => {
    const result = computeAttentionStats([], 0, [variant("cap", 1), archived], NOW);
    expect(result.lowStockVariants.map((v) => v.variantId)).toEqual(["cap"]);
  });
});
