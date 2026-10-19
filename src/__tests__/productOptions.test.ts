import { describe, expect, it } from "vitest";
import type { CapVariant } from "../data/caps";
import {
  cartLineId,
  colorwayStock,
  gallerySlides,
  initialSelection,
  purchaseState,
  skuStock,
  type SkuStock,
} from "../lib/productOptions";

const NOW = Date.UTC(2026, 9, 17);

const tee: CapVariant = {
  id: "butterfly-grunge-tee",
  nameEn: "Butterfly Tee",
  nameEs: "Playera Mariposa",
  silhouette: "tee",
  category: "apparel",
  primaryHex: "#18181b",
  secondaryHex: "#ffffff",
  image: "/shirts/butterfly-black.jpg",
  graphicImage: "/shirts/graphics/butterfly.jpg",
  stock: 9,
  priceUsd: 80,
  defaultColorway: "butter-cream",
  sizes: ["S", "M", "L", "XL", "2XL"],
  colorways: [
    { id: "washed-black", nameEn: "Black", nameEs: "Negro", hex: "#18181b", borderHex: "#000", modelImage: "/shirts/butterfly-black.jpg", catalogShot: "/catalog/tees/b/washed-black.webp" },
    { id: "butter-cream", nameEn: "Cream", nameEs: "Crema", hex: "#fefce8", borderHex: "#000", modelImage: "/shirts/butterfly-cream.jpg", catalogShot: "/catalog/tees/b/butter-cream.webp" },
  ],
};

const cap: CapVariant = {
  id: "negro-rojo",
  nameEn: "Black / Red",
  nameEs: "Negro / Rojo",
  silhouette: "snapback",
  primaryHex: "#111111",
  secondaryHex: "#ef4444",
  image: "/caps/negro-rojo.png",
  catalogShot: "/catalog/caps/negro-rojo.webp",
  stock: 3,
  priceUsd: 120,
};

const skus: SkuStock[] = [
  { colorway: "washed-black", size: "L", stock: 2 },
  { colorway: "washed-black", size: "M", stock: 0 },
  { colorway: "butter-cream", size: "L", stock: 7 },
];

describe("initialSelection", () => {
  it("uses a valid colorway and size from the URL", () => {
    expect(initialSelection(tee, { colorway: "washed-black", size: "XL" })).toEqual({ colorway: "washed-black", size: "XL" });
  });
  it("falls back to the default colorway and never preselects a size", () => {
    expect(initialSelection(tee, { colorway: "mauve", size: "XXXL" })).toEqual({ colorway: "butter-cream", size: undefined });
    expect(initialSelection(tee, {})).toEqual({ colorway: "butter-cream", size: undefined });
  });
  it("has no options for caps", () => {
    expect(initialSelection(cap, { colorway: "washed-black", size: "L" })).toEqual({});
  });
});

describe("stock helpers", () => {
  it("reads one SKU and a colorway's total", () => {
    expect(skuStock(skus, "washed-black", "L")).toBe(2);
    expect(skuStock(skus, "washed-black", "S")).toBe(0);
    expect(skuStock(skus, "washed-black")).toBe(0);
    expect(colorwayStock(skus, "washed-black")).toBe(2);
    expect(colorwayStock(skus, "heather-grey")).toBe(0);
  });
  it("builds the same cart line ids as the store", () => {
    expect(cartLineId(tee, { colorway: "washed-black", size: "L" })).toBe("butterfly-grunge-tee-washed-black-L");
    expect(cartLineId(cap, {})).toBe("negro-rojo");
  });
});

describe("purchaseState", () => {
  it("asks for a size before a tee can be added", () => {
    expect(purchaseState(tee, { colorway: "butter-cream" }, skus, 0, NOW)).toEqual({ kind: "select-size" });
  });
  it("uses the SKU's stock, not the tee's total", () => {
    expect(purchaseState(tee, { colorway: "washed-black", size: "L" }, skus, 0, NOW)).toEqual({ kind: "available", available: 2, inBag: 0 });
    expect(purchaseState(tee, { colorway: "washed-black", size: "M" }, skus, 0, NOW)).toEqual({ kind: "size-sold-out" });
    expect(purchaseState(tee, { colorway: "washed-black", size: "L" }, skus, 2, NOW)).toEqual({ kind: "max-in-bag", inBag: 2 });
  });
  it("reports a colorway with no stock in any size", () => {
    expect(purchaseState({ ...tee }, { colorway: "heather-grey", size: "L" }, skus, 0, NOW)).toEqual({ kind: "colorway-sold-out" });
  });
  it("handles caps, sold-out and upcoming drops", () => {
    expect(purchaseState(cap, {}, [], 1, NOW)).toEqual({ kind: "available", available: 2, inBag: 1 });
    expect(purchaseState({ ...cap, stock: 0 }, {}, [], 0, NOW)).toEqual({ kind: "sold-out" });
    expect(purchaseState({ ...cap, isDrop: true, dropStatus: "scheduled", dropDate: NOW + 1000 }, {}, [], 0, NOW)).toEqual({
      kind: "drop-upcoming",
      dropDate: NOW + 1000,
    });
  });
});

describe("gallerySlides", () => {
  const labels = { lifestyle: "On model", artwork: "Artwork", angle: (a: string) => a, colorway: "Black" };
  it("tees: Catalog Shot of the chosen colorway, then its Lifestyle Shot, then the artwork", () => {
    const slides = gallerySlides(tee, { colorway: "washed-black" }, "Butterfly Tee", null, labels);
    expect(slides.map((s) => [s.kind, s.src])).toEqual([
      ["catalog", "/catalog/tees/b/washed-black.webp"],
      ["lifestyle", "/shirts/butterfly-black.jpg"],
      ["artwork", "/shirts/graphics/butterfly.jpg"],
    ]);
  });
  it("tees: every Lifestyle Shot of the chosen colorway, in order", () => {
    const multi = { ...tee, colorways: tee.colorways!.map((c) => (c.id === "washed-black" ? { ...c, modelImages: ["/l1.jpg", "/l2.jpg", "/l3.jpg"] } : c)) };
    const slides = gallerySlides(multi, { colorway: "washed-black" }, "Butterfly Tee", null, labels);
    expect(slides.filter((s) => s.kind === "lifestyle").map((s) => s.src)).toEqual(["/l1.jpg", "/l2.jpg", "/l3.jpg"]);
    expect(slides.at(-1)?.kind).toBe("artwork");
  });
  it("caps: Lifestyle Shots follow the angles, skipping the catalog image and product photo", () => {
    const withLife = { ...cap, images: ["/caps/negro-rojo.png", "/life-1.jpg", "/catalog/caps/negro-rojo.webp", "/life-2.jpg", "/life-1.jpg"] };
    const slides = gallerySlides(withLife, {}, "Black / Red", { front: "/f.webp", left: "/l.webp", back: "/b.webp", right: "/r.webp" }, labels);
    expect(slides.map((s) => [s.kind, s.src])).toEqual([
      ["catalog", "/catalog/caps/negro-rojo.webp"],
      ["angle", "/l.webp"],
      ["angle", "/b.webp"],
      ["angle", "/r.webp"],
      ["lifestyle", "/life-1.jpg"],
      ["lifestyle", "/life-2.jpg"],
    ]);
  });
  it("caps: Catalog Shot, then side and back angles", () => {
    const slides = gallerySlides(cap, {}, "Black / Red", { front: "/f.webp", left: "/l.webp", back: "/b.webp", right: "/r.webp" }, labels);
    expect(slides.map((s) => s.src)).toEqual(["/catalog/caps/negro-rojo.webp", "/l.webp", "/b.webp", "/r.webp"]);
  });
  it("falls back to the product photo when nothing else exists", () => {
    expect(gallerySlides({ ...cap, catalogShot: undefined }, {}, "x", null, labels)).toHaveLength(1);
  });
});
