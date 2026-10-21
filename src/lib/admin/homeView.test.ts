import { describe, expect, it } from "vitest";
import { toHomeVM } from "./homeView";
import type { AnalyticsInput, AttentionInput } from "./homeView";

const money = (n: number, locale: "en" | "es") =>
  new Intl.NumberFormat(locale, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const day = (date: string, revenue: number, orders = revenue > 0 ? 1 : 0) => ({ date, revenue, orders });

const analytics: AnalyticsInput = {
  windows: { today: { revenue: 120, orders: 2 }, d7: { revenue: 840, orders: 11 }, d30: { revenue: 1234, orders: 39 } },
  dailySales: [day("2026-10-12", 0), day("2026-10-13", 50), day("2026-10-14", 200), day("2026-10-15", 100)],
  lowStock: [
    { variantId: "gothic-skull", nameEn: "Gothic Skull", nameEs: "Calavera Gótica", colorway: "White", size: "M", stock: 2, image: "/g.png" },
    { variantId: "0880-black", nameEn: "0880 Black", nameEs: "0880 Negro", stock: 0, image: "/b.png" },
  ],
  topVariants: [{ variantId: "boxing", name: "Boxing Gloves", units: 14, revenue: 840, image: "/x.png" }],
  fulfillmentStatusCounts: { delivery_exception: 1, returned: 2 },
  paymentStatusCounts: { disputed: 1 },
};
const attention: AttentionInput = { totalActionRequired: 3, overduePaid: 1, lowStockCount: 2 };

describe("toHomeVM", () => {
  const vm = toHomeVM(analytics, attention, "en");

  it("maps attention counts to queue links with tones", () => {
    expect(vm.attention.map((a) => [a.id, a.count, a.tone, a.href])).toEqual([
      ["needs_packing", 3, "amber", "/admin/orders?queue=needs_packing"],
      ["overdue", 1, "rose", "/admin/orders?queue=overdue"],
      ["problems", 4, "purple", "/admin/orders?queue=problems"],
      ["low_stock", 2, "amber", "/admin/products?stock=low"],
    ]);
  });

  it("counts low stock from the same rows the list shows", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ variantId: `cap-${i}`, nameEn: `Cap ${i}`, nameEs: `Gorra ${i}`, stock: i, image: "/c.png" }));
    const capped = toHomeVM({ ...analytics, lowStock: many }, { ...attention, lowStockCount: 1 }, "en");
    expect(capped.attention.find((a) => a.id === "low_stock")?.count).toBe(12);
  });

  it("greys out a queue with nothing in it", () => {
    const quiet = toHomeVM({ ...analytics, fulfillmentStatusCounts: {}, paymentStatusCounts: {} }, { ...attention, overduePaid: 0 }, "en");
    expect(quiet.attention.map((a) => a.tone)).toEqual(["amber", "zinc", "zinc", "amber"]);
  });

  it("formats tiles in both locales", () => {
    expect(vm.tiles.map((t) => [t.id, t.revenueLabel, t.orders])).toEqual([
      ["today", money(120, "en"), 2],
      ["d7", money(840, "en"), 11],
      ["d30", money(1234, "en"), 39],
    ]);
    expect(toHomeVM(analytics, attention, "es").tiles[2].revenueLabel).toBe(money(1234, "es"));
  });

  it("scales chart bars to the busiest day with a 4% floor", () => {
    expect(vm.chart.bars.map((b) => b.heightPct)).toEqual([4, 25, 100, 50]);
    expect(toHomeVM({ ...analytics, dailySales: [day("2026-10-12", 0)] }, attention, "en").chart.bars[0].heightPct).toBe(4);
  });

  it("labels chart days by day number", () => {
    expect(vm.chart.bars.map((b) => b.label)).toEqual(["12", "13", "14", "15"]);
  });

  it("names tee SKUs with colorway and size, links to the editor", () => {
    expect(vm.lowStock).toEqual([
      { key: "gothic-skull/White/M", name: "Gothic Skull", detail: "White · M", stock: 2, image: "/g.png", href: "/admin/products/gothic-skull" },
      { key: "0880-black", name: "0880 Black", detail: undefined, stock: 0, image: "/b.png", href: "/admin/products/0880-black" },
    ]);
    expect(toHomeVM(analytics, attention, "es").lowStock[0].name).toBe("Calavera Gótica");
  });

  it("shows at most 8 low-stock rows and keeps the total", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ variantId: `cap-${i}`, nameEn: `Cap ${i}`, nameEs: `Gorra ${i}`, stock: i, image: "/c.png" }));
    const capped = toHomeVM({ ...analytics, lowStock: many }, attention, "en");
    expect(capped.lowStock).toHaveLength(8);
    expect(capped.lowStockTotal).toBe(12);
    expect(vm.lowStockTotal).toBe(2);
  });

  it("ranks best sellers from topVariants", () => {
    expect(vm.bestSellers).toEqual([
      { rank: 1, name: "Boxing Gloves", variantId: "boxing", units: 14, revenueLabel: money(840, "en"), image: "/x.png" },
    ]);
  });
});
