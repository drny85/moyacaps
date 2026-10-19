import { describe, expect, it } from "vitest";
import { planSkuChanges } from "./skuPlan";

const sku = (colorway: string, size: string, stock = 0) => ({ colorway, size, stock });

describe("planSkuChanges", () => {
  const before = { colorways: ["black", "lime"], sizes: ["S", "M"] };
  const skus = before.colorways.flatMap((c) => before.sizes.map((s) => sku(c, s)));

  it("adding a size inserts one cell per colorway", () => {
    const plan = planSkuChanges(before, { ...before, sizes: ["S", "M", "3XL"] }, skus);
    expect(plan.insert).toEqual([
      { colorway: "black", size: "3XL" },
      { colorway: "lime", size: "3XL" },
    ]);
    expect(plan.remove).toEqual([]);
    expect(plan.blocked).toEqual([]);
  });

  it("removing a colorway with stock is blocked", () => {
    const stocked = skus.map((s) => (s.colorway === "lime" && s.size === "M" ? { ...s, stock: 2 } : s));
    const plan = planSkuChanges(before, { ...before, colorways: ["black"] }, stocked);
    expect(plan.blocked).toEqual([{ colorway: "lime", size: "M", stock: 2 }]);
    expect(plan.remove).toEqual([{ colorway: "lime", size: "S" }]);
  });

  it("removing empty cells lists them for deletion", () => {
    const plan = planSkuChanges(before, { colorways: ["black"], sizes: ["S"] }, skus);
    expect(plan.remove).toHaveLength(3);
    expect(plan.insert).toEqual([]);
  });

  it("inserts a missing cell when a SKU row was never created", () => {
    const plan = planSkuChanges(before, before, skus.slice(1));
    expect(plan.insert).toEqual([{ colorway: "black", size: "S" }]);
  });

  it("no change gives an empty plan", () => {
    expect(planSkuChanges(before, before, skus)).toEqual({ insert: [], remove: [], blocked: [] });
  });
});
