import { describe, expect, it } from "vitest";
import { LOW_STOCK_THRESHOLD, stockLevel, totalStock } from "./stockLevel";
import { capRow, teeRow } from "./productFixtures";

describe("totalStock", () => {
  it("sums a tee's SKUs", () => {
    expect(totalStock(teeRow({ stock: 99 }))).toBe(5);
  });

  it("reads a cap's own stock", () => {
    expect(totalStock(capRow({ stock: 7 }))).toBe(7);
  });
});

describe("stockLevel", () => {
  it("splits at 0 and 5", () => {
    expect(stockLevel(0)).toBe("out");
    expect(stockLevel(1)).toBe("low");
    expect(stockLevel(5)).toBe("low");
    expect(stockLevel(6)).toBe("in");
  });
});

describe("threshold", () => {
  it("mirrors the backend's LOW_STOCK_UNITS", async () => {
    const { LOW_STOCK_UNITS } = await import("../../../convex/catalog/stock");
    expect(LOW_STOCK_THRESHOLD).toBe(LOW_STOCK_UNITS);
  });
});
