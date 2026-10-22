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
  matchesOrderSearch,
  MAX_TRACKED_IDS,
  orderNumberCandidates,
  exactOrderSearchKeys,
  orderSessionIds,
  ownerTrackingView,
  withWebhookEventId,
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
    paymentStatus: "paid",
    fulfillmentStatus: "unfulfilled",
    paymentMethod: "stripe",
    paymentUrl: "https://checkout.stripe.com/pay/cs_live",
    adminNotes: "internal",
    createdAt: 1,
    ...overrides,
  } as Doc<"orders">;
}

describe("decideStripeSettlement", () => {
  it("replays an already-applied event before anything else", () => {
    const existing = order({ cancelledAt: 5, webhookEventIds: ["evt_1"] });
    expect(decideStripeSettlement(existing, { webhookEventId: "evt_1", stripeSessionId: "cs_1" })).toBe("replay");
  });

  it("treats a settled order paid again by its own session as a replay", () => {
    const existing = order({ fulfillmentStatus: "in_transit", stripeSessionId: "cs_1" });
    expect(decideStripeSettlement(existing, { webhookEventId: "evt_3", stripeSessionId: "cs_1" })).toBe("replay");
  });

  it("flags a settled order paid by a different session as double settlement", () => {
    expect(decideStripeSettlement(order({ stripeSessionId: "cs_1" }), { stripeSessionId: "cs_2" })).toBe(
      "double_settlement"
    );
    expect(decideStripeSettlement(order({ paymentStatus: "refunded", paymentMethod: "whatsapp" }), { stripeSessionId: "cs_2" })).toBe(
      "double_settlement"
    );
  });

  it("flags a payment on a cancelled order", () => {
    const cancelledUnpaid = order({ paymentStatus: "awaiting_payment", cancelledAt: 5 });
    expect(decideStripeSettlement(cancelledUnpaid, { webhookEventId: "evt_2", stripeSessionId: "cs_1" })).toBe(
      "cancelled"
    );
  });

  it("settles an order still awaiting payment", () => {
    expect(decideStripeSettlement(order({ paymentStatus: "awaiting_payment" }), { stripeSessionId: "cs_1" })).toBe("settle");
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

describe("appendNote", () => {
  it("appends on a new line, or starts the notes", () => {
    expect(appendNote(undefined, "first")).toBe("first");
    expect(appendNote("", "first")).toBe("first");
    expect(appendNote("old", "new")).toBe("old\nnew");
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

describe("exactOrderSearchKeys", () => {
  it("reads an email, else order-number candidates, plus tracking-number spellings", () => {
    expect(exactOrderSearchKeys(" Ana@Example.com ")).toEqual({ orderNumbers: [], email: "ana@example.com", trackingNumbers: [] });
    expect(exactOrderSearchKeys("#gl-abc-1")).toEqual({ orderNumbers: ["GL-ABC-1"], trackingNumbers: [] });
    expect(exactOrderSearchKeys("1z999aa10123456784")).toEqual({
      orderNumbers: ["1Z999AA10123456784", "GL-1Z999AA10123456784", "MC-1Z999AA10123456784"],
      trackingNumbers: ["1z999aa10123456784", "1Z999AA10123456784"],
    });
    expect(exactOrderSearchKeys("   ")).toEqual({ orderNumbers: [], trackingNumbers: [] });
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
