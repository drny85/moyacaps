import { describe, expect, it } from "vitest";
import type { CapVariant } from "../data/caps";
import {
  applyShop,
  colorFamily,
  DEFAULT_STATE,
  familyCounts,
  parseShopState,
  serializeShopState,
  type ShopState,
} from "../lib/shop";

const NOW = Date.UTC(2026, 9, 17);

function cap(id: string, primaryHex: string, extra: Partial<CapVariant> = {}): CapVariant {
  return {
    id,
    nameEn: id,
    nameEs: id,
    silhouette: "snapback",
    category: "headwear",
    primaryHex,
    secondaryHex: "#ef4444",
    image: `/caps/${id}.png`,
    catalogShot: `/catalog/caps/${id}.webp`,
    stock: 5,
    priceUsd: 120,
    ...extra,
  };
}

function tee(id: string, extra: Partial<CapVariant> = {}): CapVariant {
  const cw = (cid: "washed-black" | "crisp-white" | "heather-grey" | "butter-cream", hex: string) => ({
    id: cid,
    nameEn: cid,
    nameEs: cid,
    hex,
    borderHex: hex,
    modelImage: `/shirts/${id}-${cid}.jpg`,
    catalogShot: `/catalog/tees/${id}/${cid}.webp`,
  });
  return {
    id,
    nameEn: id,
    nameEs: id,
    silhouette: "tee",
    category: "apparel",
    primaryHex: "#18181b",
    secondaryHex: "#ffffff",
    image: `/shirts/${id}-black.jpg`,
    stock: 10,
    priceUsd: 80,
    printPosition: "front",
    defaultColorway: "washed-black",
    colorways: [
      cw("washed-black", "#18181b"),
      cw("crisp-white", "#fafafa"),
      cw("heather-grey", "#9ca3af"),
      cw("butter-cream", "#fefce8"),
    ],
    ...extra,
  };
}

const state = (s: Partial<ShopState>): ShopState => ({ ...DEFAULT_STATE, ...s });

describe("colorFamily (seeded cap crowns and tee fabrics)", () => {
  it.each([
    ["#111111", "black"], // negro-rojo
    ["#f8fafc", "white"], // blanco-rojo
    ["#1e293b", "blue"], // azul-marino (navy)
    ["#dc2626", "red"],
    ["#14532d", "green"],
    ["#6b7280", "grey"], // gris (blue-tinted grey)
    ["#d6c7a1", "cream"], // beige
    ["#451a03", "brown"], // marron
    ["#1d4ed8", "blue"], // azul-rey
    ["#f472b6", "pink"],
    ["#6b21a8", "purple"],
    ["#06b6d4", "blue"], // turquesa
    ["#4b5563", "grey"], // camuflaje-gris
    ["#374151", "grey"],
    ["#18181b", "black"], // washed black
    ["#fafafa", "white"],
    ["#9ca3af", "grey"],
    ["#fefce8", "cream"], // butter cream
  ])("%s → %s", (hex, family) => {
    expect(colorFamily(hex)).toBe(family);
  });
});

describe("applyShop", () => {
  const products = [
    cap("negro-rojo", "#111111", { isFeatured: true }),
    cap("blanco-negro-trucker", "#f8fafc", { silhouette: "trucker", priceUsd: 125 }),
    cap("rosa-blanco", "#f472b6", { stock: 0 }),
    tee("eagle-clover-tee"),
    tee("butterfly-grunge-tee"),
  ];

  it("splits caps and tees by category", () => {
    expect(applyShop(products, state({ category: "caps" }), NOW).map((i) => i.product.id)).toEqual([
      "negro-rojo",
      "blanco-negro-trucker",
      "rosa-blanco",
    ]);
    expect(applyShop(products, state({ category: "tees" }), NOW)).toHaveLength(2);
  });

  it("matches tees on any colorway and opens the card on the matching colorway", () => {
    const items = applyShop(products, state({ colors: ["cream"] }), NOW);
    expect(items.map((i) => i.product.id)).toEqual(["eagle-clover-tee", "butterfly-grunge-tee"]);
    expect(items[0].colorway).toBe("butter-cream");
    expect(items[0].image).toBe("/catalog/tees/eagle-clover-tee/butter-cream.webp");
  });

  it("silhouette narrows caps only", () => {
    const bySilhouette = applyShop(products, state({ silhouettes: ["trucker"] }), NOW).map((i) => i.product.id);
    expect(bySilhouette).toEqual(["blanco-negro-trucker", "eagle-clover-tee", "butterfly-grunge-tee"]);
  });

  it("in-stock hides sold-out products and unreleased drops", () => {
    const withDrop = [...products, cap("drop", "#111111", { isDrop: true, dropStatus: "scheduled", dropDate: NOW + 1e6 })];
    const ids = applyShop(withDrop, state({ inStock: true }), NOW).map((i) => i.product.id);
    expect(ids).not.toContain("rosa-blanco");
    expect(ids).not.toContain("drop");
  });

  it("sorts by price both ways, stable for equal prices", () => {
    const asc = applyShop(products, state({ sort: "price-asc" }), NOW).map((i) => i.product.priceUsd);
    expect(asc).toEqual([80, 80, 120, 120, 125]);
    const desc = applyShop(products, state({ sort: "price-desc" }), NOW).map((i) => i.product.priceUsd);
    expect(desc).toEqual([125, 120, 120, 80, 80]);
  });

  it("featured sort puts featured first and sold-out last", () => {
    const ids = applyShop(products, state({}), NOW).map((i) => i.product.id);
    expect(ids[0]).toBe("negro-rojo");
    expect(ids[ids.length - 1]).toBe("rosa-blanco");
  });

  it("counts colour families within the category", () => {
    expect(familyCounts(products, "caps")).toEqual({ black: 1, white: 1, pink: 1 });
    expect(familyCounts(products, "tees").cream).toBe(2);
  });
});

describe("URL state", () => {
  it("round-trips and omits defaults", () => {
    const s = state({ category: "tees", colors: ["black", "cream"], inStock: true, sort: "price-asc" });
    const qs = serializeShopState(s);
    expect(qs).toBe("?category=tees&color=black%2Ccream&stock=1&sort=price-asc");
    expect(parseShopState(new URLSearchParams(qs))).toEqual(s);
    expect(serializeShopState(DEFAULT_STATE)).toBe("");
  });

  it("drops unknown values instead of failing", () => {
    expect(parseShopState(new URLSearchParams("?category=hats&color=black,mauve&sort=cheapest"))).toEqual(
      state({ colors: ["black"] })
    );
  });

  it("does not serialize facets that cannot apply to the category", () => {
    expect(serializeShopState(state({ category: "tees", silhouettes: ["trucker"] }))).toBe("?category=tees");
  });
});
