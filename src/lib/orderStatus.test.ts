import { describe, expect, it } from "vitest";
import type { FulfillmentStatus, PaymentStatus } from "@convex/orders/status";
import { DESK_FILTERS } from "../../convex/orders/deskFilters";
import {
  ADMIN_DESK_TABS,
  adminStatusSummary,
  awaitsPacking,
  customerBadges,
  isAddressEditable,
  isCancellableOrder,
  isExpiredCheckout,
  isPaidOrder,
  isShippedOrder,
  trackingStep,
} from "./orderStatus";

const o = (paymentStatus: PaymentStatus, fulfillmentStatus: FulfillmentStatus, cancelledAt?: number) => ({
  paymentStatus,
  fulfillmentStatus,
  cancelledAt,
});

describe("customerBadges", () => {
  it("shows where the package is once paid", () => {
    expect(customerBadges(o("paid", "unfulfilled"))).toEqual(["paid"]);
    expect(customerBadges(o("paid", "in_transit"))).toEqual(["in_transit"]);
    expect(customerBadges(o("paid", "delivered"))).toEqual(["delivered"]);
  });

  it("a refund shows next to the package, not instead of it", () => {
    expect(customerBadges(o("partially_refunded", "delivered"))).toEqual(["partially_refunded", "delivered"]);
    expect(customerBadges(o("refunded", "unfulfilled"))).toEqual(["refunded"]);
  });

  it("a dispute is the Customer's own chargeback and shows as paid", () => {
    expect(customerBadges(o("disputed", "unfulfilled"))).toEqual(["paid"]);
  });

  it("cancelled orders show the marker and any refund, never the package", () => {
    expect(customerBadges(o("refunded", "unfulfilled", 1))).toEqual(["cancelled", "refunded"]);
    expect(customerBadges(o("awaiting_payment", "unfulfilled", 1))).toEqual(["cancelled"]);
  });

  it("an order awaiting payment is placed", () => {
    expect(customerBadges(o("awaiting_payment", "unfulfilled"))).toEqual(["placed"]);
  });
});

describe("trackingStep", () => {
  it("walks placed, paid, shipped, delivered", () => {
    expect(trackingStep(o("awaiting_payment", "unfulfilled"))).toBe(1);
    expect(trackingStep(o("paid", "unfulfilled"))).toBe(2);
    expect(trackingStep(o("paid", "label_purchased"))).toBe(3);
    expect(trackingStep(o("paid", "delivery_exception"))).toBe(3);
    expect(trackingStep(o("partially_refunded", "delivered"))).toBe(4);
  });

  it("a refunded order that shipped keeps its timeline; one that never shipped has none", () => {
    expect(trackingStep(o("refunded", "delivered"))).toBe(4);
    expect(trackingStep(o("refunded", "unfulfilled"))).toBeNull();
    expect(trackingStep(o("paid", "in_transit", 1))).toBeNull();
  });
});

describe("admin predicates", () => {
  it("the packing queue is paid or partially refunded, unfulfilled, not cancelled", () => {
    expect(awaitsPacking(o("paid", "unfulfilled"))).toBe(true);
    expect(awaitsPacking(o("partially_refunded", "unfulfilled"))).toBe(true);
    expect(awaitsPacking(o("disputed", "unfulfilled"))).toBe(false);
    expect(awaitsPacking(o("paid", "label_purchased"))).toBe(false);
    expect(awaitsPacking(o("paid", "unfulfilled", 1))).toBe(false);
  });

  it("shipped means a label exists and the package is still out", () => {
    expect(isShippedOrder(o("refunded", "in_transit"))).toBe(true);
    expect(isShippedOrder(o("paid", "delivered"))).toBe(false);
  });

  it("paid means money was received, even if refunded since", () => {
    expect(isPaidOrder(o("refunded", "unfulfilled"))).toBe(true);
    expect(isPaidOrder(o("awaiting_payment", "unfulfilled"))).toBe(false);
  });

  it("cancel and address edits stop once a label exists", () => {
    expect(isCancellableOrder(o("paid", "unfulfilled"))).toBe(true);
    expect(isCancellableOrder(o("paid", "label_purchased"))).toBe(false);
    expect(isAddressEditable(o("paid", "unfulfilled", 1))).toBe(false);
  });

  it("summarizes both axes on one line", () => {
    expect(adminStatusSummary(o("partially_refunded", "delivered"))).toBe("Partially refunded · Delivered");
    expect(adminStatusSummary(o("refunded", "unfulfilled", 1))).toBe("Cancelled · Refunded");
    expect(adminStatusSummary(o("awaiting_payment", "unfulfilled", 1))).toBe("Checkout expired");
  });

  it("an Expired Checkout is cancelled with no money received", () => {
    expect(isExpiredCheckout(o("awaiting_payment", "unfulfilled", 1))).toBe(true);
    expect(isExpiredCheckout(o("awaiting_payment", "unfulfilled"))).toBe(false);
    expect(isExpiredCheckout(o("refunded", "unfulfilled", 1))).toBe(false);
  });

  it("offers exactly the desk filters the server understands", () => {
    expect(ADMIN_DESK_TABS.map((t) => t.id)).toEqual([...DESK_FILTERS]);
  });
});
