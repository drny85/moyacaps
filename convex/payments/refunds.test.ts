/// <reference types="vite/client" />
/**
 * The money-back actions in payments/refunds.ts end to end through Convex, with the Stripe
 * Refunds call stubbed (security review M11): who may call each action, the reserve → Stripe →
 * commit/fail order, idempotent double submits, and the pending-then-retry path.
 */
import { convexTest } from "convex-test";
import aggregateTest from "@convex-dev/aggregate/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";

const stripe = vi.hoisted(() => ({ refund: vi.fn() }));

vi.mock("./stripeClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./stripeClient")>()),
  getStripe: () => ({}),
  refundCheckoutSession: stripe.refund,
}));

const modules = import.meta.glob("/convex/**/*.ts");
// orderStats: every order write updates the dashboard aggregate (analytics/orderStats.ts).
function t() {
  const tt = convexTest(schema, modules);
  aggregateTest.register(tt, "orderStats");
  return tt;
}
type T = ReturnType<typeof t>;

const OWNER = "user_owner";
const admin = (tt: T) => tt.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL, emailVerified: true });
const owner = (tt: T) => tt.withIdentity({ subject: OWNER });
const stranger = (tt: T) => tt.withIdentity({ subject: "user_stranger" });

/** A Stripe SDK error as refundErrorOutcome sees it. */
const stripeError = (type: string, message: string) => Object.assign(new Error(message), { type });

async function paidOrder(tt: T, orderNumber = "GL-REFUND-1"): Promise<Id<"orders">> {
  await tt.run(async (ctx) => {
    await ctx.db.insert("variants", {
      variantId: "V1",
      isAvailable: true,
      nameEn: "Cap V1",
      nameEs: "Gorra V1",
      silhouette: "snapback",
      primaryHex: "#000000",
      secondaryHex: "#ffffff",
      image: "/img.png",
      stock: 5,
      priceUsd: 50,
      isFeatured: false,
    });
  });
  return await tt.mutation(internal.orders.settlement.createOrUpdateStripeOrder, {
    stripeSessionId: `cs_test_${orderNumber}`,
    orderNumber,
    customerEmail: "buyer@test.com",
    customerName: "Ana Buyer",
    clerkUserId: OWNER,
    items: [{ variantId: "V1", name: "Cap V1", quantity: 2, price: 50, image: "/img.png" }],
    currency: "USD",
    subtotal: 100,
    shippingFee: 8,
    tax: 9.68,
    total: 117.68,
    webhookEventId: `evt_settle_${orderNumber}`,
  });
}

async function ledger(tt: T, orderId: Id<"orders">) {
  return await tt.run(async (ctx) =>
    ctx.db
      .query("order_refunds")
      .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
      .take(10)
  );
}

async function adminAlertsScheduled(tt: T) {
  const jobs = await tt.run(async (ctx) => ctx.db.system.query("_scheduled_functions").take(50));
  return jobs.filter((job) => job.name.endsWith("sendAdminAlert")).length;
}

const goodwill = (orderId: Id<"orders">, requestId: string) => ({
  orderId,
  requestId,
  request: { kind: "goodwill" as const, amountCents: 1500, reason: "Late delivery" },
});

beforeEach(() => {
  stripe.refund.mockReset();
  stripe.refund.mockImplementation(async () => ({ id: `re_${stripe.refund.mock.calls.length}` }));
});

describe("refundOrder", () => {
  it("refuses callers who are not Administrators before reserving anything", async () => {
    const tt = t();
    const orderId = await paidOrder(tt);
    await expect(owner(tt).action(api.payments.refunds.refundOrder, goodwill(orderId, "req-1"))).rejects.toThrow(/Forbidden/);
    await expect(tt.action(api.payments.refunds.refundOrder, goodwill(orderId, "req-1"))).rejects.toThrow(/Unauthorized/);
    expect(stripe.refund).not.toHaveBeenCalled();
    expect(await ledger(tt, orderId)).toHaveLength(0);
  });

  it("issues once per requestId, so a double submit never refunds twice", async () => {
    const tt = t();
    const orderId = await paidOrder(tt);
    const first = await admin(tt).action(api.payments.refunds.refundOrder, goodwill(orderId, "req-1"));
    const again = await admin(tt).action(api.payments.refunds.refundOrder, goodwill(orderId, "req-1"));

    expect(first).toMatchObject({ status: "issued", amountCents: 1500 });
    expect(again).toEqual(first);
    expect(stripe.refund).toHaveBeenCalledTimes(1);
    const [, params] = stripe.refund.mock.calls[0];
    expect(params).toMatchObject({ sessionId: "cs_test_GL-REFUND-1", amountCents: 1500 });
    expect(params.idempotencyKey).toEqual(expect.any(String));
    expect(await ledger(tt, orderId)).toMatchObject([{ status: "issued", stripeRefundId: "re_1" }]);
  });

  it("fails the ledger row when Stripe refuses for good", async () => {
    const tt = t();
    const orderId = await paidOrder(tt);
    stripe.refund.mockRejectedValueOnce(stripeError("StripeInvalidRequestError", "Charge already refunded"));

    const outcome = await admin(tt).action(api.payments.refunds.refundOrder, goodwill(orderId, "req-1"));
    expect(outcome).toMatchObject({ status: "failed", error: "Charge already refunded" });
    expect(await ledger(tt, orderId)).toMatchObject([{ status: "failed" }]);
  });

  it("leaves an ambiguous Stripe error pending, alerts the Administrator, and retries with the same key", async () => {
    const tt = t();
    const orderId = await paidOrder(tt);
    stripe.refund.mockRejectedValueOnce(stripeError("StripeConnectionError", "socket hang up"));

    const pending = await admin(tt).action(api.payments.refunds.refundOrder, goodwill(orderId, "req-1"));
    expect(pending).toMatchObject({ status: "pending", error: "socket hang up" });
    expect(await adminAlertsScheduled(tt)).toBeGreaterThan(0);
    expect(await ledger(tt, orderId)).toMatchObject([{ status: "pending" }]);

    await expect(owner(tt).action(api.payments.refunds.retryRefund, { refundId: pending.refundId })).rejects.toThrow(/Forbidden/);
    const retried = await admin(tt).action(api.payments.refunds.retryRefund, { refundId: pending.refundId });
    expect(retried).toMatchObject({ status: "issued", refundId: pending.refundId });
    expect(stripe.refund).toHaveBeenCalledTimes(2);
    expect(stripe.refund.mock.calls[1][1].idempotencyKey).toBe(stripe.refund.mock.calls[0][1].idempotencyKey);

    // Issued now, so it is no longer retryable.
    await expect(admin(tt).action(api.payments.refunds.retryRefund, { refundId: pending.refundId })).rejects.toThrow(
      /Only a pending refund/
    );
  });
});

describe("cancelAndRefundOrder", () => {
  it("needs the signed-in owner", async () => {
    const tt = t();
    const orderId = await paidOrder(tt);
    await expect(tt.action(api.payments.refunds.cancelAndRefundOrder, { orderId })).rejects.toThrow(/Authentication required/);
    await expect(stranger(tt).action(api.payments.refunds.cancelAndRefundOrder, { orderId })).rejects.toThrow();
    expect(stripe.refund).not.toHaveBeenCalled();
  });

  it("cancels and refunds the owner's paid Order in full", async () => {
    const tt = t();
    const orderId = await paidOrder(tt);
    const result = await owner(tt).action(api.payments.refunds.cancelAndRefundOrder, { orderId });
    expect(result).toMatchObject({ success: true, refundIssued: true, orderNumber: "GL-REFUND-1" });
    expect(stripe.refund).toHaveBeenCalledTimes(1);
    expect(stripe.refund.mock.calls[0][1].amountCents).toBe(11768);
  });
});

describe("cancelAndRefundOrderAdmin", () => {
  it("is Administrator-only and reports a pending refund instead of failing the cancellation", async () => {
    const tt = t();
    const orderId = await paidOrder(tt);
    await expect(
      owner(tt).action(api.payments.refunds.cancelAndRefundOrderAdmin, { orderId, refundStripe: true })
    ).rejects.toThrow(/Forbidden/);

    stripe.refund.mockRejectedValueOnce(stripeError("StripeAPIError", "Stripe is down"));
    const result = await admin(tt).action(api.payments.refunds.cancelAndRefundOrderAdmin, { orderId, refundStripe: true });
    expect(result).toMatchObject({ success: true, refundIssued: false, refundError: "Stripe is down" });
    expect(result.message).toMatch(/pending/);
  });
});
