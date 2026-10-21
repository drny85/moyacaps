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

const sku = (variantId: string, colorway: string, size: string, stock: number): Doc<"skus"> =>
  ({ _id: `${variantId}-${colorway}-${size}` as Id<"skus">, _creationTime: 0, variantId, colorway, size, stock }) as Doc<"skus">;

// New York in October: UTC-4.
const TZ = 240;

describe("computeAnalytics", () => {
  const orders = [
    order({ total: 108 }),
    order({ total: 200, paymentMethod: "whatsapp", fulfillmentStatus: "delivered", items: [{ variantId: "tee", name: "Tee", quantity: 2, price: 80, image: "/t.png" }] }),
    order({ total: 50, paymentStatus: "awaiting_payment", paymentMethod: "whatsapp" }),
    order({ total: 999, cancelledAt: NOW }),
    order({ total: 300, createdAt: NOW - 10 * DAY }),
    order({ total: 70, paymentStatus: "partially_refunded", fulfillmentStatus: "delivered", refundedAmount: 10 }),
    order({ total: 40, fulfillmentStatus: "in_transit", createdAt: NOW - 10 * DAY, items: [{ variantId: "old", name: "Old", quantity: 1, price: 40, image: "/o.png" }] }),
  ];
  const result = computeAnalytics(orders, [variant("cap", 0), variant("tee", 4), variant("big", 30)], [], NOW, TZ);

  it("counts revenue only from paid, uncancelled orders", () => {
    expect(result.totalRevenue).toBe(648);
    expect(result.completedOrdersCount).toBe(4);
    expect(result.totalOrdersCount).toBe(7);
    expect(result.aov).toBe(162);
    expect(result).not.toHaveProperty("paymentBreakdown");
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

  it("charts 30 local days ending today; older sales fall outside", () => {
    expect(result.dailySales).toHaveLength(30);
    expect(result.dailySales.at(-1)).toEqual({ date: "2026-10-17", revenue: 308, orders: 2 });
    expect(result.dailySales.reduce((sum, d) => sum + d.orders, 0)).toBe(4);
  });

  it("buckets by the caller's local day", () => {
    // 03:00 UTC Oct 17 is 23:00 Oct 16 in New York.
    const late = computeAnalytics([order({ createdAt: Date.UTC(2026, 9, 17, 3), total: 10 })], [], [], NOW, TZ);
    expect(late.dailySales.find((d) => d.date === "2026-10-16")).toEqual({ date: "2026-10-16", revenue: 10, orders: 1 });
    expect(late.dailySales.at(-1)?.date).toBe("2026-10-17");
  });

  it("ranks best sellers over the chart window only", () => {
    const old = order({ total: 40, createdAt: NOW - 40 * DAY, items: [{ variantId: "old", name: "Old", quantity: 9, price: 40, image: "/o.png" }] });
    const top = computeAnalytics([order({ total: 108 }), old], [], [], NOW, TZ).topVariants;
    expect(top.map((v) => v.variantId)).toEqual(["cap"]);
  });

  it("sums today, 7-day and 30-day windows", () => {
    const windows = computeAnalytics(
      [order({ total: 100 }), order({ total: 100, createdAt: NOW - 3 * DAY }), order({ total: 100, createdAt: NOW - 10 * DAY }), order({ total: 100, createdAt: NOW - 40 * DAY })],
      [], [], NOW, TZ
    ).windows;
    expect(windows).toEqual({ today: { revenue: 100, orders: 1 }, d7: { revenue: 200, orders: 2 }, d30: { revenue: 300, orders: 3 } });
  });

  it("tees list SKUs, never the variant", () => {
    const colorway = { id: "black", nameEn: "Black", nameEs: "Negro", hex: "#000", borderHex: "#000", lifestyleImage: "/black-life.png", catalogShot: "/black-shot.png" };
    const tee = { ...variant("tee", 4), category: "apparel", image: "", colorways: [colorway] } as Doc<"variants">;
    const low = computeAnalytics([], [tee, variant("cap", 3)], [sku("tee", "black", "M", 2), sku("tee", "black", "L", 9)], NOW, TZ).lowStock;
    expect(low).toEqual([
      { variantId: "tee", nameEn: "tee", nameEs: "tee", colorway: "black", size: "M", stock: 2, image: "/black-shot.png" },
      { variantId: "cap", nameEn: "cap", nameEs: "cap", stock: 3, image: "/cap.png" },
    ]);
  });

  it("summarizes inventory", () => {
    expect(result.inventorySummary).toEqual({ totalVariantsCount: 3, totalInventoryUnits: 34, outOfStockCount: 1 });
  });

  it("has a zero average order value with no sales", () => {
    expect(computeAnalytics([], [], [], NOW, TZ).aov).toBe(0);
  });
});

describe("computeAttentionStats", () => {
  it("counts the paid queue, overdue paid orders and low stock (≤ 5)", () => {
    const stats = computeAttentionStats(
      [{ createdAt: NOW }, { createdAt: NOW - 2 * DAY }, {}],
      NOW,
      [variant("cap", 5), variant("tee", 6)],
      NOW
    );
    expect(stats).toEqual({
      totalActionRequired: 3,
      unfulfilledPaid: 3,
      overduePaid: 2,
      lowStockCount: 1,
      lowStockVariants: [{ variantId: "cap", nameEn: "cap", nameEs: "cap", stock: 5 }],
      latestOrderTimestamp: NOW,
    });
  });
});

describe("archived products", () => {
  const archived = { ...variant("old-cap", 0), archivedAt: NOW };

  it("computeAnalytics ignores them in stock totals and low-stock", () => {
    const result = computeAnalytics([], [variant("cap", 3), archived], [], NOW, TZ);
    expect(result.lowStock.map((v) => v.variantId)).toEqual(["cap"]);
    expect(result.inventorySummary).toMatchObject({ totalVariantsCount: 1, totalInventoryUnits: 3, outOfStockCount: 0 });
  });

  it("computeAttentionStats ignores them in the low-stock list", () => {
    const result = computeAttentionStats([], 0, [variant("cap", 1), archived], NOW);
    expect(result.lowStockVariants.map((v) => v.variantId)).toEqual(["cap"]);
  });
});
