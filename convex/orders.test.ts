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
