import { describe, expect, it } from "vitest";
import { cartCheckoutLines, checkoutToReleaseOnLoad, isCanceledCheckoutReturn, openCheckoutAfterRelease } from "./openCheckout";

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

describe("checkoutToReleaseOnLoad", () => {
  const open = { orderNumber: "GL-1", sessionId: "cs_A" };

  it("releases the open checkout on any return to the store (a reload, or Back from Stripe)", () => {
    expect(checkoutToReleaseOnLoad(open, "/en/products/good-luck-black")).toEqual(open);
    expect(checkoutToReleaseOnLoad(open, "/es")).toEqual(open);
  });

  it("never on the success page, where the checkout was just paid", () => {
    expect(checkoutToReleaseOnLoad(open, "/en/checkout/success")).toBeNull();
    expect(checkoutToReleaseOnLoad(open, "/checkout/success")).toBeNull();
  });

  it("has nothing to release without an open checkout", () => {
    expect(checkoutToReleaseOnLoad(null, "/en")).toBeNull();
  });
});

describe("openCheckoutAfterRelease", () => {
  const released = { orderNumber: "GL-1", sessionId: "cs_A" };

  it("forgets the released checkout", () => {
    expect(openCheckoutAfterRelease(released, released)).toBeNull();
  });

  it("keeps a newer checkout started while the release was in flight", () => {
    const newer = { orderNumber: "GL-2", sessionId: "cs_B" };
    expect(openCheckoutAfterRelease(newer, released)).toEqual(newer);
    expect(openCheckoutAfterRelease(null, released)).toBeNull();
  });
});
