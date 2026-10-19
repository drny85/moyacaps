import { describe, expect, it } from "vitest";
import { toProductCard } from "./productCard";
import { capRow, teeRow } from "./productFixtures";

const NOW = Date.UTC(2026, 9, 20, 12);
const OCT_24_6PM = new Date(2026, 9, 24, 18, 0).getTime();

describe("toProductCard", () => {
  it("shows the Product in the admin's locale", () => {
    const card = toProductCard(capRow(), "es", NOW);
    expect(card).toMatchObject({ id: "negro-rojo", name: "Negro Rojo", slug: "negro-rojo", priceLabel: "$45", stock: 12, stockLevel: "in" });
    expect(card.imageUrl).toBe("/shots/negro-rojo.jpg");
  });

  it("orders pills hidden, featured, drop, attention", () => {
    const card = toProductCard(
      capRow({ isAvailable: false, isFeatured: true, isDrop: true, dropDate: OCT_24_6PM, angles: undefined }),
      "en",
      NOW
    );
    expect(card.pills).toEqual(["hidden", "featured", "drop", "attention"]);
    expect(card.attention).toEqual(["angles_incomplete"]);
  });

  it("formats a scheduled drop in en and es", () => {
    const row = capRow({ isDrop: true, dropDate: OCT_24_6PM, subscribersCount: 14 });
    expect(toProductCard(row, "en", NOW).drop).toEqual({ date: "Oct 24, 6 PM", subscribers: 14, live: false });
    expect(toProductCard(row, "es", NOW).drop?.date).toMatch(/24 oct/);
  });

  it("marks a released drop live", () => {
    expect(toProductCard(capRow({ isDrop: true, dropDate: NOW - 1 }), "en", NOW).drop?.live).toBe(true);
    expect(toProductCard(capRow({ isDrop: false }), "en", NOW).drop).toBeUndefined();
  });

  it("uses the default colorway's Catalog Shot for a tee, and sums its SKUs", () => {
    const card = toProductCard(teeRow({ defaultColorway: "white" }), "en", NOW);
    expect(card.imageUrl).toBe("/t/white.jpg");
    expect(card.stock).toBe(5);
    expect(card.isTee).toBe(true);
  });

  it("has no image when the Product has none", () => {
    expect(toProductCard(capRow({ catalogShot: undefined, image: "" }), "en", NOW).imageUrl).toBeUndefined();
  });

  it("formats a fractional price with cents", () => {
    expect(toProductCard(capRow({ priceUsd: 44.5 }), "en", NOW).priceLabel).toBe("$44.50");
  });
});
