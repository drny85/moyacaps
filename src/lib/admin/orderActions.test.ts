import { describe, expect, it } from "vitest";
import { allowedManualMoves, nextOrderAction } from "./orderActions";
import type { FulfillmentStatus, PaymentStatus } from "../../../convex/orders/status";

const NOW = Date.UTC(2026, 9, 17, 12);
const order = (
  paymentStatus: PaymentStatus,
  fulfillmentStatus: FulfillmentStatus,
  extra: { cancelledAt?: number; shippingAddress?: { line1: string }; checkoutHoldExpiresAt?: number } = {}
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

  it("label purchased or in transit → mark_delivered", () => {
    expect(nextOrderAction(order("paid", "label_purchased"))).toEqual({ kind: "mark_delivered" });
    expect(nextOrderAction(order("paid", "in_transit"))).toEqual({ kind: "mark_delivered" });
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
});
