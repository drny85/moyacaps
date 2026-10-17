import { describe, expect, it } from "vitest";
import { backfillTeeColorways, migratePersisted } from "../lib/cartMigration";
import type { CartItem } from "../store/useStore";

const line = (over: Partial<CartItem>): CartItem => ({
  id: "x",
  name: "x",
  priceUsd: 80,
  image: "/x.jpg",
  silhouette: "tee",
  quantity: 1,
  ...over,
});

describe("backfillTeeColorways (bag saved before per-SKU tees)", () => {
  it("gives a tee line without a colorway the tee's default colorway", () => {
    const [out] = backfillTeeColorways([
      line({ id: "boxing-gloves-tee-L", variantId: "boxing-gloves-tee", size: "L", quantity: 2, maxStock: 18 }),
    ]);
    expect(out).toMatchObject({
      id: "boxing-gloves-tee-washed-black-L",
      variantId: "boxing-gloves-tee",
      colorway: "washed-black",
      colorwayName: "Vintage Washed Black",
      size: "L",
      quantity: 2,
    });
  });

  it("merges a backfilled line into an identical existing line", () => {
    const out = backfillTeeColorways([
      line({ id: "boxing-gloves-tee-washed-black-L", variantId: "boxing-gloves-tee", colorway: "washed-black", size: "L", quantity: 1, maxStock: 5 }),
      line({ id: "boxing-gloves-tee-L", variantId: "boxing-gloves-tee", size: "L", quantity: 2, maxStock: 18 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: "boxing-gloves-tee-washed-black-L", quantity: 3, maxStock: 5 });
  });

  it("leaves caps and complete tee lines untouched", () => {
    const cart = [
      line({ id: "negro-rojo", variantId: "negro-rojo", silhouette: "snapback", priceUsd: 120 }),
      line({ id: "butterfly-grunge-tee-crisp-white-M", variantId: "butterfly-grunge-tee", colorway: "crisp-white", size: "M" }),
    ];
    expect(backfillTeeColorways(cart)).toEqual(cart);
  });

  it("defaults a missing size to L, as the old quick-add did", () => {
    const [out] = backfillTeeColorways([line({ id: "eight-ball-tee", variantId: "eight-ball-tee" })]);
    expect(out.id).toBe("eight-ball-tee-crisp-white-L");
  });
});

describe("migratePersisted", () => {
  it("drops the saved Try-On Photo and fit settings from v1 state", () => {
    const out = migratePersisted({ cart: [], theme: "dark", tryOnImage: "data:image/jpeg;base64,xx", tryOnSettings: { scale: 1 } }, 1);
    expect(out).toEqual({ cart: [], theme: "dark" });
  });

  it("still backfills tee colorways from v0", () => {
    const out = migratePersisted({ cart: [] }, 0);
    expect(out.cart).toEqual([]);
  });
});
