import { describe, expect, it } from "vitest";
import { cartCheckoutLines, isCanceledCheckoutReturn } from "./openCheckout";

describe("cartCheckoutLines", () => {
  it("sends each line's product, quantity and tee options, omitting empty ones", () => {
    expect(
      cartCheckoutLines([
        { id: "tee-1-black-M", variantId: "tee-1", quantity: 2, size: "M", colorway: "black" },
        { id: "oro-negro", quantity: 1 },
      ])
    ).toEqual([
      { variantId: "tee-1", quantity: 2, size: "M", colorway: "black" },
      { variantId: "oro-negro", quantity: 1 },
    ]);
  });
});

describe("isCanceledCheckoutReturn", () => {
  it("recognises Stripe's back link and nothing else", () => {
    expect(isCanceledCheckoutReturn(new URLSearchParams("canceled=1"))).toBe(true);
    expect(isCanceledCheckoutReturn(new URLSearchParams("canceled=true"))).toBe(true);
    expect(isCanceledCheckoutReturn(new URLSearchParams(""))).toBe(false);
    expect(isCanceledCheckoutReturn(new URLSearchParams("canceled=0"))).toBe(false);
  });
});
