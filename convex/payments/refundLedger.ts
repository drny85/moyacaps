/**
 * Refund ledger writes (plan 0008 "Money back"): reserve a refund before calling Stripe, then
 * mark it issued (and Restock the lines the Administrator chose) or failed. The rules live in
 * refundModel.ts; the Stripe calls in refunds.ts. Payment Status is never written here: the
 * `charge.refunded` webhook records it (orders/settlement.ts recordStripeRefundInternal).
 */
import { internalQuery, query } from "../_generated/server";
import { internalMutation } from "../lib/functions";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { adjustStock } from "../catalog/inventory";
import { isCancelled } from "../orders/status";
import { appendNote } from "../orders/model";
import schema from "../schema";
import {
  describeRefund,
  formatCents,
  planGoodwillRefund,
  planLineRefund,
  planReturn,
  refundIdempotencyKey,
  reservationValidator,
  adminRefundRequestValidator,
  type RefundPlan,
  type Reservation,
  type ReturnReason,
} from "./refundModel";
import { decideRefundFailure } from "./refundFailureModel";
import { hasEmail } from "../orders/shared";
import { refundIssuedNotice, refundProblemAlert } from "../notifications/orderEmails";

type Order = Doc<"orders">;
type RefundRow = Doc<"order_refunds">;

/** Refunds read per Order. An Order has a handful; this only bounds the read. */
const MAX_LEDGER_ROWS = 200;

export async function readLedger(ctx: QueryCtx, orderId: Id<"orders">): Promise<RefundRow[]> {
  return await ctx.db
    .query("order_refunds")
    .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
    .take(MAX_LEDGER_ROWS);
}

async function rowForRequest(ctx: QueryCtx, requestId: string): Promise<RefundRow | null> {
  return await ctx.db
    .query("order_refunds")
    .withIndex("by_requestId", (q) => q.eq("requestId", requestId))
    .unique();
}

function toReservation(row: RefundRow, order: Order): Reservation {
  if (row.status === "failed") {
    throw new ConvexError(`This refund already failed (${row.error ?? "Stripe refused it"}). Start a new refund.`);
  }
  if (!order.stripeSessionId) throw new ConvexError("Order has no Stripe payment to refund.");
  return {
    refundId: row._id,
    orderNumber: row.orderNumber,
    kind: row.kind,
    stripeSessionId: order.stripeSessionId,
    amountCents: row.amountCents,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
  };
}

/** The reservation a repeated request already wrote, or null for a new request. */
export async function repeatedReservation(ctx: QueryCtx, order: Order, requestId: string): Promise<Reservation | null> {
  const repeated = await rowForRequest(ctx, requestId);
  if (!repeated) return null;
  if (repeated.orderId !== order._id) throw new ConvexError("Refund request id belongs to another order.");
  return toReservation(repeated, order);
}

/**
 * Write a planned refund as pending, or return the row a repeated request already wrote. Called
 * inside the mutation that planned it, so two concurrent refunds can never both claim a line.
 */
export async function reserveRefund(
  ctx: MutationCtx,
  order: Order,
  plan: RefundPlan,
  meta: { requestId: string; actor: string; reason?: string; returnReason?: ReturnReason }
): Promise<Reservation> {
  const repeated = await repeatedReservation(ctx, order, meta.requestId);
  if (repeated) return repeated;
  const now = Date.now();
  const refundId = await ctx.db.insert("order_refunds", {
    orderId: order._id,
    orderNumber: order.orderNumber,
    kind: plan.kind,
    status: "pending",
    lines: plan.lines,
    shippingCents: plan.shippingCents,
    amountCents: plan.amountCents,
    ...(meta.reason && { reason: meta.reason }),
    ...(meta.returnReason && { returnReason: meta.returnReason }),
    requestId: meta.requestId,
    idempotencyKey: refundIdempotencyKey(order._id, meta.requestId),
    actor: meta.actor,
    createdAt: now,
  });
  await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
    orderId: order._id,
    orderNumber: order.orderNumber,
    type: "refund_requested",
    actor: meta.actor,
    details: `${describeRefund(order, plan)}${meta.reason ? ` — ${meta.reason}` : ""}`,
  });
  const row = await ctx.db.get("order_refunds", refundId);
  return toReservation(row!, order);
}

/**
 * INTERNAL: plan and reserve an Administrator's line refund, Return or Goodwill Refund. A
 * repeated `requestId` returns the row it already reserved instead of planning again.
 */
export const reserveAdminRefund = internalMutation({
  args: {
    orderId: v.id("orders"),
    requestId: v.string(),
    actor: v.string(),
    note: v.optional(v.string()),
    request: adminRefundRequestValidator,
  },
  returns: reservationValidator,
  handler: async (ctx, args) => {
    const order = await ctx.db.get("orders", args.orderId);
    if (!order) throw new ConvexError("Order not found");

    const repeated = await repeatedReservation(ctx, order, args.requestId);
    if (repeated) return repeated;

    const ledger = await readLedger(ctx, order._id);
    const { request } = args;
    const planned =
      request.kind === "line"
        ? planLineRefund(order, ledger, request)
        : request.kind === "return"
          ? planReturn(order, ledger, request, Date.now())
          : planGoodwillRefund(order, ledger, request);
    if (!planned.ok) throw new ConvexError(planned.error);

    const reason = request.kind === "goodwill" ? request.reason : args.note;
    return await reserveRefund(ctx, order, planned.plan, {
      requestId: args.requestId,
      actor: args.actor,
      ...(reason && { reason }),
      ...(request.kind === "return" && { returnReason: request.reason }),
    });
  },
});

/**
 * INTERNAL: Stripe accepted the refund. Marks it issued and Restocks the lines the
 * Administrator chose. Stock moves only here, after the money is confirmed, and only once.
 * Emails the Customer a "refund issued" notice (not for a cancellation's refund, which the
 * cancellation email already announced).
 */
export const commitRefund = internalMutation({
  args: { refundId: v.id("order_refunds"), stripeRefundId: v.string() },
  returns: v.object({ committed: v.boolean(), restockedUnits: v.number() }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("order_refunds", args.refundId);
    if (!row || row.status !== "pending") return { committed: false, restockedUnits: 0 };
    const order = await ctx.db.get("orders", row.orderId);
    if (!order) throw new ConvexError("Order not found");

    // A cancellation since the reservation already gave back an unshipped Order's units.
    const restock = !isCancelled(order);
    let restockedUnits = 0;
    for (const line of row.lines) {
      const item = order.items[line.lineIndex];
      if (!line.restock || !item || !restock) continue;
      await adjustStock(ctx, item, line.quantity);
      restockedUnits += line.quantity;
    }

    const now = Date.now();
    await ctx.db.patch("order_refunds", row._id, { status: "issued", stripeRefundId: args.stripeRefundId, settledAt: now });
    await ctx.db.patch("orders", order._id, { updatedAt: now });
    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId: order._id,
      orderNumber: order.orderNumber,
      type: "refund_issued",
      actor: row.actor,
      details: `${describeRefund(order, row)} — Stripe ${args.stripeRefundId}${
        restockedUnits > 0 ? `, restocked ${restockedUnits} unit(s)` : ""
      }${row.lines.some((l) => l.restock) && !restock ? ", restock skipped (order cancelled)" : ""}`,
    });

    const notice = refundIssuedNotice({
      orderNumber: order.orderNumber,
      refundId: row._id,
      kind: row.kind,
      amountCents: row.amountCents,
    });
    if (notice && hasEmail(order.customerEmail)) {
      await ctx.scheduler.runAfter(0, internal.notifications.emails.sendCustomerNotice, {
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        notice,
      });
    }
    return { committed: true, restockedUnits };
  },
});

/**
 * INTERNAL: Stripe refused the refund. The row fails and frees the lines it reserved, and the
 * Administrator is alerted that the Customer was not refunded.
 */
export const failRefund = internalMutation({
  args: { refundId: v.id("order_refunds"), error: v.string() },
  returns: v.object({ failed: v.boolean() }),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("order_refunds", args.refundId);
    if (!row || row.status !== "pending") return { failed: false };
    const order = await ctx.db.get("orders", row.orderId);
    const now = Date.now();
    await ctx.db.patch("order_refunds", row._id, { status: "failed", error: args.error, settledAt: now });
    if (order) {
      await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: "refund_failed",
        actor: row.actor,
        details: `${row.kind} refund ${formatCents(row.amountCents)} failed: ${args.error}`,
      });
    }
    await ctx.scheduler.runAfter(0, internal.notifications.emails.sendAdminAlert, {
      alert: refundProblemAlert({
        orderNumber: row.orderNumber,
        refundId: row._id,
        kind: row.kind,
        amountCents: row.amountCents,
        problem: "failed",
        error: args.error,
      }),
    });
    return { failed: true };
  },
});

/** The ledger row a Stripe refund belongs to: by its Stripe id, else the row id in its metadata. */
async function rowForStripeRefund(ctx: QueryCtx, stripeRefundId: string, ledgerRefundId?: string): Promise<RefundRow | null> {
  const byStripeId = await ctx.db
    .query("order_refunds")
    .withIndex("by_stripeRefundId", (q) => q.eq("stripeRefundId", stripeRefundId))
    .first();
  if (byStripeId) return byStripeId;
  const id = ledgerRefundId ? ctx.db.normalizeId("order_refunds", ledgerRefundId) : null;
  if (!id) return null;
  const row = await ctx.db.get("order_refunds", id);
  // Never fail a row that Stripe recorded under another refund id.
  return row && (!row.stripeRefundId || row.stripeRefundId === stripeRefundId) ? row : null;
}

/**
 * INTERNAL: Stripe failed or canceled a refund after accepting it (`refund.failed`,
 * `refund.updated`). The row fails, which frees its lines; the Order gets a `refund_failed`
 * payment event, an adminNotes line and an Administrator alert. Stock is not reversed: a
 * Restock done on issue stays, and the note asks the Administrator to check stock. Replay-safe
 * on the event id.
 */
export const failIssuedRefundFromStripe = internalMutation({
  args: {
    stripeRefundId: v.string(),
    ledgerRefundId: v.optional(v.string()),
    stripeStatus: v.union(v.literal("failed"), v.literal("canceled")),
    failureReason: v.optional(v.string()),
    webhookEventId: v.string(),
  },
  returns: v.object({
    failed: v.boolean(),
    reason: v.optional(v.union(v.literal("unknown_refund"), v.literal("replayed"), v.literal("already_failed"))),
    restockedUnits: v.number(),
  }),
  handler: async (ctx, args) => {
    const { webhookEventId, ...failure } = args;
    const row = await rowForStripeRefund(ctx, args.stripeRefundId, args.ledgerRefundId);
    const recorded = await ctx.db
      .query("payment_events")
      .withIndex("by_stripeEventId", (q) => q.eq("stripeEventId", webhookEventId))
      .first();
    const order = row ? await ctx.db.get("orders", row.orderId) : null;
    const decision = decideRefundFailure({
      row: order ? row : null,
      failure,
      eventAlreadyRecorded: recorded !== null,
    });
    if (decision.action === "ignore" || !row || !order) {
      const reason = decision.action === "ignore" ? decision.reason : "unknown_refund";
      if (reason === "unknown_refund") {
        console.warn(`Stripe refund ${args.stripeRefundId} ${args.stripeStatus} is not in the refund ledger; ignoring.`);
      }
      return { failed: false, reason, restockedUnits: 0 };
    }

    const now = Date.now();
    await ctx.db.patch("order_refunds", row._id, {
      status: "failed",
      error: decision.error,
      stripeRefundId: args.stripeRefundId,
      settledAt: now,
    });
    await ctx.db.patch("orders", order._id, { adminNotes: appendNote(order.adminNotes, decision.note), updatedAt: now });
    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId: order._id,
      orderNumber: order.orderNumber,
      type: "refund_failed",
      stripeEventId: webhookEventId,
      actor: "stripe",
      details: decision.details,
    });
    await ctx.scheduler.runAfter(0, internal.notifications.emails.sendAdminAlert, {
      alert: refundProblemAlert({
        orderNumber: order.orderNumber,
        refundId: row._id,
        kind: row.kind,
        amountCents: row.amountCents,
        problem: "failed",
        error: decision.error,
      }),
    });
    return { failed: true, restockedUnits: decision.restockedUnits };
  },
});

/** INTERNAL: a pending refund to retry, with its Order's Stripe session. */
export const getPendingRefundInternal = internalQuery({
  args: { refundId: v.id("order_refunds") },
  returns: v.union(reservationValidator, v.null()),
  handler: async (ctx, args) => {
    const row = await ctx.db.get("order_refunds", args.refundId);
    if (!row || row.status !== "pending") return null;
    const order = await ctx.db.get("orders", row.orderId);
    return order ? toReservation(row, order) : null;
  },
});

/** Every refund recorded for an Order, newest first (admin order page). */
export const listOrderRefunds = query({
  args: { orderId: v.id("orders") },
  returns: v.array(schema.doc("order_refunds")),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];
    await requireAdmin(ctx);
    const rows = await readLedger(ctx, args.orderId);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});
