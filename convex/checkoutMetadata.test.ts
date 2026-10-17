import { describe, expect, it } from "vitest";
import {
  decodeItemsMetadata,
  encodeItemsMetadata,
  MAX_ITEM_CHUNKS,
  STRIPE_METADATA_VALUE_MAX,
} from "./checkoutMetadata";

const TEES = [
  "butterfly-grunge-tee",
  "snake-horseshoe-tee",
  "boxing-gloves-tee",
  "lightning-star-tee",
  "eagle-clover-tee",
  "gothic-skull-tee",
  "vintage-f1-tee",
  "retro-soul-tee",
  "eight-ball-tee",
  "muscle-car-tee",
];
const COLORWAYS = ["washed-black", "crisp-white", "heather-grey", "butter-cream"];
const SIZES = ["S", "M", "L", "XL", "2XL"];

/** 20 distinct tee lines: the largest bag a WhatsApp reservation accepts */
const bigBag = Array.from({ length: 20 }, (_, i) => ({
  variantId: TEES[i % TEES.length],
  quantity: (i % 3) + 1,
  price: 80,
  colorway: COLORWAYS[i % COLORWAYS.length],
  size: SIZES[i % SIZES.length],
}));

describe("Stripe checkout metadata", () => {
  it("a 20-line tee bag round-trips with every value within Stripe's limit", () => {
    const metadata = encodeItemsMetadata(bigBag);
    const keys = Object.keys(metadata);

    expect(keys[0]).toBe("itemsJson");
    expect(keys.length).toBeGreaterThan(1); // one value could not hold it
    for (const value of Object.values(metadata)) {
      expect(value.length).toBeLessThanOrEqual(STRIPE_METADATA_VALUE_MAX);
    }

    expect(decodeItemsMetadata(metadata)).toEqual(
      bigBag.map((i) => ({ v: i.variantId, q: i.quantity, p: i.price, c: i.colorway, s: i.size }))
    );
  });

  it("small bags stay in the single itemsJson value", () => {
    const metadata = encodeItemsMetadata([{ variantId: "negro-rojo", quantity: 2, price: 120 }]);
    expect(metadata).toEqual({ itemsJson: '[{"v":"negro-rojo","q":2,"p":120}]' });
  });

  it("decodes sessions created before the split, including full-shape lines", () => {
    expect(decodeItemsMetadata({ itemsJson: '[{"v":"negro-rojo","q":1,"p":120}]' })).toEqual([
      { v: "negro-rojo", q: 1, p: 120 },
    ]);
    const legacy = [{ variantId: "negro-rojo", name: "Cap", quantity: 1, price: 120, image: "/x.png" }];
    expect(decodeItemsMetadata({ itemsJson: JSON.stringify(legacy) })).toEqual(legacy);
  });

  it("ignores other metadata and returns nothing when items are missing or unreadable", () => {
    expect(decodeItemsMetadata({ orderNumber: "GL-1" })).toEqual([]);
    expect(decodeItemsMetadata(null)).toEqual([]);
    expect(decodeItemsMetadata({ itemsJson: "[{]" })).toEqual([]);
  });

  it("stops at the first missing chunk instead of reading unrelated keys", () => {
    const metadata = { ...encodeItemsMetadata(bigBag), itemsJson_9: '[{"v":"stray","q":1,"p":1}]' };
    expect(decodeItemsMetadata(metadata)).toHaveLength(20);
  });

  it("refuses an order too large to describe in metadata", () => {
    const huge = Array.from({ length: MAX_ITEM_CHUNKS * 8 }, (_, i) => ({ ...bigBag[0], quantity: i + 1 }));
    expect(() => encodeItemsMetadata(huge)).toThrow(/too many lines/);
  });
});
