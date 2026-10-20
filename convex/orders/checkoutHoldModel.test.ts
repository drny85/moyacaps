import { describe, expect, it } from "vitest";
import {
  BACKSTOP_AFTER_MS,
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
  planAdminStatusChange,
  planCheckoutHold,
  settlementStockAction,
  stockKey,
  stripeSessionExpiresAt,
  toCheckoutSessionState,
  type HoldLine,
} from "./model";

const PAY_AT = 1_700_000_000_000;
const hold = { status: "pending" as const, checkoutHoldExpiresAt: checkoutHoldExpiresAt(PAY_AT) };

describe("Checkout Hold timing", () => {
  it("lasts the 30-minute session plus Stripe's creation margin", () => {
    const expiresAt = checkoutHoldExpiresAt(PAY_AT);
    expect(expiresAt - PAY_AT).toBeGreaterThan(CHECKOUT_SESSION_MS);
    expect(expiresAt - PAY_AT).toBeLessThanOrEqual(CHECKOUT_SESSION_MS + 2 * 60 * 1000);
  });

  it("gives Stripe its expires_at in whole seconds", () => {
    expect(stripeSessionExpiresAt(1_700_000_001_999)).toBe(1_700_000_001);
  });

  it("the backstop is due 45 minutes after Pay, not before", () => {
    expect(isBackstopDue(hold, PAY_AT + BACKSTOP_AFTER_MS - 1)).toBe(false);
    expect(isBackstopDue(hold, PAY_AT + BACKSTOP_AFTER_MS)).toBe(true);
    expect(hold.checkoutHoldExpiresAt <= backstopHoldExpiryCutoff(PAY_AT + BACKSTOP_AFTER_MS)).toBe(true);
  });

  it("the backstop ignores orders without a live hold", () => {
    const later = PAY_AT + 10 * BACKSTOP_AFTER_MS;
    expect(isBackstopDue({ status: "pending" }, later)).toBe(false);
    expect(isBackstopDue({ ...hold, status: "paid" }, later)).toBe(false);
    expect(isBackstopDue({ ...hold, status: "cancelled" }, later)).toBe(false);
  });
});

describe("Checkout Hold state", () => {
  it("is active only on a pending order that took its units at Pay", () => {
    expect(isCheckoutHoldActive(hold)).toBe(true);
    expect(isCheckoutHoldActive({ status: "pending" })).toBe(false);
    expect(isCheckoutHoldActive({ ...hold, status: "cancelled" })).toBe(false);
  });

  it("a live hold keeps units out of Available Inventory; a bare pending order does not", () => {
    expect(orderHoldsStock(hold)).toBe(true);
    expect(orderHoldsStock({ status: "pending" })).toBe(false);
    expect(orderHoldsStock({ status: "paid" })).toBe(true);
    expect(orderHoldsStock({ ...hold, status: "cancelled" })).toBe(false);
  });

  it("settling a held order never deducts again; settling a bare pending order does", () => {
    expect(settlementStockAction(hold)).toBe("none");
    expect(settlementStockAction({ status: "pending" })).toBe("deduct");
  });

  it("a release must name the hold's own session", () => {
    const withSession = { ...hold, stripeSessionId: "cs_a" };
    expect(canReleaseCheckoutHold(withSession, "cs_a")).toBe(true);
    expect(canReleaseCheckoutHold(withSession, "cs_other")).toBe(false);
    expect(canReleaseCheckoutHold({ ...withSession, status: "paid" }, "cs_a")).toBe(false);
    // Session creation failed before a session was recorded.
    expect(canReleaseCheckoutHold(hold, undefined)).toBe(true);
  });

  it("customers never see unpaid checkouts in their history", () => {
    expect(isUnpaidCheckout({ status: "pending" })).toBe(true);
    expect(isUnpaidCheckout({ status: "cancelled", checkoutHoldReleasedAt: PAY_AT })).toBe(true);
    expect(isUnpaidCheckout({ status: "cancelled" })).toBe(false);
    expect(isUnpaidCheckout({ status: "paid" })).toBe(false);
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

describe("planAdminStatusChange with a Checkout Hold", () => {
  it("marking a held order paid does not deduct again", () => {
    expect(planAdminStatusChange("pending", "paid", true)).toMatchObject({ ok: true, stock: "none" });
  });

  it("cancelling a held order releases its units", () => {
    expect(planAdminStatusChange("pending", "cancelled", true)).toMatchObject({ ok: true, stock: "release" });
  });
});
