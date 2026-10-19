import { describe, expect, it } from "vitest";
import { cartVariantIds } from "./cartVariantIds";

describe("cartVariantIds", () => {
  it("lists each product once, preferring variantId over the line id, sorted", () => {
    expect(
      cartVariantIds([
        { id: "tee-1-black-M", variantId: "tee-1" },
        { id: "tee-1-white-L", variantId: "tee-1" },
        { id: "oro-negro" },
      ])
    ).toEqual(["oro-negro", "tee-1"]);
  });

  it("is empty for an empty cart", () => {
    expect(cartVariantIds([])).toEqual([]);
  });
});
