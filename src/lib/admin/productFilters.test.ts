import { describe, expect, it } from "vitest";
import { DEFAULT_FILTERS, filterProducts, silhouetteOptions, withFilterCategory } from "./productFilters";
import type { FilterableProduct } from "./productFilters";

const rows: FilterableProduct[] = [
  { variantId: "negro-rojo", nameEn: "Black Red", nameEs: "Negro Rojo", silhouette: "snapback", category: "headwear", isAvailable: true },
  { variantId: "mesh-blue", nameEn: "Mesh Blue", nameEs: "Malla Azul", silhouette: "trucker", category: "headwear", isAvailable: false },
  { variantId: "heavy-tee", nameEn: "Heavy Tee", nameEs: "Playera", silhouette: "tee", category: "apparel", isAvailable: true },
  // Saved before `category` existed: a tee silhouette means apparel.
  { variantId: "old-tee", nameEn: "Old Tee", nameEs: "Vieja", silhouette: "tee", isAvailable: true },
];

const ids = (list: FilterableProduct[]) => list.map((r) => r.variantId);

describe("filterProducts", () => {
  it("returns everything with the default filters", () => {
    expect(ids(filterProducts(rows, DEFAULT_FILTERS))).toEqual(["negro-rojo", "mesh-blue", "heavy-tee", "old-tee"]);
  });

  it("searches names in both languages and the slug, case-insensitively", () => {
    expect(ids(filterProducts(rows, { ...DEFAULT_FILTERS, query: "MALLA" }))).toEqual(["mesh-blue"]);
    expect(ids(filterProducts(rows, { ...DEFAULT_FILTERS, query: "black" }))).toEqual(["negro-rojo"]);
    expect(ids(filterProducts(rows, { ...DEFAULT_FILTERS, query: "heavy-" }))).toEqual(["heavy-tee"]);
  });

  it("filters by category, with the legacy fallback", () => {
    expect(ids(filterProducts(rows, { ...DEFAULT_FILTERS, category: "apparel" }))).toEqual(["heavy-tee", "old-tee"]);
    expect(ids(filterProducts(rows, { ...DEFAULT_FILTERS, category: "headwear" }))).toEqual(["negro-rojo", "mesh-blue"]);
  });

  it("filters by silhouette and availability", () => {
    expect(ids(filterProducts(rows, { ...DEFAULT_FILTERS, silhouette: "trucker" }))).toEqual(["mesh-blue"]);
    expect(ids(filterProducts(rows, { ...DEFAULT_FILTERS, availability: "unavailable" }))).toEqual(["mesh-blue"]);
    expect(ids(filterProducts(rows, { ...DEFAULT_FILTERS, availability: "available" }))).toEqual(["negro-rojo", "heavy-tee", "old-tee"]);
  });
});

describe("silhouetteOptions", () => {
  it("lists the silhouettes of the chosen category, or all of them", () => {
    expect(silhouetteOptions("headwear")).toEqual(["snapback", "trucker"]);
    expect(silhouetteOptions("all")).toEqual(["snapback", "trucker", "tee"]);
  });
});

describe("withFilterCategory", () => {
  it("resets a silhouette the new category does not have", () => {
    const filters = { ...DEFAULT_FILTERS, silhouette: "trucker" };
    expect(withFilterCategory(filters, "apparel")).toEqual({ ...DEFAULT_FILTERS, category: "apparel", silhouette: "all" });
    expect(withFilterCategory(filters, "headwear")).toEqual({ ...filters, category: "headwear" });
  });
});
