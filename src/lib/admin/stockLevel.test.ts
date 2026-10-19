import { describe, expect, it } from "vitest";
import { stockLevel, totalStock } from "./stockLevel";
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
