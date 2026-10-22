/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import aggregateTest from "@convex-dev/aggregate/test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { adjustStock, getVariant } from "../catalog/inventory";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import type { TestConvex } from "convex-test";
import type { Doc } from "../_generated/dataModel";
import type { StatusAxes } from "./status";

const modules = import.meta.glob("/convex/**/*.ts");

// orderStats: every order write updates the dashboard aggregate (analytics/orderStats.ts).
function t() {
  const tt = convexTest(schema, modules);
  aggregateTest.register(tt, "orderStats");
  return tt;
}
type T = ReturnType<typeof t>;

const admin = (t: T) => t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL, emailVerified: true });
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
      isAvailable: true,
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
    return (await getVariant(ctx, variantId))?.stock ?? -1;
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

/** An Order's lifecycle on both axes (ADR 0024), compact for assertions. */
function lifecycle(order: Doc<"orders"> | null | undefined) {
  return {
    payment: order?.paymentStatus,
    fulfillment: order?.fulfillmentStatus,
    cancelled: order?.cancelledAt !== undefined,
  };
}

/** Shorthand for the axes a seeded Order starts with. */
const SEED_AXES = {
  pending: { paymentStatus: "awaiting_payment", fulfillmentStatus: "unfulfilled" },
  paid: { paymentStatus: "paid", fulfillmentStatus: "unfulfilled" },
  dispatched: { paymentStatus: "paid", fulfillmentStatus: "in_transit" },
} satisfies Record<string, StatusAxes>;

/** Seed an Order. `status` picks its starting axes (SEED_AXES). */
async function seedOrder(
  t: T,
  variantId: string,
  opts: {
    qty?: number;
    email?: string;
    status?: keyof typeof SEED_AXES;
    paymentMethod?: "stripe" | "whatsapp";
    stripeSessionId?: string | null;
    orderNumber?: string;
  } = {}
) {
  const qty = opts.qty ?? 1;
  const status = opts.status ?? "paid";
  const orderNumber = opts.orderNumber ?? `GL-TEST-${Math.floor(Math.random() * 1e6)}`;
  const stripeSessionId = opts.stripeSessionId === null ? undefined : (opts.stripeSessionId ?? "cs_test_demo1");
  const orderId = await t.run(async (ctx) => {
    // Settled orders hold their units, as in production.
    if (status === "paid" || status === "dispatched") {
      await adjustStock(ctx, { variantId, quantity: qty }, -qty);
    }
    return await ctx.db.insert("orders", {
      orderNumber,
      customerName: "Test Buyer",
      customerEmail: opts.email ?? "buyer@test.com",
      clerkUserId: "user_cust",
      items: [{ variantId, name: `Cap ${variantId}`, quantity: qty, price: 100, image: "/img.png" }],
      currency: "USD",
      subtotal: qty * 100,
      shippingFee: 0,
      total: qty * 100,
      ...SEED_AXES[status],
      paymentMethod: opts.paymentMethod ?? "stripe",
      stripeSessionId,
      paymentUrl: stripeSessionId ? "https://checkout.stripe.com/c/pay/cs_test_demo" : undefined,
      createdAt: Date.now(),
    });
  });
  return { orderId, orderNumber };
}

async function settleStripe(t: T, orderNumber: string, sessionId: string, opts: { eventId?: string } = {}) {
  return await t.mutation(internal.orders.settlement.createOrUpdateStripeOrder, {
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
    total: 108.5,
    tax: 8.5,
    webhookEventId: opts.eventId,
  });
}

describe("API surface lockdown (security regression locks)", () => {
  it("sensitive functions are not on the public api (compile-time enforced)", () => {
    // Each @ts-expect-error FAILS the build if the named function becomes public again.
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    (() => {
      // @ts-expect-error attachStripeCustomerInternal must remain internal
      void api.orders.settlement.attachStripeCustomerInternal;
      // @ts-expect-error cancelOrder must remain internal
      void api.orders.functions.cancelOrder;
      // @ts-expect-error cancelOrderAdmin must remain internal
      void api.orders.desk.cancelOrderAdmin;
      // @ts-expect-error debugGetOrders was deleted
      void api.orders.functions.debugGetOrders;
      // @ts-expect-error fulfillStripeWebhook must remain an internalAction
      void api.payments.webhook.fulfillStripeWebhook;
      // @ts-expect-error expireOpenCheckoutSessionsInternal must remain internal
      void api.payments.checkout.expireOpenCheckoutSessionsInternal;
      // @ts-expect-error sweepOverdueCheckoutHolds must remain internal
      void api.payments.checkout.sweepOverdueCheckoutHolds;
      // @ts-expect-error placeCheckoutHold must remain internal
      void api.orders.checkoutHold.placeCheckoutHold;
      // @ts-expect-error releaseCheckoutHold must remain internal
      void api.orders.checkoutHold.releaseCheckoutHold;
      // @ts-expect-error reserveAdminRefund must remain internal
      void api.payments.refundLedger.reserveAdminRefund;
      // @ts-expect-error commitRefund must remain internal
      void api.payments.refundLedger.commitRefund;
      // @ts-expect-error failRefund must remain internal
      void api.payments.refundLedger.failRefund;
    });
    expect(true).toBe(true);
  });
});

describe("Settlement guards (double-payment prevention)", () => {
  it("a different session paying a settled order is flagged, never silently applied", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const order = await seedOrder(tt, "V1", { stripeSessionId: "cs_first" });

    await settleStripe(tt, order.orderNumber, "cs_test_late", { eventId: "evt_late" });

    const after = await getOrder(tt, order.orderNumber);
    expect(lifecycle(after)).toEqual({ payment: "paid", fulfillment: "unfulfilled", cancelled: false });
    expect(after?.stripeSessionId).toBe("cs_first");
    expect(after?.adminNotes).toContain("DOUBLE SETTLEMENT");
    expect(await getStock(tt, "V1")).toBe(4);

    const events = await getEvents(tt, order.orderId);
    expect(events.map((e) => e.type)).toContain("double_settlement_attempted");
    await drain(tt);
  });

  it("a re-delivered payment for the order's own session never regresses a dispatched order", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const order = await seedOrder(tt, "V1", { status: "dispatched", stripeSessionId: "cs_own" });

    await settleStripe(tt, order.orderNumber, "cs_own", { eventId: "evt_new_id" });

    const after = await getOrder(tt, order.orderNumber);
    expect(lifecycle(after)).toEqual({ payment: "paid", fulfillment: "in_transit", cancelled: false });
    const events = await getEvents(tt, order.orderId);
    expect(events).toHaveLength(0);
    await drain(tt);
  });

  it("settling a cancelled order is refused and flagged", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const order = await seedOrder(tt, "V1");
    await customer(tt).mutation(internal.orders.functions.cancelOrder, { orderId: order.orderId });

    await settleStripe(tt, order.orderNumber, "cs_test_late", { eventId: "evt_late2" });

    const after = await getOrder(tt, order.orderNumber);
    expect(lifecycle(after)).toEqual({ payment: "paid", fulfillment: "unfulfilled", cancelled: true });
    expect(after?.cancellationReason).toBe("customer");
    const events = await getEvents(tt, order.orderId);
    expect(events.map((e) => e.type)).toContain("double_settlement_attempted");
    await drain(tt);
  });
});

describe("Stripe settlement", () => {
  it("replays the same webhook event id exactly once", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);

    const orderId = await settleStripe(tt, "GL-DUP-1", "cs_dup", { eventId: "evt_dup" });
    await settleStripe(tt, "GL-DUP-1", "cs_dup", { eventId: "evt_dup" });

    const events = await getEvents(tt, orderId);
    expect(events.filter((e) => e.type === "stripe_settled")).toHaveLength(1);
    expect(await getStock(tt, "V1")).toBe(4);
    await drain(tt);
  });

  it("marks brand-new direct Stripe orders paid with stock decrement", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    await tt.mutation(internal.orders.settlement.createOrUpdateStripeOrder, {
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
    });
    expect(await getStock(tt, "V1")).toBe(3); // direct orders deduct at settlement
    const order = await getOrder(tt, "GL-DIRECT-1");
    expect(lifecycle(order)).toEqual({ payment: "paid", fulfillment: "unfulfilled", cancelled: false });
    await drain(tt);
  });
});

async function placeHold(
  t: T,
  orderNumber: string,
  items: Array<{ variantId: string; quantity: number; colorway?: string; size?: string }>,
  opts: { holdExpiresAt?: number; locale?: string } = {}
) {
  return await t.mutation(internal.orders.checkoutHold.placeCheckoutHold, {
    orderNumber,
    items: items.map((i) => ({ ...i, name: `Cap ${i.variantId}`, price: 100, image: "/img.png" })),
    currency: "USD",
    subtotal: 100,
    shippingFee: 0,
    total: 100,
    clerkUserId: "user_cust",
    customerEmail: "buyer@test.com",
    checkoutHoldExpiresAt: opts.holdExpiresAt ?? Date.now() + 31 * 60 * 1000,
    locale: opts.locale ?? "en",
  });
}

async function placeHoldWithSession(t: T, orderNumber: string, sessionId: string, qty = 1) {
  const orderId = await placeHold(t, orderNumber, [{ variantId: "V1", quantity: qty }]);
  await t.mutation(internal.orders.checkoutHold.attachCheckoutSession, { orderId, stripeSessionId: sessionId });
  return orderId;
}

describe("Checkout Hold (ADR 0024)", () => {
  it("Pay creates an order awaiting payment and takes its units in one step", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const orderId = await placeHoldWithSession(tt, "GL-HOLD-1", "cs_hold1", 2);

    const order = await getOrder(tt, "GL-HOLD-1");
    expect(order?._id).toBe(orderId);
    expect(lifecycle(order)).toEqual({ payment: "awaiting_payment", fulfillment: "unfulfilled", cancelled: false });
    expect(order).not.toHaveProperty("status");
    expect(order?.stripeSessionId).toBe("cs_hold1");
    expect(order?.checkoutHoldExpiresAt).toBeGreaterThan(Date.now());
    expect(await getStock(tt, "V1")).toBe(3);
    const events = await getEvents(tt, orderId);
    expect(events.map((e) => e.type)).toEqual(["checkout_hold_placed", "link_generated"]);
  });

  it("two buyers can never hold the last unit", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 1);
    await placeHold(tt, "GL-FIRST", [{ variantId: "V1", quantity: 1 }]);

    await expect(placeHold(tt, "GL-SECOND", [{ variantId: "V1", quantity: 1 }])).rejects.toThrow(
      '"Cap V1" just sold out.'
    );
    expect(await getOrder(tt, "GL-SECOND")).toBeNull();
    expect(await getStock(tt, "V1")).toBe(0);
  });

  it("refuses a short line in the cart's language instead of clamping", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 3);
    await seedVariant(tt, "V2", 5);

    await expect(
      placeHold(tt, "GL-SHORT", [
        { variantId: "V2", quantity: 1 },
        { variantId: "V1", quantity: 4 },
      ], { locale: "es" })
    ).rejects.toThrow('Inventario insuficiente para "Cap V1". Solo hay 3 pieza(s) disponible(s).');
    expect(await getOrder(tt, "GL-SHORT")).toBeNull();
    expect(await getStock(tt, "V1")).toBe(3);
    expect(await getStock(tt, "V2")).toBe(5);
  });

  it("counts two lines on one stock pool together", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 3);
    await expect(
      placeHold(tt, "GL-SPLIT", [
        { variantId: "V1", quantity: 2 },
        { variantId: "V1", quantity: 2 },
      ])
    ).rejects.toThrow(/Only 3 unit\(s\) available/);
    expect(await getStock(tt, "V1")).toBe(3);
  });

  it("settling a held order marks it paid without deducting again, and alerts the admin", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const orderId = await placeHoldWithSession(tt, "GL-HOLD-PAY", "cs_holdpay");

    await settleStripe(tt, "GL-HOLD-PAY", "cs_holdpay", { eventId: "evt_holdpay" });

    const order = await getOrder(tt, "GL-HOLD-PAY");
    expect(lifecycle(order)).toEqual({ payment: "paid", fulfillment: "unfulfilled", cancelled: false });
    expect(await getStock(tt, "V1")).toBe(4);
    const scheduled = await tt.run(async (ctx) => await ctx.db.system.query("_scheduled_functions").collect());
    expect(scheduled.map((f) => f.name)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("sendAdminOrderAlert"),
        expect.stringContaining("sendCustomerReceipt"),
      ])
    );
    const events = await getEvents(tt, orderId);
    expect(events.filter((e) => e.type === "stripe_settled")).toHaveLength(1);
    await drain(tt);
  });

  it("an expired session cancels the order and releases its units exactly once", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const orderId = await placeHoldWithSession(tt, "GL-HOLD-EXP", "cs_holdexp", 2);
    expect(await getStock(tt, "V1")).toBe(3);

    const release = () =>
      tt.mutation(internal.orders.checkoutHold.releaseCheckoutHold, {
        orderId,
        stripeSessionId: "cs_holdexp",
        reason: "session_expired",
        webhookEventId: "evt_exp",
      });
    expect(await release()).toEqual({ released: true });
    expect(await release()).toEqual({ released: false });

    const order = await getOrder(tt, "GL-HOLD-EXP");
    expect(lifecycle(order)).toEqual({ payment: "awaiting_payment", fulfillment: "unfulfilled", cancelled: true });
    expect(order?.cancellationReason).toBe("checkout_expired");
    expect(order?.checkoutHoldReleasedAt).toBeTypeOf("number");
    expect(order?.webhookEventIds).toContain("evt_exp");
    expect(await getStock(tt, "V1")).toBe(5);
    const events = await getEvents(tt, orderId);
    expect(events.filter((e) => e.type === "inventory_released")).toHaveLength(1);
  });

  it("ignores a release for another session or a settled order", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const orderId = await placeHoldWithSession(tt, "GL-HOLD-X", "cs_holdx");

    expect(
      await tt.mutation(internal.orders.checkoutHold.releaseCheckoutHold, {
        orderId,
        stripeSessionId: "cs_someone_else",
        reason: "session_expired",
      })
    ).toEqual({ released: false });

    await settleStripe(tt, "GL-HOLD-X", "cs_holdx", { eventId: "evt_holdx" });
    expect(
      await tt.mutation(internal.orders.checkoutHold.releaseCheckoutHold, {
        orderId,
        stripeSessionId: "cs_holdx",
        reason: "backstop",
      })
    ).toEqual({ released: false });
    expect((await getOrder(tt, "GL-HOLD-X"))?.paymentStatus).toBe("paid");
    expect(await getStock(tt, "V1")).toBe(4);
    await drain(tt);
  });

  it("a failed session creation releases the hold it never recorded", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const orderId = await placeHold(tt, "GL-HOLD-FAIL", [{ variantId: "V1", quantity: 1 }]);
    expect(
      await tt.mutation(internal.orders.checkoutHold.releaseCheckoutHold, {
        orderId,
        reason: "session_creation_failed",
      })
    ).toEqual({ released: true });
    expect(await getStock(tt, "V1")).toBe(5);
  });

  it("the backstop finds only holds that ended 5+ minutes ago", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 10);
    const now = Date.now();
    const minute = 60 * 1000;
    // A hold that ended 6 minutes ago is overdue; one that ended 4 minutes ago may still get its webhook.
    await placeHold(tt, "GL-OLD", [{ variantId: "V1", quantity: 1 }], { holdExpiresAt: now - 6 * minute });
    await placeHold(tt, "GL-NEW", [{ variantId: "V1", quantity: 1 }], { holdExpiresAt: now - 4 * minute });
    await seedOrder(tt, "V1", { status: "pending", orderNumber: "GL-BARE" });
    // A released hold stays awaiting payment forever; the backstop must not keep finding it.
    const gone = await placeHold(tt, "GL-GONE", [{ variantId: "V1", quantity: 1 }], { holdExpiresAt: now - 29 * minute });
    await tt.mutation(internal.orders.checkoutHold.releaseCheckoutHold, { orderId: gone, reason: "session_creation_failed" });

    const overdue = await tt.query(internal.orders.checkoutHold.listOverdueCheckoutHolds, { now });
    expect(overdue.map((o) => o.orderNumber)).toEqual(["GL-OLD"]);
  });

  it("customers never see unpaid or released checkouts in their history", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const released = await placeHoldWithSession(tt, "GL-GONE", "cs_gone");
    await tt.mutation(internal.orders.checkoutHold.releaseCheckoutHold, {
      orderId: released,
      stripeSessionId: "cs_gone",
      reason: "abandoned",
    });
    await placeHoldWithSession(tt, "GL-OPEN", "cs_open");
    const paid = await seedOrder(tt, "V1", { orderNumber: "GL-PAID" });

    const orders = await customer(tt).query(api.orders.functions.getOrdersByClerkId, { clerkUserId: "user_cust" });
    expect(orders.map((o) => o.orderNumber)).toEqual([paid.orderNumber]);
  });

  it("an Administrator cancelling a held order releases its units", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const orderId = await placeHold(tt, "GL-HOLD-ADM", [{ variantId: "V1", quantity: 2 }]);
    await admin(tt).mutation(internal.orders.desk.cancelOrderAdmin, { orderId, refundStripe: false });
    expect(await getStock(tt, "V1")).toBe(5);
    expect(lifecycle(await getOrder(tt, "GL-HOLD-ADM"))).toEqual({
      payment: "awaiting_payment",
      fulfillment: "unfulfilled",
      cancelled: true,
    });
    await drain(tt);
  });
});

describe("updateFulfillmentStatusAdmin", () => {
  it("refuses an order awaiting payment and moves a paid one in transit", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const pending = await seedOrder(tt, "V1", { status: "pending" });
    await expect(
      admin(tt).mutation(api.orders.desk.updateFulfillmentStatusAdmin, {
        orderId: pending.orderId,
        fulfillmentStatus: "in_transit",
      })
    ).rejects.toThrow(/only change once the order is paid/);

    const order = await seedOrder(tt, "V1");
    await admin(tt).mutation(api.orders.desk.updateFulfillmentStatusAdmin, {
      orderId: order.orderId,
      fulfillmentStatus: "in_transit",
    });
    const after = await getOrder(tt, order.orderNumber);
    expect(lifecycle(after)).toEqual({ payment: "paid", fulfillment: "in_transit", cancelled: false });
    expect(after?.manualStatusOverride).toBeUndefined();
    await drain(tt);
  });

  it("refuses to deliver a fully refunded shipment by hand, and delivers a partially refunded one", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const refundBy = async (orderId: Doc<"orders">["_id"], orderNumber: string, refundedAmount: number, isFullRefund: boolean) =>
      await tt.mutation(internal.orders.settlement.recordStripeRefundInternal, {
        orderId,
        orderNumber,
        refundedAmount,
        isFullRefund,
        webhookEventId: `evt_${orderNumber}`,
      });

    const full = await seedOrder(tt, "V1", { status: "dispatched" });
    await refundBy(full.orderId, full.orderNumber, 100, true);
    await expect(
      admin(tt).mutation(api.orders.desk.updateFulfillmentStatusAdmin, { orderId: full.orderId, fulfillmentStatus: "delivered" })
    ).rejects.toThrow(/fully refunded/);
    expect(lifecycle(await getOrder(tt, full.orderNumber))).toEqual({ payment: "refunded", fulfillment: "in_transit", cancelled: false });

    const partial = await seedOrder(tt, "V1", { status: "dispatched" });
    await refundBy(partial.orderId, partial.orderNumber, 15, false);
    await admin(tt).mutation(api.orders.desk.updateFulfillmentStatusAdmin, { orderId: partial.orderId, fulfillmentStatus: "delivered" });
    expect(lifecycle(await getOrder(tt, partial.orderNumber))).toEqual({
      payment: "partially_refunded",
      fulfillment: "delivered",
      cancelled: false,
    });
    await drain(tt);
  });

  it("requires admin identity", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    const order = await seedOrder(tt, "V1");
    await expect(
      customer(tt).mutation(api.orders.desk.updateFulfillmentStatusAdmin, {
        orderId: order.orderId,
        fulfillmentStatus: "in_transit",
      })
    ).rejects.toThrow(/Unauthorized|Forbidden/);
    await drain(tt);
  });
});

describe("Public query PII containment", () => {
  async function seeded(tt: T) {
    await seedVariant(tt, "V1", 5);
    const lead = await seedOrder(tt, "V1", { email: "secret@test.com" });
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

  it("order-number lookup shows strangers nothing, and its owner no payment links or PII", async () => {
    const tt = t();
    const lead = await seeded(tt);
    expect(await tt.query(api.orders.functions.getOrderBySessionOrNumber, { identifier: lead.orderNumber })).toBeNull();
    expect(
      await tt.withIdentity({ subject: "user_stranger" }).query(api.orders.functions.getOrderBySessionOrNumber, { identifier: lead.orderNumber })
    ).toBeNull();

    await tt.run(async (ctx) => ctx.db.patch(lead.orderId, { clerkUserId: "user_cust" }));
    const order: any = await customer(tt).query(api.orders.functions.getOrderBySessionOrNumber, {
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

  it("tracking shows owner PII to a matching email only once it is verified", async () => {
    const tt = t();
    const lead = await seeded(tt);
    const lookup = (emailVerified: boolean) =>
      tt
        .withIdentity({ subject: "user_claimant", email: "secret@test.com", emailVerified })
        .query(api.orders.functions.getOrderByOrderNumberAndEmail, { orderNumber: lead.orderNumber, email: "secret@test.com" });
    expect(await lookup(false)).toMatchObject({ isLimitedView: true, shippingAddress: { line1: "***" } });
    expect(await lookup(true)).toMatchObject({ isLimitedView: false, shippingAddress: { line1: "123 Secret St" } });
    await drain(tt);
  });

  it("session-id lookup reveals delivery card PII but never payment links", async () => {
    const tt = t();
    await seeded(tt);
    const order: any = await tt.query(api.orders.functions.getOrderBySessionOrNumber, {
      identifier: "cs_test_demo1",
    });
    expect(order.shippingAddress?.line1).toBe("123 Secret St");
    expect(order.paymentUrl).toBeUndefined();
    expect(order.stripeSessionId).toBeUndefined();
    await drain(tt);
  });

  it("tracking and the confirmation view show a guest what was refunded", async () => {
    const tt = t();
    const lead = await seeded(tt);
    await tt.mutation(internal.orders.settlement.recordStripeRefundInternal, {
      orderId: lead.orderId,
      orderNumber: lead.orderNumber,
      refundedAmount: 100,
      isFullRefund: true,
      webhookEventId: "evt_goodwill",
    });
    const tracked = await tt.query(api.orders.functions.getOrderByOrderNumberAndEmail, {
      orderNumber: lead.orderNumber,
      email: "secret@test.com",
    });
    expect(tracked).toMatchObject({ isLimitedView: true, paymentStatus: "refunded", refundedAmount: 100, total: 100 });
    const confirmation = await tt.query(api.orders.functions.getOrderBySessionOrNumber, { identifier: "cs_test_demo1" });
    expect(confirmation).toMatchObject({ refundedAmount: 100 });
    await drain(tt);
  });

  it("account history gives a Customer their own Orders without the admin-only fields", async () => {
    const tt = t();
    const lead = await seeded(tt);
    await tt.run(async (ctx) =>
      ctx.db.patch(lead.orderId, {
        customerPhone: "+15550001111",
        adminNotes: "Chargeback risk, check ID",
        webhookEventIds: ["evt_secret"],
        stripeCustomerId: "cus_secret",
        stripeSessionIds: ["cs_test_demo1"],
        manualStatusOverride: true,
      })
    );

    const [order]: any[] = await customer(tt).query(api.orders.functions.getOrdersByClerkId, { clerkUserId: "user_cust" });
    // What the account page reads: its own address and phone, the line items, money and status.
    expect(order).toMatchObject({
      orderNumber: lead.orderNumber,
      shippingAddress: { line1: "123 Secret St" },
      customerPhone: "+15550001111",
      items: [{ variantId: "V1", quantity: 1 }],
      total: 100,
      paymentStatus: "paid",
    });
    for (const field of [
      "adminNotes",
      "webhookEventIds",
      "stripeCustomerId",
      "stripeSessionId",
      "stripeSessionIds",
      "manualStatusOverride",
      "paymentUrl",
      "clerkUserId",
    ]) {
      expect(order, field).not.toHaveProperty(field);
    }
    await drain(tt);
  });

  it("an Administrator reading a Customer's history gets the same safe view; a stranger is refused", async () => {
    const tt = t();
    const lead = await seeded(tt);
    await tt.run(async (ctx) => ctx.db.patch(lead.orderId, { adminNotes: "internal" }));

    const [order]: any[] = await admin(tt).query(api.orders.functions.getOrdersByClerkId, { clerkUserId: "user_cust" });
    expect(order.orderNumber).toBe(lead.orderNumber);
    expect(order).not.toHaveProperty("adminNotes");
    await expect(
      tt.withIdentity({ subject: "user_stranger" }).query(api.orders.functions.getOrdersByClerkId, { clerkUserId: "user_cust" })
    ).rejects.toThrow();
    await drain(tt);
  });

  it("email-gated tracking masks street/zip for unauthenticated guests", async () => {
    const tt = t();
    const lead = await seeded(tt);

    const wrongEmail = await tt.query(api.orders.functions.getOrderByOrderNumberAndEmail, {
      orderNumber: lead.orderNumber,
      email: "attacker@test.com",
    });
    expect(wrongEmail).toBeNull();

    const rightEmail: any = await tt.query(api.orders.functions.getOrderByOrderNumberAndEmail, {
      orderNumber: lead.orderNumber,
      email: "secret@test.com",
    });
    expect(rightEmail).not.toBeNull();
    expect(rightEmail.shippingAddress.line1).toBe("***");
    expect(rightEmail.shippingAddress.postalCode).toBe("***");
    expect(rightEmail.customerEmail).toBeUndefined();
    expect(rightEmail.customerPhone).toBeUndefined();
    expect(rightEmail.paymentUrl).toBeUndefined();
    await drain(tt);
  });
});

describe("Stripe Refund and Dispute Webhook Lifecycle", () => {
  it("handles full refund: marks Payment Status refunded, sets refundedAmount, and retains stock", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    await tt.mutation(internal.orders.settlement.createOrUpdateStripeOrder, {
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
    });

    expect(await getStock(tt, "V1")).toBe(3); // 5 - 2 = 3
    const orderBefore = await getOrder(tt, "GL-REFUND-1");
    expect(orderBefore?.paymentStatus).toBe("paid");

    // Full refund processed via webhook
    await tt.mutation(internal.orders.settlement.recordStripeRefundInternal, {
      orderId: orderBefore!._id,
      orderNumber: "GL-REFUND-1",
      refundedAmount: 100,
      isFullRefund: true,
      webhookEventId: "evt_refund_full",
      stripeChargeId: "ch_test_full",
    });

    const orderAfter = await getOrder(tt, "GL-REFUND-1");
    expect(lifecycle(orderAfter)).toEqual({ payment: "refunded", fulfillment: "unfulfilled", cancelled: false });
    expect(orderAfter?.refundedAmount).toBe(100);
    // Stock remains unchanged (manual restock only, physical goods safety)
    expect(await getStock(tt, "V1")).toBe(3);

    const events = await getEvents(tt, orderBefore!._id);
    expect(events.map((e) => e.type)).toContain("charge_refunded");

    // Replay idempotency
    await tt.mutation(internal.orders.settlement.recordStripeRefundInternal, {
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

  it("handles partial refund: marks Payment Status partially_refunded with cumulative amount", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    await tt.mutation(internal.orders.settlement.createOrUpdateStripeOrder, {
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
    });

    const order = await getOrder(tt, "GL-PARTIAL-1");

    await tt.mutation(internal.orders.settlement.recordStripeRefundInternal, {
      orderId: order!._id,
      orderNumber: "GL-PARTIAL-1",
      refundedAmount: 30,
      isFullRefund: false,
      webhookEventId: "evt_partial_1",
    });

    const orderAfter = await getOrder(tt, "GL-PARTIAL-1");
    expect(orderAfter?.paymentStatus).toBe("partially_refunded");
    expect(orderAfter?.refundedAmount).toBe(30);

    const events = await getEvents(tt, order!._id);
    expect(events.map((e) => e.type)).toContain("charge_partially_refunded");

    await drain(tt);
  });

  it("handles dispute lifecycle: flags order on opened and unflags on closed", async () => {
    const tt = t();
    await seedVariant(tt, "V1", 5);
    await tt.mutation(internal.orders.settlement.createOrUpdateStripeOrder, {
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
    });

    const order = await getOrder(tt, "GL-DISPUTE-1");
    expect(order?.disputed).toBeFalsy();

    // 1. Dispute opened
    await tt.mutation(internal.orders.settlement.recordStripeDisputeInternal, {
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
    expect(orderDisputed?.paymentStatus).toBe("disputed");
    expect(orderDisputed?.disputeDetails).toContain("CHARGEBACK DISPUTE");
    expect(orderDisputed?.adminNotes).toContain("Respond in Stripe Dashboard");

    const events = await getEvents(tt, order!._id);
    expect(events.map((e) => e.type)).toContain("dispute_created");

    // 2. Dispute closed (won)
    await tt.mutation(internal.orders.settlement.recordStripeDisputeInternal, {
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
    expect(orderResolved?.paymentStatus).toBe("paid");
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
    await tt.mutation(internal.orders.settlement.createOrUpdateStripeOrder, {
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
    });

    const order = await getOrder(tt, "GL-CUST-1");
    expect(order?.stripeCustomerId).toBe("cus_test_999");
    expect(order?.paymentStatus).toBe("paid");

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
    await tt.mutation(internal.orders.settlement.createOrUpdateStripeOrder, {
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
    });

    let order = await getOrder(tt, "GL-INV-1");
    expect(order?.stripeInvoiceId).toBe("in_12345");
    expect(order?.invoicePdfUrl).toBe("https://stripe.com/invoice_12345.pdf");
    expect(order?.hostedInvoiceUrl).toBe("https://invoice.stripe.com/i/acct_123/inv_12345");

    // 2. Asynchronous invoice.paid webhook attaches / updates PDF URL
    const res = await tt.mutation(internal.orders.settlement.attachStripeInvoiceInternal, {
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
  it("attaches shipping label, moves Fulfillment Status to label purchased, and logs audit event", async () => {
    const tt = t();
    await seedVariant(tt, "V_CAP1", 10, 150);

    // 1. Create a paid order
    await tt.mutation(internal.orders.settlement.createOrUpdateStripeOrder, {
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
    });

    let order = await getOrder(tt, "GL-SHIP-01");
    expect(order?.paymentStatus).toBe("paid");
    expect(order?.shippingLabelUrl).toBeUndefined();

    // 2. Attach shipping label purchased via Shippo
    const res = await tt.mutation(internal.orders.fulfillment.attachShippingLabelInternal, {
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
    expect(res.fulfillmentStatus).toBe("label_purchased");
    expect(res.trackingNumber).toBe("9400111899223344556677");

    // 3. Verify order document in Convex
    order = await getOrder(tt, "GL-SHIP-01");
    expect(lifecycle(order)).toEqual({ payment: "paid", fulfillment: "label_purchased", cancelled: false });
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
    await tt.mutation(internal.orders.settlement.createOrUpdateStripeOrder, {
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
    });

    let order = await getOrder(tt, "GL-DELIV-01");
    await tt.mutation(internal.orders.fulfillment.attachShippingLabelInternal, {
      orderId: order!._id,
      carrier: "USPS",
      trackingNumber: "9400111899000000000001",
      shippingLabelUrl: "https://delivery.goshippo.com/deliv_label.pdf",
    });

    order = await getOrder(tt, "GL-DELIV-01");
    expect(order?.fulfillmentStatus).toBe("label_purchased");

    // 2. Incoming carrier webhook: DELIVERED
    const webhookRes = await tt.mutation(internal.orders.fulfillment.handleTrackingWebhookInternal, {
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
    expect(webhookRes.fulfillmentStatus).toBe("delivered");

    order = await getOrder(tt, "GL-DELIV-01");
    expect(lifecycle(order)).toEqual({ payment: "paid", fulfillment: "delivered", cancelled: false });
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

    await tt.mutation(internal.orders.settlement.createOrUpdateStripeOrder, {
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
    });

    let order = await getOrder(tt, "GL-FAIL-01");
    await tt.mutation(internal.orders.fulfillment.attachShippingLabelInternal, {
      orderId: order!._id,
      carrier: "UPS",
      trackingNumber: "1Z9999999900000002",
      shippingLabelUrl: "https://delivery.goshippo.com/fail_label.pdf",
    });

    // Incoming carrier webhook: FAILURE (no access code)
    const res = await tt.mutation(internal.orders.fulfillment.handleTrackingWebhookInternal, {
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
    expect(order?.fulfillmentStatus).toBe("delivery_exception");
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

    await tt.mutation(internal.orders.settlement.createOrUpdateStripeOrder, {
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
    });

    let order = await getOrder(tt, "GL-OVER-01");
    await tt.mutation(internal.orders.fulfillment.attachShippingLabelInternal, {
      orderId: order!._id,
      carrier: "USPS",
      trackingNumber: "9400111899000000000003",
      shippingLabelUrl: "https://delivery.goshippo.com/over_label.pdf",
    });

    // Carrier scans DELIVERED
    await tt.mutation(internal.orders.fulfillment.handleTrackingWebhookInternal, {
      trackingNumber: "9400111899000000000003",
      status: "DELIVERED",
      statusDetails: "Delivered",
    });

    order = await getOrder(tt, "GL-OVER-01");
    expect(order?.fulfillmentStatus).toBe("delivered");

    // Human admin investigates missing parcel and manually reverts to in transit
    await admin(tt).mutation(api.orders.desk.updateFulfillmentStatusAdmin, {
      orderId: order!._id,
      fulfillmentStatus: "in_transit",
      adminNotes: "Customer called concierge: package not at porch, checking with neighbor.",
    });

    order = await getOrder(tt, "GL-OVER-01");
    expect(order?.fulfillmentStatus).toBe("in_transit");
    expect(order?.manualStatusOverride).toBe(true);

    // Another DELIVERED webhook arrives from carrier (e.g. carrier system sync)
    const subsequentRes = await tt.mutation(internal.orders.fulfillment.handleTrackingWebhookInternal, {
      trackingNumber: "9400111899000000000003",
      status: "DELIVERED",
      statusDetails: "Delivered scan re-transmitted",
    });

    expect(subsequentRes.fulfillmentStatus).toBe("in_transit"); // Blocked from overwriting!
    order = await getOrder(tt, "GL-OVER-01");
    expect(order?.fulfillmentStatus).toBe("in_transit"); // Still in transit!

    await drain(tt);
  });
});




