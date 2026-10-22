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

  it("releases the open checkout when this tab comes back from Stripe (Back, a reload)", () => {
    expect(checkoutToReleaseOnLoad(open, "/en/products/good-luck-black", "cs_A")).toEqual(open);
    expect(checkoutToReleaseOnLoad(open, "/es", "cs_A")).toEqual(open);
  });

  it("never from another tab: the shopper may still be paying in the tab that went to Stripe", () => {
    expect(checkoutToReleaseOnLoad(open, "/en", null)).toBeNull();
    expect(checkoutToReleaseOnLoad(open, "/en", "cs_OLD")).toBeNull();
  });

  it("never on the success page, where the checkout was just paid", () => {
    expect(checkoutToReleaseOnLoad(open, "/en/checkout/success", "cs_A")).toBeNull();
    expect(checkoutToReleaseOnLoad(open, "/checkout/success", "cs_A")).toBeNull();
  });

  it("has nothing to release without an open checkout", () => {
    expect(checkoutToReleaseOnLoad(null, "/en", "cs_A")).toBeNull();
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
