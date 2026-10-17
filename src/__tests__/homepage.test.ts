import { describe, expect, it } from "vitest";
import type { CapVariant } from "../data/caps";
import { categoryEntries, pickFeatured } from "../lib/homepage";

const NOW = Date.UTC(2026, 9, 17);

const cap = (id: string, over: Partial<CapVariant> = {}): CapVariant => ({
  id,
  nameEn: id,
  nameEs: id,
  silhouette: "snapback",
  primaryHex: "#111111",
  secondaryHex: "#ef4444",
  image: `/caps/${id}.png`,
  catalogShot: `/catalog/caps/${id}.webp`,
  stock: 5,
  priceUsd: 120,
  ...over,
});

const tee = (id: string, over: Partial<CapVariant> = {}): CapVariant => ({
  id,
  nameEn: id,
  nameEs: `${id}-es`,
  silhouette: "tee",
  category: "apparel",
  primaryHex: "#18181b",
  secondaryHex: "#fff",
  image: `/shirts/${id}.jpg`,
  stock: 10,
  priceUsd: 80,
  defaultColorway: "crisp-white",
  colorways: [
    { id: "washed-black", nameEn: "Black", nameEs: "Negro", hex: "#18181b", borderHex: "#000", modelImage: `/shirts/${id}-black.jpg`, catalogShot: `/catalog/tees/${id}/washed-black.webp` },
    { id: "crisp-white", nameEn: "White", nameEs: "Blanco", hex: "#fafafa", borderHex: "#000", modelImage: `/shirts/${id}-white.jpg`, catalogShot: `/catalog/tees/${id}/crisp-white.webp` },
  ],
  ...over,
});

describe("pickFeatured", () => {
  const products = [
    cap("c1"),
    cap("c2", { isFeatured: true }),
    cap("c3", { stock: 0 }),
    cap("drop", { isDrop: true, dropStatus: "scheduled", dropDate: NOW + 1000 }),
    tee("t1"),
    tee("t2", { isFeatured: true }),
  ];

  it("alternates caps and tees, featured first, skipping what cannot be bought", () => {
    expect(pickFeatured(products, 8, NOW).map((i) => i.product.id)).toEqual(["c2", "t2", "c1", "t1"]);
  });

  it("respects the count and keeps filling from the larger category", () => {
    expect(pickFeatured(products, 3, NOW).map((i) => i.product.id)).toEqual(["c2", "t2", "c1"]);
    const capsOnly = [cap("a"), cap("b"), cap("c")];
    expect(pickFeatured(capsOnly, 2, NOW)).toHaveLength(2);
  });

  it("uses Catalog Shots, tees on their default colorway", () => {
    const items = pickFeatured(products, 2, NOW);
    expect(items.map((i) => i.image)).toEqual(["/catalog/caps/c2.webp", "/catalog/tees/t2/crisp-white.webp"]);
  });
});

describe("categoryEntries", () => {
  it("one tile per category with count and lowest price", () => {
    const entries = categoryEntries([cap("c1", { priceUsd: 125 }), cap("c2", { isFeatured: true }), tee("t1")]);
    expect(entries).toEqual([
      { category: "caps", count: 2, fromPrice: 120, image: "/catalog/caps/c2.webp" },
      { category: "tees", count: 1, fromPrice: 80, image: "/catalog/tees/t1/crisp-white.webp" },
    ]);
  });

  it("honours a preferred lead product and drops empty categories", () => {
    const entries = categoryEntries([cap("c1"), cap("c2", { isFeatured: true })], { caps: "c1" });
    expect(entries).toHaveLength(1);
    expect(entries[0].image).toBe("/catalog/caps/c1.webp");
  });
});
