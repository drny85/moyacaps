/**
 * Administrator Handoffs (ADR 0030): record, correct or remove when a Ready to Ship package was
 * picked up by or dropped off with the carrier. Rules live in ./handoff.ts.
 */
import { v, ConvexError } from "convex/values";
import { query } from "../_generated/server";
import { mutation } from "../lib/functions";
import { requireAdmin } from "../lib/auth";
import { handoffMethodValidator } from "./labels";
import { MAX_NOTE_LENGTH, currentHandoff, handoffFlag, planClearHandoff, planHandoff } from "./handoff";
import { insertPaymentEvent } from "./paymentEvents";
import { scheduleShippedEmail } from "./shippedNotice";

/** Orders one bulk Handoff may cover: a day's packages, with room to spare. */
const MAX_BULK = 50;

const METHOD_WORDS = { picked_up: "picked up by", dropped_off: "dropped off with" } as const;

/**
 * Records one Handoff (same method, time and note) on each Order. Each Order is checked on its
 * own: one that was scanned meanwhile is reported, not fatal. The Customer is told the package
 * shipped the first time.
 */
export const recordHandoff = mutation({
  args: {
    orderIds: v.array(v.id("orders")),
    method: handoffMethodValidator,
    at: v.number(),
    note: v.optional(v.string()),
  },
  returns: v.object({
    results: v.array(
      v.object({ orderId: v.id("orders"), orderNumber: v.string(), ok: v.boolean(), error: v.optional(v.string()) })
    ),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const orderIds = [...new Set(args.orderIds)];
    if (orderIds.length === 0) throw new ConvexError("Choose at least one order.");
    if (orderIds.length > MAX_BULK) throw new ConvexError(`Mark at most ${MAX_BULK} orders at once.`);
    if (args.note !== undefined && args.note.length > MAX_NOTE_LENGTH * 2) throw new ConvexError("The note is too long.");

    const now = Date.now();
    const results = [];
    for (const orderId of orderIds) {
      const order = await ctx.db.get(orderId);
      if (!order) {
        results.push({ orderId, orderNumber: "", ok: false, error: "Order not found." });
        continue;
      }
      const plan = planHandoff(order, { method: args.method, at: args.at, note: args.note, actor: admin.subject }, now);
      if (!plan.ok) {
        results.push({ orderId, orderNumber: order.orderNumber, ok: false, error: plan.error });
        continue;
      }
      await ctx.db.patch(orderId, { labels: plan.labels, updatedAt: now });
      const carrier = plan.labels[plan.labels.length - 1].carrier;
      await insertPaymentEvent(ctx, {
        orderId,
        orderNumber: order.orderNumber,
        type: plan.correction ? "handoff_corrected" : "handoff_recorded",
        actor: admin.subject,
        details: `Package ${METHOD_WORDS[args.method]} ${carrier}`,
      });
      if (plan.notifyShipped) await scheduleShippedEmail(ctx, order, { carrier });
      results.push({ orderId, orderNumber: order.orderNumber, ok: true });
    }
    return { results };
  },
});

/** Removes a mistaken Handoff while the Order is still Ready to Ship. */
export const clearHandoff = mutation({
  args: { orderId: v.id("orders") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Order not found.");
    const plan = planClearHandoff(order);
    if (!plan.ok) throw new ConvexError(plan.error);
    await ctx.db.patch(args.orderId, { labels: plan.labels, updatedAt: Date.now() });
    await insertPaymentEvent(ctx, {
      orderId: args.orderId,
      orderNumber: order.orderNumber,
      type: "handoff_removed",
      actor: admin.subject,
      details: "Handoff removed",
    });
    return null;
  },
});

/** Ready to Ship orders read for the desk counters; a busy week is far below this. */
const ATTENTION_WINDOW = 500;

/**
 * Admin: counters for the Orders desk chips. `clientTime` (minute granularity) drives the
 * flags, since a query must not read the clock.
 */
export const handoffAttention = query({
  args: { clientTime: v.number() },
  returns: v.union(v.null(), v.object({ readyToShip: v.number(), notHandedOff: v.number(), noScan: v.number() })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    await requireAdmin(ctx);
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_fulfillmentStatus", (q) => q.eq("fulfillmentStatus", "label_purchased"))
      .take(ATTENTION_WINDOW);
    let readyToShip = 0;
    let notHandedOff = 0;
    let noScan = 0;
    for (const order of orders) {
      if (order.cancelledAt !== undefined) continue;
      if (!currentHandoff(order)) readyToShip++;
      const flag = handoffFlag(order, args.clientTime);
      if (flag === "not_handed_off") notHandedOff++;
      if (flag === "no_scan") noScan++;
    }
    return { readyToShip, notHandedOff, noScan };
  },
});
