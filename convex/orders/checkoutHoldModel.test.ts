import { describe, expect, it } from "vitest";
import {
  BACKSTOP_GRACE_MS,
  backstopHoldExpiryCutoff,
  canReleaseCheckoutHold,
  CHECKOUT_SESSION_MS,
  checkoutHoldExpiresAt,
  decideHoldRelease,
  holdDemand,
  isBackstopDue,
  isCheckoutHoldActive,
  isUnpaidCheckout,
  orderHoldsStock,
  planCheckoutHold,
  settlementStockAction,
  stockKey,
  stripeSessionExpiresAt,
  toCheckoutSessionState,
  type HoldLine,
} from "./model";
import { planCancellation } from "./status";

const PAY_AT = 1_700_000_000_000;
const awaiting = { paymentStatus: "awaiting_payment" as const, fulfillmentStatus: "unfulfilled" as const };
const paid = { paymentStatus: "paid" as const, fulfillmentStatus: "unfulfilled" as const };
const hold = { ...awaiting, checkoutHoldExpiresAt: checkoutHoldExpiresAt(PAY_AT) };

describe("Checkout Hold timing", () => {
  it("lasts the 30-minute session plus Stripe's creation margin", () => {
    const expiresAt = checkoutHoldExpiresAt(PAY_AT);
    expect(expiresAt - PAY_AT).toBeGreaterThan(CHECKOUT_SESSION_MS);
    expect(expiresAt - PAY_AT).toBeLessThanOrEqual(CHECKOUT_SESSION_MS + 2 * 60 * 1000);
  });

  it("gives Stripe its expires_at in whole seconds", () => {
    expect(stripeSessionExpiresAt(1_700_000_001_999)).toBe(1_700_000_001);
  });

  it("the backstop is due 5 minutes after the hold ends, not before", () => {
    const dueAt = hold.checkoutHoldExpiresAt + BACKSTOP_GRACE_MS;
    expect(isBackstopDue(hold, dueAt - 1)).toBe(false);
    expect(isBackstopDue(hold, dueAt)).toBe(true);
    expect(hold.checkoutHoldExpiresAt <= backstopHoldExpiryCutoff(dueAt)).toBe(true);
  });

  it("the backstop ignores orders without a live hold", () => {
    const later = PAY_AT + 10 * CHECKOUT_SESSION_MS;
    expect(isBackstopDue(awaiting, later)).toBe(false);
    expect(isBackstopDue({ ...hold, paymentStatus: "paid" as const }, later)).toBe(false);
    expect(isBackstopDue({ ...hold, cancelledAt: PAY_AT }, later)).toBe(false);
  });
});

describe("Checkout Hold state", () => {
  it("is active only on an order awaiting payment that took its units at Pay", () => {
    expect(isCheckoutHoldActive(hold)).toBe(true);
    expect(isCheckoutHoldActive(awaiting)).toBe(false);
    expect(isCheckoutHoldActive({ ...hold, cancelledAt: PAY_AT })).toBe(false);
  });

  it("a live hold keeps units out of Available Inventory; a bare pending order does not", () => {
    expect(orderHoldsStock(hold)).toBe(true);
    expect(orderHoldsStock(awaiting)).toBe(false);
    expect(orderHoldsStock(paid)).toBe(true);
    expect(orderHoldsStock({ ...hold, cancelledAt: PAY_AT })).toBe(false);
  });

  it("settling a held order never deducts again; settling a bare pending order does", () => {
    expect(settlementStockAction(hold)).toBe("none");
    expect(settlementStockAction(awaiting)).toBe("deduct");
  });

  it("a release must name the hold's own session", () => {
    const withSession = { ...hold, stripeSessionId: "cs_a" };
    expect(canReleaseCheckoutHold(withSession, "cs_a")).toBe(true);
    expect(canReleaseCheckoutHold(withSession, "cs_other")).toBe(false);
    expect(canReleaseCheckoutHold({ ...withSession, paymentStatus: "paid" as const }, "cs_a")).toBe(false);
    // Session creation failed before a session was recorded.
    expect(canReleaseCheckoutHold(hold, undefined)).toBe(true);
  });

  it("customers never see unpaid checkouts in their history", () => {
    expect(isUnpaidCheckout(awaiting)).toBe(true);
    expect(isUnpaidCheckout({ ...awaiting, cancelledAt: PAY_AT, checkoutHoldReleasedAt: PAY_AT })).toBe(true);
    expect(isUnpaidCheckout({ ...paid, cancelledAt: PAY_AT })).toBe(false);
    expect(isUnpaidCheckout({ paymentStatus: "refunded", fulfillmentStatus: "unfulfilled" })).toBe(false);
    expect(isUnpaidCheckout(paid)).toBe(false);
  });
});

describe("decideHoldRelease", () => {
  it("narrows Stripe's session status, unknown when absent or new", () => {
    expect(toCheckoutSessionState("expired")).toBe("expired");
    expect(toCheckoutSessionState(null)).toBe("unknown");
    expect(toCheckoutSessionState("some_future_status")).toBe("unknown");
  });

  it("releases only once Stripe reports every session expired", () => {
    expect(decideHoldRelease(["expired"])).toBe("release");
    expect(decideHoldRelease(["open"])).toBe("retry");
    expect(decideHoldRelease(["unknown"])).toBe("retry");
    expect(decideHoldRelease(["expired", "unknown"])).toBe("retry");
  });

  it("never releases a hold whose session was paid", () => {
    expect(decideHoldRelease(["complete"])).toBe("paid");
    expect(decideHoldRelease(["expired", "complete"])).toBe("paid");
  });

  it("releases a hold whose session was never created", () => {
    expect(decideHoldRelease([])).toBe("release");
  });
});

describe("planCheckoutHold", () => {
  const cap: HoldLine = { variantId: "cap", name: "Cap", quantity: 2 };
  const teeM: HoldLine = { variantId: "tee", name: "Tee M", quantity: 1, colorway: "black", size: "M" };

  it("keys caps by variant and tees by SKU", () => {
    expect(stockKey(cap)).toBe("cap||");
    expect(stockKey(teeM)).toBe("tee|black|M");
  });

  it("checks two lines drawing on one SKU together", () => {
    expect(holdDemand([teeM, { ...teeM, name: "Tee M again" }])).toEqual([
      { key: "tee|black|M", line: teeM, quantity: 2 },
    ]);
    const available = new Map([["tee|black|M", 1]]);
    expect(planCheckoutHold([teeM, teeM], available)).toEqual({ ok: false, line: teeM, available: 1 });
  });

  it("holds when every pool covers its demand", () => {
    const available = new Map([
      ["cap||", 2],
      ["tee|black|M", 5],
    ]);
    expect(planCheckoutHold([cap, teeM], available)).toEqual({ ok: true });
  });

  it("fails the whole hold on the first short pool instead of clamping", () => {
    const available = new Map([
      ["cap||", 1],
      ["tee|black|M", 5],
    ]);
    expect(planCheckoutHold([cap, teeM], available)).toEqual({ ok: false, line: cap, available: 1 });
    expect(planCheckoutHold([teeM], new Map())).toEqual({ ok: false, line: teeM, available: 0 });
  });
});

describe("cancelling a Checkout Hold", () => {
  it("releases its units", () => {
    expect(planCancellation(hold, "administrator", orderHoldsStock(hold))).toEqual({ ok: true, releaseStock: true });
  });

  it("a released hold has nothing left to give back", () => {
    const released = { ...hold, cancelledAt: PAY_AT, checkoutHoldReleasedAt: PAY_AT };
    expect(orderHoldsStock(released)).toBe(false);
    expect(planCancellation(released, "administrator", orderHoldsStock(released)).ok).toBe(false);
  });
});
