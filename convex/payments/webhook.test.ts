/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import aggregateTest from "@convex-dev/aggregate/test";
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";
import { encodeItemsMetadata } from "./checkoutMetadata";

const modules = import.meta.glob("/convex/**/*.ts");
// orderStats: every order write updates the dashboard aggregate (analytics/orderStats.ts).
function t() {
  const tt = convexTest(schema, modules);
  aggregateTest.register(tt, "orderStats");
  return tt;
}
type T = ReturnType<typeof t>;

// Events are signed with a test secret, so the action runs the real verification path.
// The Stripe client is built from the key but makes no call for a fully expanded session.
const WEBHOOK_SECRET = "whsec_test_suite";
const savedEnv = { key: process.env.STRIPE_SECRET_KEY, secret: process.env.STRIPE_WEBHOOK_SECRET };
beforeEach(() => {
  process.env.STRIPE_SECRET_KEY = "sk_test_webhook_suite";
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
});
afterEach(() => {
  process.env.STRIPE_SECRET_KEY = savedEnv.key;
  if (savedEnv.secret !== undefined) process.env.STRIPE_WEBHOOK_SECRET = savedEnv.secret;
  else delete process.env.STRIPE_WEBHOOK_SECRET;
});

async function seedHeldOrder(tt: T, orderNumber: string, sessionId: string) {
  await tt.run(async (ctx) => {
    await ctx.db.insert("variants", {
      variantId: "V1",
      isAvailable: true,
      nameEn: "Cap V1",
      nameEs: "Gorra V1",
      category: "headwear",
      taxCode: "txcd_30060006",
      silhouette: "snapback",
      primaryHex: "#000000",
      secondaryHex: "#ffffff",
      image: "/img.png",
      stock: 5,
      priceUsd: 100,
      isFeatured: false,
    });
  });
  const orderId = await tt.mutation(internal.orders.checkoutHold.placeCheckoutHold, {
    orderNumber,
    items: [{ variantId: "V1", name: "Cap V1", quantity: 1, price: 100, image: "/img.png" }],
    currency: "USD",
    subtotal: 100,
    shippingFee: 0,
    total: 100,
    customerEmail: "buyer@test.com",
    checkoutHoldExpiresAt: Date.now() + 31 * 60 * 1000,
    locale: "en",
  });
  await tt.mutation(internal.orders.checkoutHold.attachCheckoutSession, { orderId, stripeSessionId: sessionId });
  return orderId;
}

function completedEvent(eventId: string, sessionId: string, orderNumber: string, address: Record<string, string>) {
  return JSON.stringify({
    id: eventId,
    type: "checkout.session.completed",
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        payment_status: "paid",
        currency: "usd",
        amount_total: 10850,
        client_reference_id: orderNumber,
        customer: "cus_test",
        customer_details: { email: "buyer@test.com", name: "Test Buyer", phone: null, address },
        shipping_details: { name: "Test Buyer", address: { line1: "1 Main St", line2: null, city: "Town", ...address } },
        total_details: { amount_tax: 850, breakdown: { taxes: [] } },
        invoice: { id: "in_test", invoice_pdf: null, hosted_invoice_url: null },
        metadata: {
          orderNumber,
          subtotal: "100",
          shippingFee: "0",
          ...encodeItemsMetadata([{ variantId: "V1", quantity: 1, price: 100 }]),
        },
      },
    },
  });
}

async function deliver(tt: T, payload: string) {
  const signature = await new Stripe("sk_test_signer").webhooks.generateTestHeaderStringAsync({ payload, secret: WEBHOOK_SECRET });
  return await tt.action(internal.payments.webhook.fulfillStripeWebhook, { payload, signature });
}

async function state(tt: T, orderId: string) {
  return await tt.run(async (ctx) => {
    const order = await ctx.db.get(orderId as never);
    const events = await ctx.db
      .query("payment_events")
      .withIndex("by_order", (q) => q.eq("orderId", orderId as never))
      .collect();
    const scheduled = await ctx.db.system.query("_scheduled_functions").collect();
    return { order: order as any, events, scheduled: scheduled.map((f) => f.name) };
  });
}

describe("Stripe webhook: Fulfillment Territory flag (plan 0008 PR 4)", () => {
  it("settles an out-of-territory order, then flags it for refund without refunding", async () => {
    const tt = t();
    const orderId = await seedHeldOrder(tt, "GL-PR-1", "cs_pr1");

    await deliver(tt, completedEvent("evt_pr1", "cs_pr1", "GL-PR-1", { state: "PR", postal_code: "00901", country: "US" }));

    const { order, events, scheduled } = await state(tt, orderId);
    expect(order.paymentStatus).toBe("paid");
    expect(order.refundedAmount).toBeUndefined();
    expect(order.adminNotes).toContain("⚠️ OUT OF TERRITORY: US territories (PR)");
    expect(order.adminNotes).toContain("Refund before packing");
    const flags = events.filter((e) => e.type === "out_of_territory");
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ stripeEventId: "evt_pr1", stripeSessionId: "cs_pr1", actor: "system" });
    expect(scheduled).toEqual(expect.arrayContaining([expect.stringContaining("sendAdminTerritoryAlert")]));

    // A replayed delivery flags nothing twice.
    await deliver(tt, completedEvent("evt_pr1", "cs_pr1", "GL-PR-1", { state: "PR", postal_code: "00901", country: "US" }));
    const replay = await state(tt, orderId);
    expect(replay.events.filter((e) => e.type === "out_of_territory")).toHaveLength(1);
    expect(replay.scheduled.filter((n) => n.includes("sendAdminTerritoryAlert"))).toHaveLength(1);
  });

  it("flags a military AE address", async () => {
    const tt = t();
    const orderId = await seedHeldOrder(tt, "GL-AE-1", "cs_ae1");
    await deliver(tt, completedEvent("evt_ae1", "cs_ae1", "GL-AE-1", { state: "AE", postal_code: "09001", country: "US" }));
    const { order, events } = await state(tt, orderId);
    expect(order.paymentStatus).toBe("paid");
    expect(events.map((e) => e.type)).toContain("out_of_territory");
  });

  it("does not flag a DC address", async () => {
    const tt = t();
    const orderId = await seedHeldOrder(tt, "GL-DC-1", "cs_dc1");
    await deliver(tt, completedEvent("evt_dc1", "cs_dc1", "GL-DC-1", { state: "DC", postal_code: "20001", country: "US" }));
    const { order, events, scheduled } = await state(tt, orderId);
    expect(order.paymentStatus).toBe("paid");
    expect(order.adminNotes).toBeUndefined();
    expect(events.map((e) => e.type)).not.toContain("out_of_territory");
    expect(scheduled.some((n) => n.includes("sendAdminTerritoryAlert"))).toBe(false);
  });
});

function refundEvent(eventId: string, type: string, refund: Record<string, unknown>) {
  return JSON.stringify({ id: eventId, type, data: { object: { object: "refund", ...refund } } });
}

describe("Stripe webhook: refund failed after it was issued (ADR 0025)", () => {
  it("fails the ledger row on refund.failed, and ignores refund.updated for any other status", async () => {
    const tt = t();
    const orderId = await seedHeldOrder(tt, "GL-RF-1", "cs_rf1");
    await deliver(tt, completedEvent("evt_rf_paid", "cs_rf1", "GL-RF-1", { state: "NY", postal_code: "10001", country: "US" }));
    const reservation = await tt.mutation(internal.payments.refundLedger.reserveAdminRefund, {
      orderId,
      requestId: "req-rf-1",
      actor: "user_admin",
      request: { kind: "goodwill", amountCents: 1000, reason: "late" },
    });
    await tt.mutation(internal.payments.refundLedger.commitRefund, { refundId: reservation.refundId, stripeRefundId: "re_rf1" });

    await deliver(tt, refundEvent("evt_rf_succeeded", "refund.updated", { id: "re_rf1", status: "succeeded", metadata: {} }));
    expect((await state(tt, orderId)).events.map((e) => e.type)).not.toContain("refund_failed");

    await deliver(
      tt,
      refundEvent("evt_rf_failed", "refund.failed", {
        id: "re_rf1",
        status: "failed",
        failure_reason: "lost_or_stolen_card",
        metadata: { refundId: reservation.refundId },
      })
    );
    const { order, events } = await state(tt, orderId);
    expect(events.filter((e) => e.type === "refund_failed")).toEqual([
      expect.objectContaining({ stripeEventId: "evt_rf_failed", actor: "stripe" }),
    ]);
    expect(order.adminNotes).toContain("⚠️ REFUND FAILED");
    const row = await tt.run(async (ctx) => ctx.db.get(reservation.refundId));
    expect(row).toMatchObject({ status: "failed" });
  });
});
