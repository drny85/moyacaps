/**
 * Administrator Packing Checklist (CONTEXT.md "Packing Checklist"; plan 0012): tick units off
 * while the Order can get a label, read the list, and read progress for the Orders desk. Rules
 * live in ./packing.ts; refunded units come from the refund ledger.
 */
import { v, ConvexError } from "convex/values";
import { query } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { mutation } from "../lib/functions";
import { requireAdmin } from "../lib/auth";
import { readLedger } from "../payments/refundLedger";
import { refundedQuantities } from "../payments/refundModel";
import { insertPaymentEvent } from "./paymentEvents";
import { packingView, planCheck } from "./packing";

/** Orders one progress read may cover: the desk shows at most this many rows. */
const MAX_PROGRESS_ORDERS = 100;

const packingViewValidator = v.object({
  editable: v.boolean(),
  lines: v.array(v.object({ remaining: v.number(), checked: v.number(), overflow: v.number() })),
  checkedUnits: v.number(),
  totalUnits: v.number(),
  uncheckedUnits: v.number(),
  complete: v.boolean(),
});

async function refundedFor(ctx: QueryCtx, order: Doc<"orders">): Promise<number[]> {
  return refundedQuantities(order, await readLedger(ctx, order._id));
}

/** Checks (`delta` 1) or un-checks (`delta` -1) one unit. Logs the completion once per checklist. */
export const checkUnit = mutation({
  args: { orderId: v.id("orders"), lineIndex: v.number(), delta: v.union(v.literal(1), v.literal(-1)) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) throw new ConvexError("Order not found.");
    const now = Date.now();
    const plan = planCheck(order, await refundedFor(ctx, order), args.lineIndex, args.delta, now);
    if (!plan.ok) throw new ConvexError(plan.error);
    await ctx.db.patch(args.orderId, { packingChecklist: plan.checklist, updatedAt: now });
    if (plan.completed) {
      await insertPaymentEvent(ctx, {
        orderId: args.orderId,
        orderNumber: order.orderNumber,
        type: "packing_checklist_completed",
        actor: admin.subject,
        details: "Every unit Checked",
      });
    }
    return null;
  },
});

/** Admin: the Order's Packing Checklist, or null when signed out or the Order is gone. */
export const getPackingChecklistAdmin = query({
  args: { orderId: v.id("orders") },
  returns: v.union(packingViewValidator, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) return null;
    return packingView(order, await refundedFor(ctx, order));
  },
});

/** Admin: Checked and total units for each Order, in the order asked; missing Orders are left out. */
export const packingProgressAdmin = query({
  args: { orderIds: v.array(v.id("orders")) },
  returns: v.array(
    v.object({ orderId: v.id("orders"), checkedUnits: v.number(), totalUnits: v.number(), complete: v.boolean() })
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    await requireAdmin(ctx);
    const results = [];
    for (const orderId of args.orderIds.slice(0, MAX_PROGRESS_ORDERS)) {
      const order = await ctx.db.get(orderId);
      if (!order) continue;
      const view = packingView(order, await refundedFor(ctx, order));
      results.push({ orderId, checkedUnits: view.checkedUnits, totalUnits: view.totalUnits, complete: view.complete });
    }
    return results;
  },
});
