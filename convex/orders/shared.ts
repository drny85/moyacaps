/**
 * Database helpers shared by the order modules (orders, orderSettlement,
 * whatsappOrders, orderDesk, orderFulfillment).
 */
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { adjustStock } from "../catalog/inventory";
import { orderNumberCandidates } from "./model";

type OrderItem = Doc<"orders">["items"][number];

export async function getOrderByNumber(ctx: QueryCtx, orderNumber: string) {
  return await ctx.db
    .query("orders")
    .withIndex("by_orderNumber", (q) => q.eq("orderNumber", orderNumber))
    .first();
}

export async function getOrderByStripeSessionId(ctx: QueryCtx, stripeSessionId: string) {
  return await ctx.db
    .query("orders")
    .withIndex("by_stripeSessionId", (q) => q.eq("stripeSessionId", stripeSessionId))
    .first();
}

/** Typed order-number lookup: exact, then "GL-" and legacy "MC-" prefixes (see orderNumberCandidates). */
export async function findOrderByTypedNumber(ctx: QueryCtx, input: string) {
  for (const candidate of orderNumberCandidates(input)) {
    const order = await getOrderByNumber(ctx, candidate);
    if (order) return order;
  }
  return null;
}

/** Deduct every line's units (sale or reservation). */
export async function deductStock(ctx: MutationCtx, items: OrderItem[]) {
  for (const item of items) {
    await adjustStock(ctx, item, -item.quantity);
  }
}

/** Give every line's units back (cancellation or expired reservation). */
export async function releaseStock(ctx: MutationCtx, items: OrderItem[]) {
  for (const item of items) {
    await adjustStock(ctx, item, item.quantity);
  }
}

/** Mirror a Stripe customer id onto the registered user, once. */
export async function mirrorStripeCustomerToUser(ctx: MutationCtx, clerkUserId?: string, stripeCustomerId?: string) {
  if (!clerkUserId || !stripeCustomerId) return;
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkUserId))
    .first();
  if (user && !user.stripeCustomerId) {
    await ctx.db.patch(user._id, {
      stripeCustomerId,
      updatedAt: Date.now(),
    });
  }
}

/** Expire any still-open Stripe Checkout session so a link cannot be paid against released stock. */
export async function scheduleSessionExpiry(ctx: MutationCtx, orderId: Doc<"orders">["_id"]) {
  await ctx.scheduler.runAfter(0, internal.payments.checkout.expireOpenCheckoutSessionsInternal, { orderId });
}

export const hasEmail = (email?: string): email is string => Boolean(email && email.includes("@"));
