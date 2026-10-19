import { describe, expect, it } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import { DEFAULT_SHIPPING_SETTINGS } from "../settings/model";
import {
  appendBoundedId,
  appendNote,
  computeShipping,
  confirmationView,
  decideStripeSettlement,
  guestTrackingView,
  hasProcessedWebhookEvent,
  holdsStock,
  isPaidLike,
  matchesOrderSearch,
  MAX_TRACKED_IDS,
  newTrackingNumber,
  ORDER_STATUSES,
  orderNumberCandidates,
  orderSessionIds,
  ownerTrackingView,
  planAdminStatusChange,
  planRefund,
  withWebhookEventId,
  type OrderStatus,
} from "./model";

function order(overrides: Partial<Doc<"orders">> = {}): Doc<"orders"> {
  return {
    _id: "o1" as Id<"orders">,
    _creationTime: 0,
    orderNumber: "GL-ABC-1234",
    customerName: "Ana Maria Lopez",
    customerEmail: "ana@example.com",
    customerPhone: "5551234567",
    shippingAddress: { line1: "1 Main St", line2: "Apt 2", city: "New York", state: "NY", postalCode: "10001", country: "US" },
    items: [{ variantId: "negro-rojo", name: "Black / Red", quantity: 1, price: 120, image: "/a.png", colorway: "black" }],
    currency: "USD",
    total: 128,
    status: "paid",
    paymentMethod: "stripe",
    paymentUrl: "https://checkout.stripe.com/pay/cs_live",
    adminNotes: "internal",
    createdAt: 1,
    ...overrides,
  } as Doc<"orders">;
}

describe("status groups", () => {
  it("paid-like statuses are paid, dispatched and delivered", () => {
    expect(ORDER_STATUSES.filter(isPaidLike)).toEqual(["paid", "dispatched", "delivered"]);
  });

  it("stock is held by paid-like orders and WhatsApp reservations only", () => {
    expect(ORDER_STATUSES.filter(holdsStock)).toEqual(["paid", "dispatched", "delivered", "whatsapp_initiated"]);
  });
});

describe("planAdminStatusChange", () => {
  it("never regresses a settled order into pending or a reservation", () => {
    for (const previous of ["paid", "dispatched", "delivered"] as OrderStatus[]) {
      for (const next of ["pending", "whatsapp_initiated"] as OrderStatus[]) {
        const plan = planAdminStatusChange(previous, next);
        expect(plan).toEqual({ ok: false, error: `Invalid transition: cannot move a ${previous} order back to ${next}.` });
      }
    }
  });

  it("refuses to settle a WhatsApp reservation outside the payment flows", () => {
    for (const next of ["paid", "dispatched", "delivered"] as OrderStatus[]) {
      expect(planAdminStatusChange("whatsapp_initiated", next).ok).toBe(false);
    }
  });

  it("deducts stock when an order that held none becomes paid-like", () => {
    expect(planAdminStatusChange("pending", "paid")).toEqual({ ok: true, stock: "deduct", lockCarrierUpdates: false });
    expect(planAdminStatusChange("cancelled", "dispatched")).toMatchObject({ ok: true, stock: "deduct" });
  });

  it("releases stock when cancelling an order that held it", () => {
    for (const previous of ["paid", "dispatched", "delivered", "whatsapp_initiated"] as OrderStatus[]) {
      expect(planAdminStatusChange(previous, "cancelled")).toMatchObject({ ok: true, stock: "release" });
    }
    expect(planAdminStatusChange("pending", "cancelled")).toMatchObject({ ok: true, stock: "none" });
  });

  it("moves between settled states without touching stock", () => {
    expect(planAdminStatusChange("paid", "dispatched")).toEqual({ ok: true, stock: "none", lockCarrierUpdates: false });
  });

  it("locks carrier webhooks when an Administrator moves an order off delivered", () => {
    expect(planAdminStatusChange("delivered", "dispatched")).toMatchObject({ ok: true, lockCarrierUpdates: true });
    expect(planAdminStatusChange("delivered", "delivered")).toMatchObject({ ok: true, lockCarrierUpdates: false });
  });
});

describe("decideStripeSettlement", () => {
  it("replays an already-applied event before anything else", () => {
    const existing = order({ status: "cancelled", webhookEventIds: ["evt_1"] });
    expect(decideStripeSettlement(existing, { webhookEventId: "evt_1", stripeSessionId: "cs_1" })).toBe("replay");
  });

  it("treats a settled order paid again by its own session as a replay", () => {
    const existing = order({ status: "dispatched", stripeSessionId: "cs_1" });
    expect(decideStripeSettlement(existing, { webhookEventId: "evt_3", stripeSessionId: "cs_1" })).toBe("replay");
  });

  it("flags a settled order paid by a different session as double settlement", () => {
    expect(decideStripeSettlement(order({ status: "paid", stripeSessionId: "cs_1" }), { stripeSessionId: "cs_2" })).toBe(
      "double_settlement"
    );
    expect(decideStripeSettlement(order({ status: "paid", paymentMethod: "whatsapp" }), { stripeSessionId: "cs_2" })).toBe(
      "double_settlement"
    );
  });

  it("flags a payment on a cancelled order", () => {
    expect(decideStripeSettlement(order({ status: "cancelled" }), { webhookEventId: "evt_2", stripeSessionId: "cs_1" })).toBe(
      "cancelled"
    );
  });

  it("settles an order still awaiting payment", () => {
    expect(decideStripeSettlement(order({ status: "pending" }), { stripeSessionId: "cs_1" })).toBe("settle");
  });
});

describe("planRefund", () => {
  it("full and partial refunds set their status", () => {
    expect(planRefund(undefined, 128, true)).toEqual({ status: "refunded", refundedAmount: 128 });
    expect(planRefund(undefined, 20, false)).toEqual({ status: "partially_refunded", refundedAmount: 20 });
  });

  it("the refunded total never goes down when events arrive out of order", () => {
    expect(planRefund(50, 20, false).refundedAmount).toBe(50);
  });
});

describe("bounded id histories", () => {
  it("appends once and keeps the most recent ids", () => {
    expect(appendBoundedId(undefined, "a")).toEqual(["a"]);
    expect(appendBoundedId(["a"], "a")).toEqual(["a"]);
    const many = Array.from({ length: MAX_TRACKED_IDS }, (_, i) => `id_${i}`);
    const next = appendBoundedId(many, "new");
    expect(next).toHaveLength(MAX_TRACKED_IDS);
    expect(next[0]).toBe("id_1");
    expect(next.at(-1)).toBe("new");
  });

  it("webhook replay guard", () => {
    expect(hasProcessedWebhookEvent({ webhookEventIds: ["evt_1"] }, "evt_1")).toBe(true);
    expect(hasProcessedWebhookEvent({ webhookEventIds: ["evt_1"] }, undefined)).toBe(false);
    expect(withWebhookEventId({ webhookEventIds: ["evt_1"] }, undefined)).toEqual(["evt_1"]);
    expect(withWebhookEventId({}, "evt_2")).toEqual(["evt_2"]);
  });

  it("orderSessionIds lists history then the current session, without duplicates", () => {
    expect(orderSessionIds({ stripeSessionIds: ["cs_1", "cs_2"], stripeSessionId: "cs_2" })).toEqual(["cs_1", "cs_2"]);
    expect(orderSessionIds({ stripeSessionId: "cs_3" })).toEqual(["cs_3"]);
    expect(orderSessionIds({})).toEqual([]);
  });
});

describe("appendNote and tracking numbers", () => {
  it("appends on a new line, or starts the notes", () => {
    expect(appendNote(undefined, "first")).toBe("first");
    expect(appendNote("", "first")).toBe("first");
    expect(appendNote("old", "new")).toBe("old\nnew");
  });

  it("tracking numbers are GL-TRK- plus six digits", () => {
    expect(newTrackingNumber()).toMatch(/^GL-TRK-\d{6}$/);
  });
});

describe("computeShipping", () => {
  it("one item pays the flat $8; two or more ship free", () => {
    expect(computeShipping(1, DEFAULT_SHIPPING_SETTINGS)).toEqual({ freeShipping: false, shippingFee: 8 });
    expect(computeShipping(2, DEFAULT_SHIPPING_SETTINGS)).toEqual({ freeShipping: true, shippingFee: 0 });
    expect(computeShipping(5, DEFAULT_SHIPPING_SETTINGS)).toEqual({ freeShipping: true, shippingFee: 0 });
  });

  it("follows the configured fee and threshold", () => {
    const settings = { flatShippingFeeUsd: 5, freeShippingThresholdUnits: 3 };
    expect(computeShipping(1, settings)).toEqual({ freeShipping: false, shippingFee: 5 });
    expect(computeShipping(2, settings)).toEqual({ freeShipping: false, shippingFee: 5 });
    expect(computeShipping(3, settings)).toEqual({ freeShipping: true, shippingFee: 0 });
  });
});

describe("orderNumberCandidates", () => {
  it("cleans input and adds GL- then legacy MC- prefixes", () => {
    expect(orderNumberCandidates("  #abc-123 ")).toEqual(["ABC-123", "GL-ABC-123", "MC-ABC-123"]);
  });

  it("keeps prefixed numbers as typed and rejects blank input", () => {
    expect(orderNumberCandidates("gl-wa-1")).toEqual(["GL-WA-1"]);
    expect(orderNumberCandidates("MC-9")).toEqual(["MC-9"]);
    expect(orderNumberCandidates(" # ")).toEqual([]);
  });
});

describe("matchesOrderSearch", () => {
  it("matches number, contact, tracking and line items case-insensitively", () => {
    const o = order({ trackingNumber: "GL-TRK-000111" });
    for (const q of ["abc-12", "ANA@", "maria", "555123", "trk-000", "black / red", "NEGRO"]) {
      expect(matchesOrderSearch(o, q)).toBe(true);
    }
    expect(matchesOrderSearch(o, "nothing")).toBe(false);
  });
});

describe("customer-facing projections", () => {
  it("confirmation via Stripe session shows address and phone, never payment link or notes", () => {
    const view = confirmationView(order(), true) as Record<string, unknown>;
    expect(view.shippingAddress).toBeDefined();
    expect(view.customerPhone).toBe("5551234567");
    expect(view.isGuestView).toBe(false);
    expect(view).not.toHaveProperty("paymentUrl");
    expect(view).not.toHaveProperty("adminNotes");
    expect(view).not.toHaveProperty("customerEmail");
  });

  it("confirmation via bare order number is minimal", () => {
    const view = confirmationView(order(), false);
    expect(view.customerName).toBe("Ana");
    expect(view.shippingAddress).toBeUndefined();
    expect(view.customerPhone).toBeUndefined();
    expect(view.isGuestView).toBe(true);
    expect(view.items[0]).not.toHaveProperty("colorway");
  });

  it("guest tracking redacts street, postal code, contact and payment link", () => {
    const view = guestTrackingView(order());
    expect(view.shippingAddress).toEqual({ line1: "***", line2: undefined, city: "New York", state: "NY", postalCode: "***", country: "US" });
    expect(view.customerName).toBe("Ana");
    expect(view.customerEmail).toBeUndefined();
    expect(view.paymentUrl).toBeUndefined();
    expect(view).not.toHaveProperty("adminNotes");
  });

  it("owner tracking shows contact and the payment link but not admin notes", () => {
    const view = ownerTrackingView(order());
    expect(view.customerEmail).toBe("ana@example.com");
    expect(view.paymentUrl).toBe("https://checkout.stripe.com/pay/cs_live");
    expect(view.isGuestView).toBe(false);
    expect(view).not.toHaveProperty("adminNotes");
  });
});
