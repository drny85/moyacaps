import { describe, expect, it } from "vitest";
import type { CapVariant } from "../data/caps";
import { NYC_LOOKBOOK } from "../data/lookbook";
import { sceneKeyframes, shoppableHotspots } from "../lib/lookbook";
import { valueAt } from "../lib/motion";
import { SHIRT_VARIANTS } from "../data/caps";

const tee = (id: string, over: Partial<CapVariant> = {}): CapVariant => ({
  id,
  nameEn: id,
  nameEs: id,
  silhouette: "tee",
  category: "apparel",
  primaryHex: "#000",
  secondaryHex: "#fff",
  image: `/shirts/${id}.jpg`,
  stock: 5,
  priceUsd: 80,
  defaultColorway: "crisp-white",
  colorways: [
    { id: "washed-black", nameEn: "Black", nameEs: "Negro", hex: "#000", borderHex: "#000", modelImage: "/b.jpg", catalogShot: `/catalog/tees/${id}/washed-black.webp` },
    { id: "crisp-white", nameEn: "White", nameEs: "Blanco", hex: "#fff", borderHex: "#000", modelImage: "/w.jpg", catalogShot: `/catalog/tees/${id}/crisp-white.webp` },
  ],
  ...over,
});

describe("shoppableHotspots", () => {
  it("links to the photographed colorway when the store sells it", () => {
    const [h] = shoppableHotspots([{ x: 30, y: 50, productId: "eagle", colorway: "washed-black" }], [tee("eagle")]);
    expect(h.href).toBe("/products/eagle?colorway=washed-black");
    expect(h.image).toBe("/catalog/tees/eagle/washed-black.webp");
    expect(h.shownColorSold).toBe(true);
  });

  it("falls back to the default colorway when the photo shows an unsold colour", () => {
    const [h] = shoppableHotspots([{ x: 70, y: 50, productId: "eight" }], [tee("eight")]);
    expect(h.href).toBe("/products/eight");
    expect(h.image).toBe("/catalog/tees/eight/crisp-white.webp");
    expect(h.shownColorSold).toBe(false);
  });

  it("drops hotspots for products that are missing or hidden", () => {
    const out = shoppableHotspots(
      [
        { x: 1, y: 1, productId: "panther" },
        { x: 2, y: 2, productId: "hidden" },
      ],
      [tee("hidden", { isAvailable: false })]
    );
    expect(out).toEqual([]);
  });

  it("every lookbook hotspot points at a real tee and a colorway that tee offers", () => {
    for (const scene of NYC_LOOKBOOK) {
      for (const h of scene.hotspots) {
        const product = SHIRT_VARIANTS.find((p) => p.id === h.productId);
        expect(product, `${scene.id}: ${h.productId}`).toBeDefined();
        if (h.colorway) expect(product!.colorways?.some((c) => c.id === h.colorway)).toBe(true);
        expect(h.x).toBeGreaterThan(0);
        expect(h.x).toBeLessThan(100);
        expect(h.y).toBeGreaterThan(0);
        expect(h.y).toBeLessThan(100);
      }
    }
  });
});

describe("sceneKeyframes", () => {
  it("keeps every offset inside [0, 1] and strictly increasing", () => {
    for (const count of [1, 2, 3, 5]) {
      for (let i = 0; i < count; i++) {
        const k = sceneKeyframes(i, count);
        expect(k.input[0]).toBeGreaterThanOrEqual(0);
        expect(k.input[k.input.length - 1]).toBeLessThanOrEqual(1);
        for (let j = 1; j < k.input.length; j++) expect(k.input[j]).toBeGreaterThan(k.input[j - 1]);
        expect(k.opacity).toHaveLength(k.input.length);
        expect(k.y).toHaveLength(k.input.length);
      }
    }
  });

  it("first scene starts visible, last stays visible, middle fades in and out", () => {
    expect(sceneKeyframes(0, 3).opacity[0]).toBe(1);
    expect(sceneKeyframes(2, 3).opacity.at(-1)).toBe(1);
    expect(sceneKeyframes(1, 3).opacity).toEqual([0, 1, 1, 0]);
  });

  it("adjacent scenes hand over at the same scroll point", () => {
    const a = sceneKeyframes(0, 3);
    const b = sceneKeyframes(1, 3);
    expect(a.input.at(-1)).toBeCloseTo(b.input[1]);
  });
});

describe("valueAt", () => {
  it("interpolates between keyframes and clamps outside them", () => {
    expect(valueAt(0.5, [0, 1], [0, 10])).toBe(5);
    expect(valueAt(-1, [0, 1], [3, 9])).toBe(3);
    expect(valueAt(2, [0, 1], [3, 9])).toBe(9);
  });

  it("only one scene is fully visible at each point in the story", () => {
    for (const p of [0.05, 0.5, 0.95]) {
      const visible = [0, 1, 2].filter((i) => {
        const k = sceneKeyframes(i, 3);
        return valueAt(p, k.input, k.opacity) > 0.99;
      });
      expect(visible).toHaveLength(1);
    }
  });
});

