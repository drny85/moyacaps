import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, applyFilters, chipCount, filtersFromSearchParams, filtersToSearchParams, hasActiveFilters } from "./productFilters";
import type { ProductFilters } from "./productFilters";
import { capRow, teeRow } from "./productFixtures";

const NOW = 1_000_000;
const rows = [
  capRow({ variantId: "live-cap" }),
  capRow({ variantId: "hidden-cap", isAvailable: false }),
  capRow({ variantId: "low-cap", stock: 5, isFeatured: true }),
  capRow({ variantId: "out-cap", stock: 0 }),
  capRow({ variantId: "drop-cap", isDrop: true, dropDate: NOW + 1000 }),
  capRow({ variantId: "archived-cap", archivedAt: 1, isAvailable: false }),
  teeRow({ variantId: "tee" }),
];
const ids = (f: Partial<ProductFilters>) => applyFilters(rows, { ...EMPTY_FILTERS, ...f }, NOW).map((r) => r.variantId);

describe("applyFilters", () => {
  it("leaves archived products out unless Status is Archived", () => {
    expect(ids({})).not.toContain("archived-cap");
    expect(ids({ status: "archived" })).toEqual(["archived-cap"]);
  });

  it("filters by category and status", () => {
    expect(ids({ category: "apparel" })).toEqual(["tee"]);
    expect(ids({ status: "hidden" })).toEqual(["hidden-cap"]);
    expect(ids({ status: "live" })).toEqual(["live-cap", "low-cap", "out-cap", "drop-cap", "tee"]);
    expect(ids({ status: "drop" })).toEqual(["drop-cap"]);
  });

  it("treats low stock as 1 to 5", () => {
    expect(ids({ stock: "low" })).toEqual(["low-cap", "tee"]);
    expect(ids({ stock: "out" })).toEqual(["out-cap"]);
    expect(ids({ stock: "in" })).toEqual(["live-cap", "hidden-cap", "drop-cap"]);
  });

  it("filters featured and needs attention", () => {
    expect(ids({ featured: true })).toEqual(["low-cap"]);
    expect(ids({ attention: true })).toEqual(["out-cap"]);
  });

  it("combines filters with AND, including the search", () => {
    expect(ids({ stock: "low", category: "headwear" })).toEqual(["low-cap"]);
    expect(ids({ q: "skull", stock: "low" })).toEqual(["tee"]);
    expect(ids({ q: "skull", category: "headwear" })).toEqual([]);
  });
});

describe("chipCount", () => {
  it("counts what the list would show with the chip on", () => {
    expect(chipCount(rows, { ...EMPTY_FILTERS, category: "headwear" }, { stock: "out" }, NOW)).toBe(1);
    expect(chipCount(rows, EMPTY_FILTERS, { status: "archived" }, NOW)).toBe(1);
  });
});

describe("URL params", () => {
  it("round-trips every filter", () => {
    const f: ProductFilters = { q: "gótico skull", category: "apparel", status: "drop", stock: "low", featured: true, attention: true };
    expect(filtersFromSearchParams(filtersToSearchParams(f))).toEqual(f);
  });

  it("omits empty filters", () => {
    expect(filtersToSearchParams(EMPTY_FILTERS).toString()).toBe("");
    expect(filtersToSearchParams({ ...EMPTY_FILTERS, featured: true }).toString()).toBe("featured=1");
  });

  it("ignores junk values", () => {
    expect(filtersFromSearchParams(new URLSearchParams("status=foo&stock=bar&category=hats&featured=yes"))).toEqual(EMPTY_FILTERS);
  });
});

describe("hasActiveFilters", () => {
  it("is false only for no query and no chips", () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, q: " " })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, stock: "out" })).toBe(true);
  });
});
