/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { PRIMARY_ADMIN_EMAIL } from "./auth";
import type { TestConvex } from "convex-test";

const modules = import.meta.glob("./**/*.ts");

const t = () => convexTest(schema, modules);
type T = ReturnType<typeof t>;

const admin = (t: T) => t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
const customer = (t: T) => t.withIdentity({ subject: "user_cust" });

// Run due scheduled jobs (0ms email dispatches) while the environment is alive
// so teardown is clean. Long-delay (24h) jobs are intentionally skipped.
async function drain(tt: T) {
  await tt.finishAllScheduledFunctions(() => {});
}

async function seedVariant(t: T, variantId: string, stock = 5, priceUsd = 100) {
  await t.run(async (ctx) => {
    await ctx.db.insert("variants", {
      variantId,
      nameEn: `Cap ${variantId}`,
      nameEs: `Gorra ${variantId}`,
      silhouette: "snapback",
      primaryHex: "#000000",
      secondaryHex: "#ffffff",
      image: "/img.png",
      stock,
      priceUsd,
      isFeatured: false,
    });
  });
}

async function getStock(t: T, variantId: string): Promise<number> {
  return await t.run(async (ctx) => {
    const v = await ctx.db
      .query("variants")
      .withIndex("by_variantId", (q) => q.eq("variantId", variantId))
      .first();
    return v?.stock ?? -1;
  });
}

async function getOrder(t: T, orderNumber: string) {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", orderNumber))
      .first();
  });
}

async function getEvents(t: T, orderId: string) {
  return await t.run(async (ctx) => {
    return await ctx.db
      .query("payment_events")
      .withIndex("by_order", (q) => q.eq("orderId", orderId as never))
      .collect();
  });
}

async function createLead(
  t: T,
  variantId: string,
  opts: { qty?: number; email?: string; phone?: string; withSession?: boolean } = {}
) {
  const qty = opts.qty ?? 1;
  const subtotal = qty * 100;
  return await t.mutation(internal.orders.createWhatsAppOrderLead, {
    items: [
      {
        variantId,
        name: `Cap ${variantId}`,
        quantity: qty,
        price: 100,
        image: "/img.png",
      },
    ],
    currency: "USD",
    subtotal,
    shippingFee: subtotal, // deliberately wrong: the server must recompute canonically
    total: subtotal,
    customerName: "Test Buyer",
    customerEmail: opts.email ?? "buyer@test.com",
    customerPhone: opts.phone,
    clerkUserId: "user_cust",
    paymentUrl:
      opts.withSession === false ? undefined : "https://checkout.stripe.com/c/pay/cs_test_demo",
    stripeSessionId: opts.withSession === false ? undefined : "cs_test_demo1",
  });
}

async function settleStripe(
  t: T,
  orderNumber: string,
  sessionId: string,
  opts: { eventId?: string; isWhatsApp?: boolean } = {}
) {
  return await t.mutation(internal.orders.createOrUpdateStripeOrder, {
    stripeSessionId: sessionId,
    orderNumber,
    customerEmail: "buyer@test.com",
    customerName: "Test Buyer",
    items: [
      { variantId: "V1", name: "Cap V1", quantity: 1, price: 100, image: "/img.png" },
    ],
    currency: "USD",
    subtotal: 100,
    shippingFee: 0,
    total: opts.isWhatsApp ? 108.5 : 100,
    tax: 8.5,
    webhookEventId: opts.eventId,
    isWhatsAppOrder: opts.isWhatsApp ?? true,
  });
}

describe("API surface lockdown (security regression locks)", () => {
  it("sensitive functions are not on the public api (compile-time enforced)", () => {
    // Each @ts-expect-error FAILS the build if the named function becomes public again.
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    (() => {
      // @ts-expect-error updateOrderPaymentUrl must remain an internalMutation
      void api.orders.updateOrderPaymentUrl;
      // @ts-expect-error attachStripeCustomerInternal must remain internal
      void api.orders.attachStripeCustomerInternal;
      // @ts-expect-error createWhatsAppOrderLead must remain internal
      void api.orders.createWhatsAppOrderLead;
      // @ts-expect-error cancelOrder must remain internal
      void api.orders.cancelOrder;
      // @ts-expect-error cancelOrderAdmin must remain internal
      void api.orders.cancelOrderAdmin;
      // @ts-expect-error debugGetOrders was deleted
      void api.orders.debugGetOrders;
      // @ts-expect-error fulfillStripeWebhook must remain an internalAction
      void api.stripe.fulfillStripeWebhook;
      // @ts-expect-error expireOpenCheckoutSessionsInternal must remain internal
      void api.stripe.expireOpenCheckoutSessionsInternal;
    });
    expect(true).toBe(true);
  });
});

describe("WhatsApp lead creation", () => {
  it("reserves stock with server-verified totals and links the session", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const lead = await createLead(tt, "V1", { qty: 2 });

    expect(lead.subtotal).toBe(200);
    expect(lead.shippingFee).toBe(0); // 2+ caps → free shipping, server-computed
    expect(lead.total).toBe(200);
    expect(lead.orderNumber).toMatch(/^GL-WA-\d{8}$/);
    expect(await getStock(tt, "V1")).toBe(3); // 5 - 2 reserved

    const order = await getOrder(tt, lead.orderNumber);
    expect(order?.status).toBe("whatsapp_initiated");
    expect(order?.stripeSessionId).toBe("cs_test_demo1");
    expect(order?.stripeSessionIds).toEqual(["cs_test_demo1"]);
    expect(order?.paymentUrl).toBeDefined();

    const events = await getEvents(tt, lead.orderId);
    expect(events.map((e) => e.type)).toContain("lead_created");
    await drain(tt);
  });

  it("rejects quantities exceeding live stock", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 1);
    await expect(createLead(tt, "V1", { qty: 2 })).rejects.toThrow(/Insufficient stock/);
    expect(await getStock(tt, "V1")).toBe(1);
    await drain(tt);
  });

  it("enforces the anti-hoarding cap of 3 active leads per email", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 50);
    for (let i = 0; i < 3; i++) {
      await createLead(tt, "V1", { email: "hoarder@test.com" });
    }
    await expect(
      createLead(tt, "V1", { email: "hoarder@test.com" })
    ).rejects.toThrow(/MAX_ACTIVE_RESERVATIONS/);
    await drain(tt);
  });

  it("cancel-and-recreate cannot launder the reservation window cap", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 50);
    // Create 5 reservations with the same email, cancelling each immediately so the
    // ACTIVE count never reaches 3 — only a window over ALL created reservations stops this.
    for (let i = 0; i < 5; i++) {
      const lead = await createLead(tt, "V1", { email: "churn@test.com" });
      await customer(tt).mutation(internal.orders.cancelOrder, {
        orderId: lead.orderId,
        clerkUserId: "user_cust",
      });
    }
    await expect(
      createLead(tt, "V1", { email: "churn@test.com" })
    ).rejects.toThrow(/RESERVATION_RATE_LIMITED/);
    await drain(tt);
  });

  it("uses phone as a secondary identity anchor when email differs", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 50);
    for (let i = 0; i < 3; i++) {
      await createLead(tt, "V1", { email: `x${i}@test.com`, phone: "+1 305 111 2222" });
    }
    // Same phone (different formatting), fresh email → still blocked by the phone anchor.
    await expect(
      createLead(tt, "V1", { email: "fresh@test.com", phone: "13051112222" })
    ).rejects.toThrow(/MAX_ACTIVE_RESERVATIONS/);
    await drain(tt);
  });
});

describe("Reservation expiry state machine", () => {
  it("a stale scheduled expire job self-vetoes inside an extended hold", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const lead = await createLead(tt, "V1");

    // Admin dispatches the link → hold extended 24h from dispatch.
    const dispatched = await admin(tt).mutation(api.orders.dispatchWhatsAppPaymentLinkAdmin, {
      orderId: lead.orderId,
    });
    expect(dispatched.reservationExpiresAt).toBeGreaterThan(Date.now());
    const order0 = await getOrder(tt, lead.orderNumber);
    expect(order0?.paymentLinkSentAt).toBeDefined();

    // Original (stale) expiration job fires early → must NOT cancel.
    await tt.mutation(internal.orders.expireWhatsAppOrderLead, { orderId: lead.orderId });
    const order = await getOrder(tt, lead.orderNumber);
    expect(order?.status).toBe("whatsapp_initiated");
    expect(await getStock(tt, "V1")).toBe(4); // still reserved
    await drain(tt);
  });

  it("releases stock once the hold window truly elapses", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const lead = await createLead(tt, "V1");

    // Force the window to elapse (as if 24h passed).
    await tt.run(async (ctx) => {
      await ctx.db.patch(lead.orderId, { reservationExpiresAt: Date.now() - 1000 });
    });

    await tt.mutation(internal.orders.expireWhatsAppOrderLead, { orderId: lead.orderId });
    const order = await getOrder(tt, lead.orderNumber);
    expect(order?.status).toBe("cancelled");
    expect(await getStock(tt, "V1")).toBe(5); // restored

    const events = await getEvents(tt, lead.orderId);
    expect(events.map((e) => e.type)).toContain("inventory_released");
    await drain(tt);
  });

  it("re-running the expiry job after cancellation is a no-op (idempotent)", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const lead = await createLead(tt, "V1");
    await tt.run(async (ctx) => {
      await ctx.db.patch(lead.orderId, { reservationExpiresAt: Date.now() - 1000 });
    });
    await tt.mutation(internal.orders.expireWhatsAppOrderLead, { orderId: lead.orderId });
    await tt.mutation(internal.orders.expireWhatsAppOrderLead, { orderId: lead.orderId });
    expect(await getStock(tt, "V1")).toBe(5); // NOT restored twice
    await drain(tt);
  });

  it("reconciliation query only returns elapsed holds", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const active = await createLead(tt, "V1");
    await tt.run(async (ctx) => {
      await ctx.db.patch(active.orderId, { reservationExpiresAt: Date.now() - 1 });
    });

    const stale = await tt.query(internal.orders.getExpiredWhatsAppReservationsInternal, {
      now: Date.now(),
      limit: 100,
    });
    expect(stale.map((o) => o._id)).toContain(active.orderId);
    await drain(tt);
  });
});

describe("Settlement guards (double-payment prevention)", () => {
  it("Zelle settlement keeps paymentMethod=whatsapp and assigns tracking", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const lead = await createLead(tt, "V1", { withSession: false });

    const res = await admin(tt).mutation(api.orders.markWhatsAppOrderPaidAdmin, {
      orderId: lead.orderId,
      notes: "Zelle ref 8842",
    });
    expect(res.trackingNumber).toMatch(/^GL-TRK-\d{6}$/);

    const order = await getOrder(tt, lead.orderNumber);
    expect(order?.status).toBe("paid");
    expect(order?.paymentMethod).toBe("whatsapp");

    const events = await getEvents(tt, lead.orderId);
    expect(events.map((e) => e.type)).toContain("zelle_settled");
    await drain(tt);
  });

  it("a Stripe webhook after Zelle settlement is flagged, never silently applied", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const lead = await createLead(tt, "V1", { withSession: false });
    await admin(tt).mutation(api.orders.markWhatsAppOrderPaidAdmin, { orderId: lead.orderId });

    await settleStripe(tt, lead.orderNumber, "cs_test_late", { eventId: "evt_late" });

    const order = await getOrder(tt, lead.orderNumber);
    expect(order?.status).toBe("paid");
    expect(order?.paymentMethod).toBe("whatsapp"); // NOT flipped to stripe
    expect(order?.adminNotes).toContain("DOUBLE SETTLEMENT");

    const events = await getEvents(tt, lead.orderId);
    expect(events.map((e) => e.type)).toContain("double_settlement_attempted");
    await drain(tt);
  });

  it("settling a cancelled order is refused and flagged", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const lead = await createLead(tt, "V1", { withSession: false });
    await customer(tt).mutation(internal.orders.cancelOrder, {
      orderId: lead.orderId,
      clerkUserId: "user_cust",
    });

    await settleStripe(tt, lead.orderNumber, "cs_test_late", { eventId: "evt_late2" });

    const order = await getOrder(tt, lead.orderNumber);
    expect(order?.status).toBe("cancelled");
    const events = await getEvents(tt, lead.orderId);
    expect(events.map((e) => e.type)).toContain("double_settlement_attempted");
    await drain(tt);
  });

  it("refuses to mark a cancelled reservation as paid", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const lead = await createLead(tt, "V1", { withSession: false });
    await customer(tt).mutation(internal.orders.cancelOrder, {
      orderId: lead.orderId,
      clerkUserId: "user_cust",
    });
    await expect(
      admin(tt).mutation(api.orders.markWhatsAppOrderPaidAdmin, { orderId: lead.orderId })
    ).rejects.toThrow(/cancelled/i);
    await drain(tt);
  });
});

describe("Stripe settlement of WhatsApp leads", () => {
  it("settles the lead and never re-decrements reserved stock", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const lead = await createLead(tt, "V1");

    await settleStripe(tt, lead.orderNumber, "cs_test_demo1", { eventId: "evt_ok" });

    const order = await getOrder(tt, lead.orderNumber);
    expect(order?.status).toBe("paid");
    expect(order?.paymentMethod).toBe("stripe");
    expect(order?.trackingNumber).toMatch(/^GL-TRK-\d{6}$/);
    expect(order?.tax).toBe(8.5);
    expect(await getStock(tt, "V1")).toBe(4); // stock was already reserved by the lead

    const events = await getEvents(tt, lead.orderId);
    expect(events.map((e) => e.type)).toContain("stripe_settled");
    await drain(tt);
  });

  it("replays the same webhook event id exactly once", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const lead = await createLead(tt, "V1");

    await settleStripe(tt, lead.orderNumber, "cs_test_demo1", { eventId: "evt_dup" });
    await settleStripe(tt, lead.orderNumber, "cs_test_demo1", { eventId: "evt_dup" });

    const events = await getEvents(tt, lead.orderId);
    expect(events.filter((e) => e.type === "stripe_settled")).toHaveLength(1);
    await drain(tt);
  });

  it("marks brand-new direct Stripe orders paid with stock decrement", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    await tt.mutation(internal.orders.createOrUpdateStripeOrder, {
      stripeSessionId: "cs_direct1",
      orderNumber: "GL-DIRECT-1",
      customerEmail: "buyer@test.com",
      items: [
        { variantId: "V1", name: "Cap V1", quantity: 2, price: 100, image: "/img.png" },
      ],
      currency: "USD",
      subtotal: 200,
      shippingFee: 0,
      total: 200,
      webhookEventId: "evt_direct",
      isWhatsAppOrder: false,
    });
    expect(await getStock(tt, "V1")).toBe(3); // direct orders deduct at settlement
    const order = await getOrder(tt, "GL-DIRECT-1");
    expect(order?.status).toBe("paid");
    await drain(tt);
  });
});

describe("updateOrderStatusAdmin state machine", () => {
  it("rejects settling a whatsapp reservation through the generic endpoint", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const lead = await createLead(tt, "V1");
    await expect(
      admin(tt).mutation(api.orders.updateOrderStatusAdmin, {
        orderId: lead.orderId,
        newStatus: "dispatched",
      })
    ).rejects.toThrow(/Mark as Paid \(Zelle\)/);
    await drain(tt);
  });

  it("rejects regressing a settled order and allows paid→dispatched", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const lead = await createLead(tt, "V1");
    await settleStripe(tt, lead.orderNumber, "cs_test_demo1", { eventId: "evt_sm" });

    await expect(
      admin(tt).mutation(api.orders.updateOrderStatusAdmin, {
        orderId: lead.orderId,
        newStatus: "whatsapp_initiated",
      })
    ).rejects.toThrow(/Invalid transition/);

    await admin(tt).mutation(api.orders.updateOrderStatusAdmin, {
      orderId: lead.orderId,
      newStatus: "dispatched",
    });
    const order = await getOrder(tt, lead.orderNumber);
    expect(order?.status).toBe("dispatched");
    expect(order?.trackingNumber).toMatch(/^GL-TRK-\d{6}$/);
    await drain(tt);
  });

  it("requires admin identity", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const lead = await createLead(tt, "V1");
    await expect(
      customer(tt).mutation(api.orders.updateOrderStatusAdmin, {
        orderId: lead.orderId,
        newStatus: "dispatched",
      })
    ).rejects.toThrow(/Unauthorized|Forbidden/);
    await drain(tt);
  });
});

describe("Public query PII containment", () => {
  async function seeded(tt: T) {
    await seedVariant(tt, "V1", 5);
    const lead = await createLead(tt, "V1", { email: "secret@test.com" });
    await tt.run(async (ctx) => {
      await ctx.db.patch(lead.orderId, {
        shippingAddress: {
          line1: "123 Secret St",
          city: "Miami",
          state: "FL",
          postalCode: "33101",
          country: "US",
        },
      });
    });
    return lead;
  }

  it("order-number lookup never exposes payment links or session ids", async () => {
    const tt = t();
    const lead = await seeded(tt);
    const order: any = await tt.query(api.orders.getOrderBySessionOrNumber, {
      identifier: lead.orderNumber,
    });
    expect(order).not.toBeNull();
    expect(order.paymentUrl).toBeUndefined();
    expect(order.stripeSessionId).toBeUndefined();
    expect(order.shippingAddress).toBeUndefined();
    expect(order.customerPhone).toBeUndefined();
    expect(order.adminNotes).toBeUndefined();
    await drain(tt);
  });

  it("session-id lookup reveals delivery card PII but never payment links", async () => {
    const tt = t();
    await seeded(tt);
    const order: any = await tt.query(api.orders.getOrderBySessionOrNumber, {
      identifier: "cs_test_demo1",
    });
    expect(order.shippingAddress?.line1).toBe("123 Secret St");
    expect(order.paymentUrl).toBeUndefined();
    expect(order.stripeSessionId).toBeUndefined();
    await drain(tt);
  });

  it("email-gated tracking masks street/zip for unauthenticated guests", async () => {
    const tt = t();
    const lead = await seeded(tt);

    const wrongEmail = await tt.query(api.orders.getOrderByOrderNumberAndEmail, {
      orderNumber: lead.orderNumber,
      email: "attacker@test.com",
    });
    expect(wrongEmail).toBeNull();

    const rightEmail: any = await tt.query(api.orders.getOrderByOrderNumberAndEmail, {
      orderNumber: lead.orderNumber,
      email: "secret@test.com",
    });
    expect(rightEmail).not.toBeNull();
    expect(rightEmail.shippingAddress.line1).toBe("***");
    expect(rightEmail.shippingAddress.postalCode).toBe("***");
    expect(rightEmail.customerEmail).toBeUndefined();
    expect(rightEmail.customerPhone).toBeUndefined();
    expect(rightEmail.paymentUrl).toBeUndefined();
    // Countdown data is intentionally shared with the holder of order+email:
    expect(rightEmail.reservationExpiresAt).toBeTypeOf("number");
    await drain(tt);
  });
});

describe("Stripe Refund and Dispute Webhook Lifecycle", () => {
  it("handles full refund: marks status refunded, sets refundedAmount, and retains stock", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    await tt.mutation(internal.orders.createOrUpdateStripeOrder, {
      stripeSessionId: "cs_refund_test",
      orderNumber: "GL-REFUND-1",
      customerEmail: "refund@test.com",
      items: [
        { variantId: "V1", name: "Cap V1", quantity: 2, price: 50, image: "/img.png" },
      ],
      currency: "USD",
      subtotal: 100,
      total: 100,
      webhookEventId: "evt_settle_refund",
      isWhatsAppOrder: false,
    });

    expect(await getStock(tt, "V1")).toBe(3); // 5 - 2 = 3
    const orderBefore = await getOrder(tt, "GL-REFUND-1");
    expect(orderBefore?.status).toBe("paid");

    // Full refund processed via webhook
    await tt.mutation(internal.orders.recordStripeRefundInternal, {
      orderId: orderBefore!._id,
      orderNumber: "GL-REFUND-1",
      refundedAmount: 100,
      isFullRefund: true,
      webhookEventId: "evt_refund_full",
      stripeChargeId: "ch_test_full",
    });

    const orderAfter = await getOrder(tt, "GL-REFUND-1");
    expect(orderAfter?.status).toBe("refunded");
    expect(orderAfter?.refundedAmount).toBe(100);
    // Stock remains unchanged (manual restock only, physical goods safety)
    expect(await getStock(tt, "V1")).toBe(3);

    const events = await getEvents(tt, orderBefore!._id);
    expect(events.map((e) => e.type)).toContain("charge_refunded");

    // Replay idempotency
    await tt.mutation(internal.orders.recordStripeRefundInternal, {
      orderId: orderBefore!._id,
      orderNumber: "GL-REFUND-1",
      refundedAmount: 100,
      isFullRefund: true,
      webhookEventId: "evt_refund_full",
    });
    const eventsAfterReplay = await getEvents(tt, orderBefore!._id);
    expect(eventsAfterReplay.filter((e) => e.type === "charge_refunded")).toHaveLength(1);

    await drain(tt);
  });

  it("handles partial refund: marks status partially_refunded with cumulative amount", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    await tt.mutation(internal.orders.createOrUpdateStripeOrder, {
      stripeSessionId: "cs_partial_refund_test",
      orderNumber: "GL-PARTIAL-1",
      customerEmail: "partial@test.com",
      items: [
        { variantId: "V1", name: "Cap V1", quantity: 2, price: 50, image: "/img.png" },
      ],
      currency: "USD",
      subtotal: 100,
      total: 100,
      webhookEventId: "evt_settle_partial",
      isWhatsAppOrder: false,
    });

    const order = await getOrder(tt, "GL-PARTIAL-1");

    await tt.mutation(internal.orders.recordStripeRefundInternal, {
      orderId: order!._id,
      orderNumber: "GL-PARTIAL-1",
      refundedAmount: 30,
      isFullRefund: false,
      webhookEventId: "evt_partial_1",
    });

    const orderAfter = await getOrder(tt, "GL-PARTIAL-1");
    expect(orderAfter?.status).toBe("partially_refunded");
    expect(orderAfter?.refundedAmount).toBe(30);

    const events = await getEvents(tt, order!._id);
    expect(events.map((e) => e.type)).toContain("charge_partially_refunded");

    await drain(tt);
  });

  it("handles dispute lifecycle: flags order on opened and unflags on closed", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    await tt.mutation(internal.orders.createOrUpdateStripeOrder, {
      stripeSessionId: "cs_dispute_test",
      orderNumber: "GL-DISPUTE-1",
      customerEmail: "dispute@test.com",
      items: [
        { variantId: "V1", name: "Cap V1", quantity: 1, price: 65, image: "/img.png" },
      ],
      currency: "USD",
      subtotal: 65,
      total: 65,
      webhookEventId: "evt_settle_dispute",
      isWhatsAppOrder: false,
    });

    const order = await getOrder(tt, "GL-DISPUTE-1");
    expect(order?.disputed).toBeFalsy();

    // 1. Dispute opened
    await tt.mutation(internal.orders.recordStripeDisputeInternal, {
      orderId: order!._id,
      orderNumber: "GL-DISPUTE-1",
      disputeId: "dp_test_123",
      status: "needs_response",
      amount: 65,
      currency: "USD",
      reason: "fraudulent",
      evidenceDueBy: Date.now() + 7 * 24 * 60 * 60 * 1000,
      webhookEventId: "evt_dispute_open",
      action: "opened",
    });

    const orderDisputed = await getOrder(tt, "GL-DISPUTE-1");
    expect(orderDisputed?.disputed).toBe(true);
    expect(orderDisputed?.disputeDetails).toContain("CHARGEBACK DISPUTE");
    expect(orderDisputed?.adminNotes).toContain("Respond in Stripe Dashboard");

    const events = await getEvents(tt, order!._id);
    expect(events.map((e) => e.type)).toContain("dispute_created");

    // 2. Dispute closed (won)
    await tt.mutation(internal.orders.recordStripeDisputeInternal, {
      orderId: order!._id,
      orderNumber: "GL-DISPUTE-1",
      disputeId: "dp_test_123",
      status: "won",
      amount: 65,
      currency: "USD",
      webhookEventId: "evt_dispute_close",
      action: "closed",
    });

    const orderResolved = await getOrder(tt, "GL-DISPUTE-1");
    expect(orderResolved?.disputed).toBe(false);
    expect(orderResolved?.disputeDetails).toContain("WON by merchant");

    const eventsAfter = await getEvents(tt, order!._id);
    expect(eventsAfter.map((e) => e.type)).toContain("dispute_closed");

    await drain(tt);
  });
});

describe("Stripe Customer Identity Attachment", () => {
  it("persists stripeCustomerId on order settlement and mirrors to user record", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5, 120);

    // Seed a registered Clerk user
    const userId = await tt.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "user_clerk_123",
        email: "collector@example.com",
        name: "Collector",
        role: "customer",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });

    // Settle a new direct order with a Stripe customer id
    await tt.mutation(internal.orders.createOrUpdateStripeOrder, {
      stripeSessionId: "cs_test_cust_1",
      orderNumber: "GL-CUST-1",
      customerEmail: "collector@example.com",
      customerName: "Collector",
      clerkUserId: "user_clerk_123",
      stripeCustomerId: "cus_test_999",
      items: [
        { variantId: "V1", name: "Cap V1", quantity: 1, price: 120, image: "/cap.png" },
      ],
      currency: "USD",
      subtotal: 120,
      shippingFee: 0,
      tax: 0,
      total: 120,
      isWhatsAppOrder: false,
    });

    const order = await getOrder(tt, "GL-CUST-1");
    expect(order?.stripeCustomerId).toBe("cus_test_999");
    expect(order?.status).toBe("paid");

    const user = await tt.run(async (ctx) => {
      return await ctx.db.get(userId);
    });
    expect(user?.stripeCustomerId).toBe("cus_test_999");

    await drain(tt);
  });
});

describe("Stripe Invoice Attachment", () => {
  it("persists invoicePdfUrl and stripeInvoiceId on settlement and via webhook update", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5, 120);

    // 1. Settle order with invoice details
    await tt.mutation(internal.orders.createOrUpdateStripeOrder, {
      stripeSessionId: "cs_test_inv_1",
      orderNumber: "GL-INV-1",
      customerEmail: "invoice@example.com",
      stripeInvoiceId: "in_12345",
      invoicePdfUrl: "https://stripe.com/invoice_12345.pdf",
      hostedInvoiceUrl: "https://invoice.stripe.com/i/acct_123/inv_12345",
      items: [
        { variantId: "V1", name: "Cap V1", quantity: 1, price: 120, image: "/cap.png" },
      ],
      currency: "USD",
      subtotal: 120,
      shippingFee: 0,
      tax: 0,
      total: 120,
      isWhatsAppOrder: false,
    });

    let order = await getOrder(tt, "GL-INV-1");
    expect(order?.stripeInvoiceId).toBe("in_12345");
    expect(order?.invoicePdfUrl).toBe("https://stripe.com/invoice_12345.pdf");
    expect(order?.hostedInvoiceUrl).toBe("https://invoice.stripe.com/i/acct_123/inv_12345");

    // 2. Asynchronous invoice.paid webhook attaches / updates PDF URL
    const res = await tt.mutation(internal.orders.attachStripeInvoiceInternal, {
      orderNumber: "GL-INV-1",
      stripeInvoiceId: "in_12345",
      invoicePdfUrl: "https://stripe.com/invoice_12345_final.pdf",
      hostedInvoiceUrl: "https://invoice.stripe.com/i/acct_123/inv_12345_final",
    });
    expect(res.success).toBe(true);

    order = await getOrder(tt, "GL-INV-1");
    expect(order?.invoicePdfUrl).toBe("https://stripe.com/invoice_12345_final.pdf");

    await drain(tt);
  });
});

describe("Shipping & Multi-Carrier Label Printing Lifecycle", () => {
  it("attaches shipping label, transitions order to dispatched, and logs audit event", async () => {
    const tt = t();
    await seedVariant(tt, "V_CAP1", 10, 150);

    // 1. Create a paid order
    await tt.mutation(internal.orders.createOrUpdateStripeOrder, {
      stripeSessionId: "cs_test_ship_1",
      orderNumber: "GL-SHIP-01",
      customerEmail: "collector@example.com",
      customerName: "Alex Mercer",
      items: [
        { variantId: "V_CAP1", name: "Cap V_CAP1", quantity: 1, price: 150, image: "/cap.png" },
      ],
      currency: "USD",
      subtotal: 150,
      shippingFee: 0,
      tax: 0,
      total: 150,
      isWhatsAppOrder: false,
    });

    let order = await getOrder(tt, "GL-SHIP-01");
    expect(order?.status).toBe("paid");
    expect(order?.shippingLabelUrl).toBeUndefined();

    // 2. Attach shipping label purchased via Shippo
    const res = await tt.mutation(internal.orders.attachShippingLabelInternal, {
      orderId: order!._id,
      carrier: "USPS",
      trackingNumber: "9400111899223344556677",
      shippingLabelUrl: "https://delivery.goshippo.com/label_123.pdf",
      shippingRateId: "rate_shippo_456",
      shippingTransactionId: "tx_shippo_789",
      shippingServiceLevel: "USPS Ground Advantage",
      shippingCost: 5.85,
      shippingEstimatedDays: 3,
      shippingLabelFileType: "PDF_4x6",
      carrierTrackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223344556677",
      parcelDimensions: {
        length: 8,
        width: 8,
        height: 6,
        weight: 8,
        unit: "in",
      },
      actor: "admin_user",
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe("dispatched");
    expect(res.trackingNumber).toBe("9400111899223344556677");

    // 3. Verify order document in Convex
    order = await getOrder(tt, "GL-SHIP-01");
    expect(order?.status).toBe("dispatched");
    expect(order?.carrier).toBe("USPS");
    expect(order?.trackingNumber).toBe("9400111899223344556677");
    expect(order?.shippingLabelUrl).toBe("https://delivery.goshippo.com/label_123.pdf");
    expect(order?.shippingRateId).toBe("rate_shippo_456");
    expect(order?.shippingTransactionId).toBe("tx_shippo_789");
    expect(order?.shippingServiceLevel).toBe("USPS Ground Advantage");
    expect(order?.shippingCost).toBe(5.85);
    expect(order?.shippingEstimatedDays).toBe(3);
    expect(order?.parcelDimensions?.length).toBe(8);
    expect(order?.parcelDimensions?.weight).toBe(8);

    // 4. Verify payment/fulfillment audit trail
    const events = await getEvents(tt, order!._id);
    const labelEvent = events.find((e: any) => e.type === "shipping_label_created");
    expect(labelEvent).toBeDefined();
    expect(labelEvent?.details).toContain("USPS (USPS Ground Advantage)");
    expect(labelEvent?.details).toContain("9400111899223344556677");

    await drain(tt);
  });

  it("processes DELIVERED scan: transitions order to delivered, schedules email, and logs audit", async () => {
    const tt = t();
    await seedVariant(tt, "V_CAP2", 5, 175);

    // 1. Create order and dispatch with tracking
    await tt.mutation(internal.orders.createOrUpdateStripeOrder, {
      stripeSessionId: "cs_test_ship_deliv",
      orderNumber: "GL-DELIV-01",
      customerEmail: "vip@example.com",
      customerName: "Elena Rostova",
      items: [
        { variantId: "V_CAP2", name: "Cap V_CAP2", quantity: 1, price: 175, image: "/cap.png" },
      ],
      currency: "USD",
      subtotal: 175,
      shippingFee: 0,
      tax: 0,
      total: 175,
      isWhatsAppOrder: false,
    });

    let order = await getOrder(tt, "GL-DELIV-01");
    await tt.mutation(internal.orders.attachShippingLabelInternal, {
      orderId: order!._id,
      carrier: "USPS",
      trackingNumber: "9400111899000000000001",
      shippingLabelUrl: "https://delivery.goshippo.com/deliv_label.pdf",
    });

    order = await getOrder(tt, "GL-DELIV-01");
    expect(order?.status).toBe("dispatched");

    // 2. Incoming carrier webhook: DELIVERED
    const webhookRes = await tt.mutation(internal.orders.handleTrackingWebhookInternal, {
      trackingNumber: "9400111899000000000001",
      carrier: "USPS",
      status: "DELIVERED",
      statusDetails: "Delivered in or at the mailbox",
      statusDate: "2026-09-27T14:00:00Z",
      location: {
        city: "Miami",
        state: "FL",
        zip: "33101",
        country: "US",
      },
    });

    expect(webhookRes.found).toBe(true);
    expect(webhookRes.status).toBe("delivered");

    order = await getOrder(tt, "GL-DELIV-01");
    expect(order?.status).toBe("delivered");
    expect(order?.trackingStatus).toBe("DELIVERED");
    expect(order?.trackingStatusDetails).toBe("Delivered in or at the mailbox");
    expect(order?.trackingLocation).toBe("Miami, FL");
    expect(order?.trackingDeliveredAt).toBeDefined();

    // 3. Verify audit trail
    const events = await getEvents(tt, order!._id);
    const delivEvent = events.find((e: any) => e.type === "carrier_delivered");
    expect(delivEvent).toBeDefined();
    expect(delivEvent?.details).toContain("Delivered in or at the mailbox");

    await drain(tt);
  });

  it("handles FAILURE/RETURNED scans by logging alerts and updating audit trail", async () => {
    const tt = t();
    await seedVariant(tt, "V_CAP3", 5, 175);

    await tt.mutation(internal.orders.createOrUpdateStripeOrder, {
      stripeSessionId: "cs_test_ship_fail",
      orderNumber: "GL-FAIL-01",
      customerEmail: "buyer@example.com",
      items: [
        { variantId: "V_CAP3", name: "Cap V_CAP3", quantity: 1, price: 175, image: "/cap.png" },
      ],
      currency: "USD",
      subtotal: 175,
      shippingFee: 0,
      tax: 0,
      total: 175,
      isWhatsAppOrder: false,
    });

    let order = await getOrder(tt, "GL-FAIL-01");
    await tt.mutation(internal.orders.attachShippingLabelInternal, {
      orderId: order!._id,
      carrier: "UPS",
      trackingNumber: "1Z9999999900000002",
      shippingLabelUrl: "https://delivery.goshippo.com/fail_label.pdf",
    });

    // Incoming carrier webhook: FAILURE (no access code)
    const res = await tt.mutation(internal.orders.handleTrackingWebhookInternal, {
      trackingNumber: "1Z9999999900000002",
      carrier: "UPS",
      status: "FAILURE",
      statusDetails: "Receiver not at address / Gate code required",
      statusDate: "2026-09-27T14:15:00Z",
      location: {
        city: "Austin",
        state: "TX",
      },
    });

    expect(res.found).toBe(true);

    order = await getOrder(tt, "GL-FAIL-01");
    expect(order?.trackingStatus).toBe("FAILURE");
    expect(order?.trackingFailedAt).toBeDefined();
    expect(order?.adminNotes).toContain("Carrier FAILURE");
    expect(order?.adminNotes).toContain("Gate code required");

    const events = await getEvents(tt, order!._id);
    const failEvent = events.find((e: any) => e.type === "delivery_failed");
    expect(failEvent).toBeDefined();

    await drain(tt);
  });

  it("respects manualStatusOverride when admin manually reverts a delivered order", async () => {
    const tt = t();
    await seedVariant(tt, "V_CAP4", 5, 175);

    await tt.mutation(internal.orders.createOrUpdateStripeOrder, {
      stripeSessionId: "cs_test_override",
      orderNumber: "GL-OVER-01",
      customerEmail: "cust@example.com",
      items: [
        { variantId: "V_CAP4", name: "Cap V_CAP4", quantity: 1, price: 175, image: "/cap.png" },
      ],
      currency: "USD",
      subtotal: 175,
      shippingFee: 0,
      tax: 0,
      total: 175,
      isWhatsAppOrder: false,
    });

    let order = await getOrder(tt, "GL-OVER-01");
    await tt.mutation(internal.orders.attachShippingLabelInternal, {
      orderId: order!._id,
      carrier: "USPS",
      trackingNumber: "9400111899000000000003",
      shippingLabelUrl: "https://delivery.goshippo.com/over_label.pdf",
    });

    // Carrier scans DELIVERED
    await tt.mutation(internal.orders.handleTrackingWebhookInternal, {
      trackingNumber: "9400111899000000000003",
      status: "DELIVERED",
      statusDetails: "Delivered",
    });

    order = await getOrder(tt, "GL-OVER-01");
    expect(order?.status).toBe("delivered");

    // Human admin investigates missing parcel and manually reverts to dispatched
    await admin(tt).mutation(api.orders.updateOrderStatusAdmin, {
      orderId: order!._id,
      newStatus: "dispatched",
      adminNotes: "Customer called concierge: package not at porch, checking with neighbor.",
    });

    order = await getOrder(tt, "GL-OVER-01");
    expect(order?.status).toBe("dispatched");
    expect(order?.manualStatusOverride).toBe(true);

    // Another DELIVERED webhook arrives from carrier (e.g. carrier system sync)
    const subsequentRes = await tt.mutation(internal.orders.handleTrackingWebhookInternal, {
      trackingNumber: "9400111899000000000003",
      status: "DELIVERED",
      statusDetails: "Delivered scan re-transmitted",
    });

    expect(subsequentRes.status).toBe("dispatched"); // Blocked from overwriting!
    order = await getOrder(tt, "GL-OVER-01");
    expect(order?.status).toBe("dispatched"); // Still dispatched!

    await drain(tt);
  });
});




