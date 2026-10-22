/**
 * Order Timeline reads (CONTEXT.md "Order Timeline"). The rules that build it live in
 * ./timeline.ts; scans are stored by ./trackingEvents.ts.
 */
import { v } from "convex/values";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";
import { adminTimeline, adminTimelineEntryValidator, customerTimeline, type CustomerTimelineEntry } from "./timeline";
import { listTrackingScans } from "./trackingEvents";

/** Event log rows read per Order; an Order's whole life is a few dozen. */
const EVENTS_LIMIT = 200;

async function orderEvents(ctx: QueryCtx, orderId: Id<"orders">) {
  return await ctx.db
    .query("payment_events")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .take(EVENTS_LIMIT);
}

/** The Customer's timeline for an Order the caller may already see (the track lookup). */
export async function customerTimelineFor(ctx: QueryCtx, order: Doc<"orders">): Promise<CustomerTimelineEntry[]> {
  const [events, scans] = await Promise.all([orderEvents(ctx, order._id), listTrackingScans(ctx, order._id)]);
  const paidAt = events.find((e) => e.type === "stripe_settled")?.createdAt;
  return customerTimeline(order, { ...(paidAt !== undefined && { paidAt }), scans });
}

/** Admin: everything that happened to the Order, newest first. */
export const getOrderTimelineAdmin = query({
  args: { orderId: v.id("orders") },
  returns: v.array(adminTimelineEntryValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) return [];
    const [events, scans] = await Promise.all([orderEvents(ctx, order._id), listTrackingScans(ctx, order._id)]);
    return adminTimeline(order, {
      events: events.map((e) => ({
        type: e.type,
        createdAt: e.createdAt,
        ...(e.details !== undefined && { details: e.details }),
        ...(e.actor !== undefined && { actor: e.actor }),
      })),
      scans,
    });
  },
});
