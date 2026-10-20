import { describe, expect, it } from "vitest";
import {
  awaitsFulfillment,
  canEditShippingAddress,
  countsAsSale,
  FULFILLMENT_STATUSES,
  fulfillmentAfterScan,
  legacyStatusAxes,
  PAYMENT_STATUSES,
  paymentStatusFromRefunds,
  customerCancellationAllowed,
  labelAction,
  planCancellation,
  planCustomerCancellation,
  planDispute,
  planLabelPurchase,
  planManualFulfillmentChange,
  planRefund,
  planSettlement,
  statusAxes,
  statusPatch,
  withStatusAxes,
  type FulfillmentStatus,
  type PaymentStatus,
  type StatusSource,
} from "./status";

const axes = (paymentStatus: PaymentStatus, fulfillmentStatus: FulfillmentStatus, extra: StatusSource = {}): StatusSource => ({
  paymentStatus,
  fulfillmentStatus,
  ...extra,
});

describe("statusAxes", () => {
  it("reads both stored axes and the cancelled marker", () => {
    expect(statusAxes(axes("paid", "in_transit", { cancelledAt: 7, cancellationReason: "administrator" }))).toEqual({
      paymentStatus: "paid",
      fulfillmentStatus: "in_transit",
      cancelledAt: 7,
      cancellationReason: "administrator",
    });
  });

  it("falls back to the backfill mapping for an Order not yet backfilled", () => {
    expect(statusAxes({ status: "dispatched" })).toEqual({ paymentStatus: "paid", fulfillmentStatus: "in_transit" });
    // One axis alone is not trusted: the legacy status decides both.
    expect(statusAxes({ paymentStatus: "paid", status: "pending" })).toEqual({
      paymentStatus: "awaiting_payment",
      fulfillmentStatus: "unfulfilled",
    });
  });
});

describe("statusPatch", () => {
  it("changing one axis writes the other unchanged", () => {
    expect(statusPatch(axes("paid", "delivered"), { paymentStatus: "partially_refunded" })).toEqual({
      paymentStatus: "partially_refunded",
      fulfillmentStatus: "delivered",
    });
  });

  it("carries a not-yet-backfilled Order's cancelled marker into its first write", () => {
    const legacy = { status: "cancelled" as const, refundedAmount: 0, stripeInvoiceId: "in_1", updatedAt: 42 };
    expect(statusPatch(legacy, { paymentStatus: "refunded" })).toEqual({
      paymentStatus: "refunded",
      fulfillmentStatus: "unfulfilled",
      cancelledAt: 42,
      cancellationReason: "legacy",
    });
  });

  it("withStatusAxes fills the axes onto the whole document", () => {
    expect(withStatusAxes({ status: "delivered" as const, total: 10 })).toMatchObject({
      total: 10,
      paymentStatus: "paid",
      fulfillmentStatus: "delivered",
    });
  });
});

describe("derived questions", () => {
  it("only paid or disputed, uncancelled Orders count as sales", () => {
    const sales = PAYMENT_STATUSES.filter((p) => countsAsSale(axes(p, "unfulfilled")));
    expect(sales).toEqual(["paid", "disputed"]);
    expect(countsAsSale(axes("paid", "delivered", { cancelledAt: 1 }))).toBe(false);
  });

  it("the packing queue is paid or partially refunded, unfulfilled and not cancelled", () => {
    expect(PAYMENT_STATUSES.filter((p) => awaitsFulfillment(axes(p, "unfulfilled")))).toEqual(["paid", "partially_refunded"]);
    expect(awaitsFulfillment(axes("paid", "label_purchased"))).toBe(false);
    expect(awaitsFulfillment(axes("paid", "unfulfilled", { cancelledAt: 1 }))).toBe(false);
  });

  it("the address can change until a label is bought", () => {
    expect(FULFILLMENT_STATUSES.filter((f) => canEditShippingAddress(axes("paid", f)))).toEqual(["unfulfilled"]);
    expect(canEditShippingAddress(axes("paid", "unfulfilled", { cancelledAt: 1 }))).toBe(false);
  });
});

describe("Payment axis", () => {
  it("derives Payment Status from the refunded amount, in cents", () => {
    expect(paymentStatusFromRefunds(undefined, 128)).toBe("paid");
    expect(paymentStatusFromRefunds(20, 128)).toBe("partially_refunded");
    expect(paymentStatusFromRefunds(128.004, 128)).toBe("refunded");
  });

  it("settles only an uncancelled Order awaiting payment", () => {
    expect(planSettlement(axes("awaiting_payment", "unfulfilled"))).toEqual({ ok: true, paymentStatus: "paid" });
    expect(planSettlement(axes("paid", "unfulfilled")).ok).toBe(false);
    expect(planSettlement(axes("awaiting_payment", "unfulfilled", { cancelledAt: 1 })).ok).toBe(false);
  });

  it("full and partial refunds set their Payment Status", () => {
    expect(planRefund(axes("paid", "delivered"), 128, true)).toEqual({ paymentStatus: "refunded", refundedAmount: 128 });
    expect(planRefund(axes("paid", "delivered"), 20, false)).toEqual({ paymentStatus: "partially_refunded", refundedAmount: 20 });
  });

  it("the refunded total never goes down when events arrive out of order", () => {
    expect(planRefund(axes("partially_refunded", "unfulfilled", { refundedAmount: 50 }), 20, false).refundedAmount).toBe(50);
  });

  it("an open dispute stays the Payment Status through a refund", () => {
    expect(planRefund(axes("disputed", "in_transit"), 20, false).paymentStatus).toBe("disputed");
  });

  it("a dispute opens as disputed and closes back to what the refunds say", () => {
    expect(planDispute(axes("paid", "delivered"), "opened")).toEqual({ paymentStatus: "disputed" });
    expect(planDispute(axes("disputed", "delivered", { total: 100 }), "closed")).toEqual({ paymentStatus: "paid" });
    expect(planDispute(axes("disputed", "delivered", { total: 100, refundedAmount: 30 }), "closed")).toEqual({
      paymentStatus: "partially_refunded",
    });
  });
});

describe("cancelled marker", () => {
  it("an Administrator may cancel at any stage; units go back only if the Order holds them and nothing shipped", () => {
    expect(planCancellation(axes("paid", "unfulfilled"), "administrator", true)).toEqual({ ok: true, releaseStock: true });
    expect(planCancellation(axes("refunded", "unfulfilled"), "administrator", false)).toEqual({ ok: true, releaseStock: false });
    // A shipped Order's units come back only through a Restock (an explicit Administrator choice).
    for (const f of FULFILLMENT_STATUSES.filter((f) => f !== "unfulfilled")) {
      expect(planCancellation(axes("paid", f), "administrator", true)).toEqual({ ok: true, releaseStock: false });
    }
  });

  it("a Customer may cancel only before anything ships", () => {
    expect(planCancellation(axes("paid", "unfulfilled"), "customer", true).ok).toBe(true);
    for (const f of FULFILLMENT_STATUSES.filter((f) => f !== "unfulfilled")) {
      expect(planCancellation(axes("paid", f), "customer", true).ok).toBe(false);
    }
  });

  it("an Order is cancelled once", () => {
    expect(planCancellation(axes("paid", "unfulfilled", { cancelledAt: 1 }), "administrator", true)).toEqual({
      ok: false,
      error: "Order is already cancelled",
    });
  });
});

describe("Customer Cancellation", () => {
  const owned = (paymentStatus: PaymentStatus, fulfillmentStatus: FulfillmentStatus, extra: StatusSource = {}) => ({
    ...axes(paymentStatus, fulfillmentStatus, extra),
    clerkUserId: "user_owner",
  });

  it("the signed-in owner cancels a paid, unfulfilled Order and its units go back", () => {
    expect(planCustomerCancellation(owned("paid", "unfulfilled"), "user_owner")).toEqual({ ok: true, releaseStock: true });
    expect(customerCancellationAllowed(owned("paid", "unfulfilled"))).toBe(true);
  });

  it("guests and other accounts are refused", () => {
    const guest = axes("paid", "unfulfilled");
    expect(planCustomerCancellation(guest, "user_owner")).toEqual({
      ok: false,
      error: "Guest orders are cancelled through support. Please contact us.",
    });
    expect(planCustomerCancellation(owned("paid", "unfulfilled"), "user_other").ok).toBe(false);
  });

  it("is refused once anything shipped, money moved back, a dispute opened, or it was cancelled", () => {
    const refused: StatusSource[] = [
      ...FULFILLMENT_STATUSES.filter((f) => f !== "unfulfilled").map((f) => owned("paid", f)),
      owned("partially_refunded", "unfulfilled"),
      owned("refunded", "unfulfilled"),
      owned("disputed", "unfulfilled"),
      owned("awaiting_payment", "unfulfilled"),
      owned("paid", "unfulfilled", { cancelledAt: 1 }),
    ];
    for (const order of refused) {
      expect(planCustomerCancellation({ ...order, clerkUserId: "user_owner" }, "user_owner").ok).toBe(false);
      expect(customerCancellationAllowed(order)).toBe(false);
    }
  });
});

describe("Fulfillment axis", () => {
  it("a label moves a paid or partially refunded, unfulfilled Order to label purchased", () => {
    const ok = { ok: true, fulfillmentStatus: "label_purchased", reship: false };
    expect(planLabelPurchase(axes("paid", "unfulfilled"))).toEqual(ok);
    expect(planLabelPurchase(axes("partially_refunded", "unfulfilled"))).toEqual(ok);
  });

  it("a label is refused for a cancelled, disputed, refunded or already shipped Order", () => {
    const refused = (order: StatusSource, pattern: RegExp) => {
      const plan = planLabelPurchase(order);
      expect(plan.ok).toBe(false);
      if (!plan.ok) expect(plan.error).toMatch(pattern);
    };
    refused(axes("paid", "unfulfilled", { cancelledAt: 1 }), /cancelled/);
    refused(axes("disputed", "unfulfilled"), /disputed/);
    refused(axes("refunded", "unfulfilled"), /fully refunded/);
    for (const f of ["label_purchased", "in_transit", "delivered"] as const) refused(axes("paid", f), /already bought/);
    refused(axes("paid", "delivery_exception"), /use Reship/);
    refused(axes("paid", "returned"), /use Reship/);
  });

  it("a Reship buys a new label only after a delivery exception or a return to sender", () => {
    const ok = { ok: true, fulfillmentStatus: "label_purchased", reship: true };
    expect(planLabelPurchase(axes("paid", "delivery_exception"), { reship: true })).toEqual(ok);
    expect(planLabelPurchase(axes("partially_refunded", "returned"), { reship: true })).toEqual(ok);
    for (const f of ["unfulfilled", "label_purchased", "in_transit", "delivered"] as const) {
      expect(planLabelPurchase(axes("paid", f), { reship: true }).ok).toBe(false);
    }
    // The payment and cancellation gates hold for a Reship too.
    expect(planLabelPurchase(axes("disputed", "returned"), { reship: true }).ok).toBe(false);
    expect(planLabelPurchase(axes("paid", "returned", { cancelledAt: 1 }), { reship: true }).ok).toBe(false);
  });

  it("the label button offers a first label, a Reship, or nothing with the reason", () => {
    expect(labelAction(axes("paid", "unfulfilled"))).toEqual({ action: "buy" });
    expect(labelAction(axes("paid", "delivery_exception"))).toEqual({ action: "reship" });
    expect(labelAction(axes("disputed", "unfulfilled"))).toEqual({
      action: null,
      reason: "Payment is disputed: labels are blocked until the dispute closes.",
    });
    expect(labelAction(axes("paid", "in_transit")).action).toBeNull();
  });

  it("nothing moves on the Fulfillment axis before the Order is paid", () => {
    const unpaid = axes("awaiting_payment", "unfulfilled");
    expect(planLabelPurchase(unpaid).ok).toBe(false);
    expect(planManualFulfillmentChange(unpaid, "in_transit").ok).toBe(false);
    expect(fulfillmentAfterScan(unpaid, "DELIVERED", false)).toBeUndefined();
  });

  it("carrier scans move only from the states they make sense in", () => {
    const table: Array<[FulfillmentStatus, string, FulfillmentStatus | undefined]> = [
      ["label_purchased", "PRE_TRANSIT", undefined],
      ["label_purchased", "TRANSIT", "in_transit"],
      ["delivery_exception", "TRANSIT", "in_transit"],
      ["delivered", "TRANSIT", undefined],
      ["in_transit", "DELIVERED", "delivered"],
      ["label_purchased", "DELIVERED", "delivered"],
      ["unfulfilled", "DELIVERED", undefined],
      ["returned", "DELIVERED", undefined],
      ["in_transit", "FAILURE", "delivery_exception"],
      ["delivered", "FAILURE", undefined],
      ["delivery_exception", "RETURNED", "returned"],
      ["in_transit", "UNKNOWN", undefined],
    ];
    for (const [from, scan, to] of table) {
      expect([from, scan, fulfillmentAfterScan(axes("paid", from), scan, false)]).toEqual([from, scan, to]);
    }
  });

  it("a manual override locks out every carrier move", () => {
    expect(fulfillmentAfterScan(axes("paid", "in_transit"), "DELIVERED", true)).toBeUndefined();
    expect(fulfillmentAfterScan(axes("paid", "in_transit"), "FAILURE", true)).toBeUndefined();
  });

  it("a manual change into or out of delivered locks carrier overwrites", () => {
    expect(planManualFulfillmentChange(axes("paid", "in_transit"), "delivered")).toEqual({
      ok: true,
      fulfillmentStatus: "delivered",
      lockCarrierUpdates: true,
    });
    expect(planManualFulfillmentChange(axes("paid", "delivered"), "in_transit")).toMatchObject({ ok: true, lockCarrierUpdates: true });
    expect(planManualFulfillmentChange(axes("paid", "unfulfilled"), "in_transit")).toMatchObject({ ok: true, lockCarrierUpdates: false });
    expect(planManualFulfillmentChange(axes("paid", "in_transit"), "in_transit").ok).toBe(false);
  });
});

describe("the axes stay independent", () => {
  it("money events never name a Fulfillment Status, package events never a Payment Status", () => {
    const delivered = axes("paid", "delivered");
    expect(Object.keys(planRefund(delivered, 10, false))).not.toContain("fulfillmentStatus");
    expect(Object.keys(planDispute(delivered, "opened"))).not.toContain("fulfillmentStatus");
    const label = planLabelPurchase(axes("partially_refunded", "unfulfilled"));
    expect(Object.keys(label)).not.toContain("paymentStatus");
  });

  it("a delivered Order that gets partially refunded stays delivered", () => {
    const delivered = axes("paid", "delivered");
    expect(statusPatch(delivered, { paymentStatus: planRefund(delivered, 10, false).paymentStatus })).toEqual({
      paymentStatus: "partially_refunded",
      fulfillmentStatus: "delivered",
    });
  });
});

describe("legacyStatusAxes (backfill mapping)", () => {
  it("maps each legacy status", () => {
    expect(legacyStatusAxes({ status: "pending" })).toEqual({ paymentStatus: "awaiting_payment", fulfillmentStatus: "unfulfilled" });
    expect(legacyStatusAxes({ status: "paid" })).toEqual({ paymentStatus: "paid", fulfillmentStatus: "unfulfilled" });
    expect(legacyStatusAxes({ status: "paid", shippingLabelUrl: "https://l" })).toEqual({
      paymentStatus: "paid",
      fulfillmentStatus: "label_purchased",
    });
    expect(legacyStatusAxes({ status: "dispatched" })).toEqual({ paymentStatus: "paid", fulfillmentStatus: "in_transit" });
    expect(legacyStatusAxes({ status: "delivered" })).toEqual({ paymentStatus: "paid", fulfillmentStatus: "delivered" });
  });

  it("refunded orders keep their Payment Status and infer fulfillment from delivery, label or carrier tracking", () => {
    expect(legacyStatusAxes({ status: "refunded", trackingDeliveredAt: 5, shippingLabelUrl: "x" })).toEqual({
      paymentStatus: "refunded",
      fulfillmentStatus: "delivered",
    });
    expect(legacyStatusAxes({ status: "partially_refunded", shippingLabelUrl: "x" }).fulfillmentStatus).toBe("in_transit");
    expect(legacyStatusAxes({ status: "refunded", trackingNumber: "9400111899" }).fulfillmentStatus).toBe("in_transit");
    // The placeholder number settlement used to mint is not a shipment.
    expect(legacyStatusAxes({ status: "refunded", trackingNumber: "GL-TRK-123456" }).fulfillmentStatus).toBe("unfulfilled");
  });

  it("cancelled orders get the marker (at updatedAt) and keep their payment state", () => {
    expect(legacyStatusAxes({ status: "cancelled", updatedAt: 9, createdAt: 1 })).toEqual({
      paymentStatus: "awaiting_payment",
      fulfillmentStatus: "unfulfilled",
      cancelledAt: 9,
      cancellationReason: "legacy",
    });
    expect(legacyStatusAxes({ status: "cancelled", createdAt: 1, checkoutHoldReleasedAt: 3 })).toMatchObject({
      paymentStatus: "awaiting_payment",
      cancelledAt: 1,
      cancellationReason: "checkout_expired",
    });
    expect(legacyStatusAxes({ status: "cancelled", updatedAt: 9 }, { settled: true }).paymentStatus).toBe("paid");
    expect(legacyStatusAxes({ status: "cancelled", updatedAt: 9, stripeInvoiceId: "in_1" }).paymentStatus).toBe("paid");
    expect(legacyStatusAxes({ status: "cancelled", updatedAt: 9, stripeInvoiceId: "in_1" }, { settled: false }).paymentStatus).toBe(
      "awaiting_payment"
    );
    expect(legacyStatusAxes({ status: "cancelled", updatedAt: 9, refundedAmount: 50, total: 50 }).paymentStatus).toBe("refunded");
  });

  it("a refund that overwrote a cancellation gets its marker back from the audit log", () => {
    expect(legacyStatusAxes({ status: "refunded" }, { cancelledAt: 4 })).toEqual({
      paymentStatus: "refunded",
      fulfillmentStatus: "unfulfilled",
      cancelledAt: 4,
      cancellationReason: "legacy",
    });
  });

  it("a WhatsApp reservation is cancelled", () => {
    expect(legacyStatusAxes({ status: "whatsapp_initiated", updatedAt: 6 })).toEqual({
      paymentStatus: "awaiting_payment",
      fulfillmentStatus: "unfulfilled",
      cancelledAt: 6,
      cancellationReason: "whatsapp_retired",
    });
  });

  it("an open dispute wins the Payment Status of a settled order", () => {
    expect(legacyStatusAxes({ status: "delivered", disputed: true })).toEqual({ paymentStatus: "disputed", fulfillmentStatus: "delivered" });
    expect(legacyStatusAxes({ status: "pending", disputed: true }).paymentStatus).toBe("awaiting_payment");
  });
});
