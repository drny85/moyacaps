/**
 * Checkout Hold writes (ADR 0024): Pay creates an Order awaiting payment and takes its units in one
 * transaction; the hold ends in settlement (orders/settlement.ts) or, once Stripe reports
 * the Checkout Session expired, in release. Called only by the Stripe actions.
 */
import { internalMutation, internalQuery } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { checkStock } from "../catalog/inventory";
import { holdShortageError, lineStockError } from "../payments/checkoutModel";
import {
  appendBoundedId,
  backstopHoldExpiryCutoff,
  BACKSTOP_BATCH_SIZE,
  canReleaseCheckoutHold,
  checkoutHoldReleasePatch,
  holdDemand,
  planCheckoutHold,
  withWebhookEventId,
} from "./model";
import { deductStock, releaseStock } from "./shared";
import { normalizeEmail } from "./guestClaimModel";
import { orderDoc, orderItemValidator } from "./validators";

/**
 * INTERNAL: create the Order (awaiting payment) for a Pay click and take its units atomically. Every
 * stock pool is re-read inside this transaction, so two Customers can never hold the same
 * last unit. Throws a customer-facing ConvexError when any line is short; never clamps.
 */
export const placeCheckoutHold = internalMutation({
  args: {
    orderNumber: v.string(),
    items: v.array(orderItemValidator),
    currency: v.string(),
    subtotal: v.number(),
    shippingFee: v.number(),
    total: v.number(),
    clerkUserId: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    checkoutHoldExpiresAt: v.number(),
    locale: v.string(),
  },
  returns: v.id("orders"),
  handler: async (ctx, args) => {
    const available = new Map<string, number>();
    for (const { key, line } of holdDemand(args.items)) {
      const check = await checkStock(ctx, line);
      if (!check.ok) {
        throw new ConvexError(lineStockError(check.reason, line.name, args.locale === "es"));
      }
      available.set(key, check.available);
    }

    const plan = planCheckoutHold(args.items, available);
    if (!plan.ok) {
      throw new ConvexError(holdShortageError(plan.line.name, plan.available, args.locale));
    }

    const now = Date.now();
    const orderId = await ctx.db.insert("orders", {
      orderNumber: args.orderNumber,
      customerEmail: normalizeEmail(args.customerEmail),
      clerkUserId: args.clerkUserId,
      items: args.items,
      currency: args.currency,
      subtotal: args.subtotal,
      shippingFee: args.shippingFee,
      total: args.total,
      paymentStatus: "awaiting_payment",
      fulfillmentStatus: "unfulfilled",
      paymentMethod: "stripe",
      checkoutHoldExpiresAt: args.checkoutHoldExpiresAt,
      createdAt: now,
    });
    await deductStock(ctx, args.items);

    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId,
      orderNumber: args.orderNumber,
      type: "checkout_hold_placed",
      actor: "system",
      details: `Checkout Hold until ${new Date(args.checkoutHoldExpiresAt).toISOString()}`,
    });
    return orderId;
  },
});

/** INTERNAL: record the Checkout Session created for a held Order. */
export const attachCheckoutSession = internalMutation({
  args: {
    orderId: v.id("orders"),
    stripeSessionId: v.string(),
    paymentUrl: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) return null;
    await ctx.db.patch(args.orderId, {
      stripeSessionId: args.stripeSessionId,
      stripeSessionIds: appendBoundedId(order.stripeSessionIds, args.stripeSessionId),
      paymentUrl: args.paymentUrl,
      updatedAt: Date.now(),
    });
    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId: args.orderId,
      orderNumber: order.orderNumber,
      type: "link_generated",
      stripeSessionId: args.stripeSessionId,
      actor: "system",
    });
    return null;
  },
});

/**
 * INTERNAL: release a Checkout Hold. Callers invoke this only after Stripe has reported the
 * session expired or its delayed payment failed (webhook event, or an expire/retrieve
 * response), or when no session was ever created. Idempotent: a hold already settled, released or replaced is left alone.
 */
export const releaseCheckoutHold = internalMutation({
  args: {
    orderId: v.id("orders"),
    // The hold's own session; omitted only when session creation failed.
    stripeSessionId: v.optional(v.string()),
    reason: v.union(
      v.literal("session_expired"),
      v.literal("async_payment_failed"),
      v.literal("session_creation_failed"),
      v.literal("replaced"),
      v.literal("abandoned"),
      v.literal("backstop")
    ),
    webhookEventId: v.optional(v.string()),
  },
  returns: v.object({ released: v.boolean() }),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order || !canReleaseCheckoutHold(order, args.stripeSessionId)) {
      return { released: false };
    }

    const now = Date.now();
    await releaseStock(ctx, order.items);
    await ctx.db.patch(args.orderId, {
      ...checkoutHoldReleasePatch(order, now),
      webhookEventIds: withWebhookEventId(order, args.webhookEventId),
      updatedAt: now,
    });
    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId: args.orderId,
      orderNumber: order.orderNumber,
      type: "inventory_released",
      stripeEventId: args.webhookEventId,
      stripeSessionId: args.stripeSessionId,
      actor: args.webhookEventId ? "stripe_webhook" : "system",
      details: `Checkout Hold released (${args.reason})`,
    });
    return { released: true };
  },
});

/** INTERNAL: Orders still awaiting payment 5+ minutes after their hold ended, oldest first (backstop). */
export const listOverdueCheckoutHolds = internalQuery({
  args: { now: v.number() },
  returns: v.array(orderDoc),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_paymentStatus_and_cancelledAt_and_checkoutHoldExpiresAt", (q) =>
        q
          .eq("paymentStatus", "awaiting_payment")
          .eq("cancelledAt", undefined)
          .gte("checkoutHoldExpiresAt", 0)
          .lte("checkoutHoldExpiresAt", backstopHoldExpiryCutoff(args.now))
      )
      .take(BACKSTOP_BATCH_SIZE);
  },
});
