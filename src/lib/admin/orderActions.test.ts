import { describe, expect, it } from "vitest";
import { allowedManualMoves, manualTrackingMove, nextOrderAction } from "./orderActions";
import type { FulfillmentStatus, PaymentStatus } from "../../../convex/orders/status";
import type { ShippingLabel } from "../../../convex/orders/labels";

const NOW = Date.UTC(2026, 9, 17, 12);
const order = (
  paymentStatus: PaymentStatus,
  fulfillmentStatus: FulfillmentStatus,
  extra: { cancelledAt?: number; shippingAddress?: { line1: string }; checkoutHoldExpiresAt?: number; labels?: ShippingLabel[] } = {}
) => ({ paymentStatus, fulfillmentStatus, shippingAddress: { line1: "1 Main St" }, ...extra });

describe("nextOrderAction", () => {
  it("cancelled → none", () => {
    expect(nextOrderAction(order("paid", "unfulfilled", { cancelledAt: NOW }))).toEqual({ kind: "none" });
  });

  it("awaiting payment → await_payment with the hold expiry", () => {
    expect(nextOrderAction(order("awaiting_payment", "unfulfilled", { checkoutHoldExpiresAt: NOW }))).toEqual({ kind: "await_payment", holdExpiresAt: NOW });
  });

  it("paid unfulfilled → buy_label, flagging a missing address", () => {
    expect(nextOrderAction(order("paid", "unfulfilled"))).toEqual({ kind: "buy_label", addressMissing: false });
    expect(nextOrderAction(order("partially_refunded", "unfulfilled", { shippingAddress: undefined }))).toEqual({ kind: "buy_label", addressMissing: true });
  });

  it("disputed unfulfilled → none with the label reason", () => {
    const next = nextOrderAction(order("disputed", "unfulfilled"));
    expect(next.kind).toBe("none");
    expect(next.kind === "none" && next.reason).toMatch(/disputed/);
  });

  it("Ready to Ship with no Handoff → hand_off; handed off or in transit → mark_delivered", () => {
    const label: ShippingLabel = { carrier: "USPS", trackingNumber: "9400", labelUrl: "u", purchasedAt: NOW, reship: false };
    const handedOff = { ...label, handoff: { method: "picked_up" as const, at: NOW, recordedAt: NOW, actor: "a" } };
    expect(nextOrderAction(order("paid", "label_purchased", { labels: [label] }))).toEqual({ kind: "hand_off" });
    expect(nextOrderAction(order("paid", "label_purchased", { labels: [handedOff] }))).toEqual({ kind: "mark_delivered" });
    expect(nextOrderAction(order("paid", "in_transit"))).toEqual({ kind: "mark_delivered" });
  });

  it("a partial or Goodwill Refund still gets delivered; a fully refunded shipment does not", () => {
    expect(nextOrderAction(order("partially_refunded", "label_purchased"))).toEqual({ kind: "mark_delivered" });
    expect(nextOrderAction(order("refunded", "label_purchased"))).toEqual({ kind: "none" });
    expect(nextOrderAction(order("refunded", "in_transit"))).toEqual({ kind: "none" });
  });

  it("delivery exception or returned → resolve_exception, reship when a label is allowed", () => {
    expect(nextOrderAction(order("paid", "delivery_exception"))).toEqual({ kind: "resolve_exception", reship: true });
    expect(nextOrderAction(order("paid", "returned"))).toEqual({ kind: "resolve_exception", reship: true });
    expect(nextOrderAction(order("refunded", "returned"))).toEqual({ kind: "resolve_exception", reship: false });
  });

  it("delivered or refunded unfulfilled → none", () => {
    expect(nextOrderAction(order("paid", "delivered"))).toEqual({ kind: "none" });
    expect(nextOrderAction(order("refunded", "unfulfilled"))).toEqual({ kind: "none", reason: expect.stringMatching(/refunded/) });
  });
});

describe("allowedManualMoves", () => {
  it("delivers from shipped states, reverts from delivered, nothing when unpaid or cancelled", () => {
    expect(allowedManualMoves(order("paid", "label_purchased"))).toEqual(["mark_delivered"]);
    expect(allowedManualMoves(order("paid", "in_transit"))).toEqual(["mark_delivered"]);
    expect(allowedManualMoves(order("paid", "delivery_exception"))).toEqual(["mark_delivered"]);
    expect(allowedManualMoves(order("paid", "delivered"))).toEqual(["revert"]);
    expect(allowedManualMoves(order("paid", "unfulfilled"))).toEqual([]);
    expect(allowedManualMoves(order("awaiting_payment", "unfulfilled"))).toEqual([]);
    expect(allowedManualMoves(order("paid", "in_transit", { cancelledAt: NOW }))).toEqual([]);
  });

  it("offers nothing on a fully refunded Order, and still delivers a partially refunded one", () => {
    expect(allowedManualMoves(order("refunded", "label_purchased"))).toEqual([]);
    expect(allowedManualMoves(order("refunded", "delivered"))).toEqual([]);
    expect(allowedManualMoves(order("partially_refunded", "in_transit"))).toEqual(["mark_delivered"]);
  });
});

describe("manualTrackingMove", () => {
  it("a hand-shipped unfulfilled order moves to in transit; later edits only correct the tracking", () => {
    expect(manualTrackingMove(order("paid", "unfulfilled"))).toBe("in_transit");
    expect(manualTrackingMove(order("partially_refunded", "unfulfilled"))).toBe("in_transit");
    expect(manualTrackingMove(order("paid", "in_transit"))).toBeNull();
    expect(manualTrackingMove(order("paid", "label_purchased"))).toBeNull();
    expect(manualTrackingMove(order("paid", "delivered"))).toBeNull();
  });
});
