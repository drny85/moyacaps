import { describe, expect, it } from "vitest";
import type { Doc, Id } from "./_generated/dataModel";
import { computeAnalytics, computeAttentionStats } from "./analyticsModel";

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
    status: "paid",
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
    order({ total: 200, paymentMethod: "whatsapp", status: "delivered", items: [{ variantId: "tee", name: "Tee", quantity: 2, price: 80, image: "/t.png" }] }),
    order({ total: 50, status: "whatsapp_initiated", paymentMethod: "whatsapp" }),
    order({ total: 999, status: "cancelled" }),
    order({ total: 300, createdAt: NOW - 10 * DAY }),
  ];
  const result = computeAnalytics(orders, [variant("cap", 0), variant("tee", 4), variant("big", 30)], NOW);

  it("counts revenue only from paid-like orders, split by payment method", () => {
    expect(result.totalRevenue).toBe(608);
    expect(result.completedOrdersCount).toBe(3);
    expect(result.totalOrdersCount).toBe(5);
    expect(result.aov).toBe(203);
    expect(result.paymentBreakdown).toEqual({ stripe: { revenue: 408, orders: 2 }, whatsapp: { revenue: 200, orders: 1 } });
  });

  it("tracks the open WhatsApp pipeline and status counts", () => {
    expect(result.whatsappPipeline).toEqual({ value: 50, count: 1 });
    expect(result.statusCounts).toMatchObject({ paid: 2, delivered: 1, whatsapp_initiated: 1, cancelled: 1, pending: 0 });
  });

  it("ranks top variants by units sold; ties keep first-sold order", () => {
    expect(result.topVariants.map((v) => [v.variantId, v.units, v.revenue])).toEqual([
      ["cap", 2, 200],
      ["tee", 2, 160],
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
  it("counts the paid and WhatsApp queues, overdue paid orders and low stock (≤ 2)", () => {
    const stats = computeAttentionStats(
      [{ createdAt: NOW }, { createdAt: NOW - 2 * DAY }, {}],
      [{}, {}],
      NOW,
      [variant("cap", 2), variant("tee", 3)],
      NOW
    );
    expect(stats).toEqual({
      totalActionRequired: 5,
      unfulfilledPaid: 3,
      overduePaid: 2,
      pendingWhatsApp: 2,
      lowStockCount: 1,
      lowStockVariants: [{ variantId: "cap", nameEn: "cap", nameEs: "cap", stock: 2 }],
      latestOrderTimestamp: NOW,
    });
  });
});
