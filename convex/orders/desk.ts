/**
 * Administrator order desk (ADR 0003, ADR 0024): order lists, attention counters, order
 * detail, manual Fulfillment Status changes, cancellation and contact/fulfillment edits.
 */
import { mutation, query, internalMutation } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { attentionStatsValidator, computeAttentionStats } from "../analytics/model";
import { listCatalogVariants } from "../catalog/shared";
import { matchesDeskFilter, parseDeskFilter, type DeskFilter } from "./deskFilters";
import { matchesOrderSearch, orderHoldsStock } from "./model";
import {
  cancellationReleaseLines,
  cancellationRequestId,
  planFullRefund,
  reservationValidator,
} from "../payments/refundModel";
import { readLedger, reserveRefund } from "../payments/refundLedger";
import { findOrderByTypedNumber, hasEmail, releaseStock, scheduleSessionExpiry } from "./shared";
import { carrierTrackingNumber } from "./trackingNumber";
import { normalizeEmail } from "./guestClaimModel";
import { cancellationNotice, manualMoveEmail } from "../notifications/orderEmails";
import {
  fulfillmentStatusValidator,
  hasSettled,
  planCancellation,
  planManualFulfillmentChange,
  statusAxes,
  statusPatch,
} from "./status";
import { orderDoc, shippingAddressValidator, successResult } from "./validators";

type Order = Doc<"orders">;

/** Newest first across several index reads, at most `limit`. */
function newestFirst(lists: Order[][], limit: number): Order[] {
  return lists
    .flat()
    .sort((a, b) => b._creationTime - a._creationTime)
    .slice(0, limit);
}

/** The packing queue (paid or partially refunded, unfulfilled, not cancelled), newest first. */
async function packingQueue(ctx: QueryCtx, limit: number): Promise<Order[]> {
  const lists = await Promise.all(
    (["paid", "partially_refunded"] as const).map((paymentStatus) =>
      ctx.db
        .query("orders")
        .withIndex("by_paymentStatus_and_fulfillmentStatus_and_cancelledAt", (q) =>
          q.eq("paymentStatus", paymentStatus).eq("fulfillmentStatus", "unfulfilled").eq("cancelledAt", undefined)
        )
        .order("desc")
        .take(limit)
    )
  );
  return newestFirst(lists, limit);
}

/** Index read that narrows to a desk tab; `matchesDeskFilter` decides membership. */
async function readDeskFilter(ctx: QueryCtx, filter: DeskFilter, limit: number): Promise<Order[]> {
  switch (filter) {
    case "all":
      return await ctx.db.query("orders").withIndex("by_createdAt").order("desc").take(limit);
    case "needs_attention":
    case "overdue":
      return await packingQueue(ctx, limit);
    case "awaiting_payment":
      return await ctx.db
        .query("orders")
        .withIndex("by_paymentStatus_and_fulfillmentStatus_and_cancelledAt", (q) =>
          q.eq("paymentStatus", "awaiting_payment").eq("fulfillmentStatus", "unfulfilled").eq("cancelledAt", undefined)
        )
        .order("desc")
        .take(limit);
    case "partially_refunded":
    case "refunded":
    case "disputed":
      return await ctx.db
        .query("orders")
        .withIndex("by_paymentStatus_and_fulfillmentStatus_and_cancelledAt", (q) => q.eq("paymentStatus", filter))
        .order("desc")
        .take(limit);
    case "cancelled":
      return await ctx.db
        .query("orders")
        .withIndex("by_cancelledAt", (q) => q.gte("cancelledAt", 0))
        .order("desc")
        .take(limit);
    default:
      return await ctx.db
        .query("orders")
        .withIndex("by_fulfillmentStatus", (q) => q.eq("fulfillmentStatus", filter))
        .order("desc")
        .take(limit);
  }
}

/**
 * Admin query to retrieve complete order details for dedicated fulfillment inspection.
 */
export const getOrderDetailAdmin = query({
  args: {
    orderNumber: v.string(),
  },
  returns: v.union(orderDoc, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    await requireAdmin(ctx);
    return await findOrderByTypedNumber(ctx, args.orderNumber);
  },
});

/**
 * Admin order list. `status` is a desk filter (orders/deskFilters.ts); `clientTime`
 * (caller-supplied, minute granularity) drives the "overdue" view.
 */
export const getAllOrdersAdmin = query({
  args: {
    clientTime: v.number(),
    status: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(orderDoc),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    await requireAdmin(ctx);
    const maxItems = Math.min(args.limit ?? 250, 500);

    const filter = parseDeskFilter(args.status);
    let orders = (await readDeskFilter(ctx, filter, maxItems)).filter((o) =>
      matchesDeskFilter(o, filter, args.clientTime)
    );

    if (args.paymentMethod && args.paymentMethod !== "all") {
      orders = orders.filter((o) => o.paymentMethod === args.paymentMethod);
    }

    if (args.search && args.search.trim() !== "") {
      const search = args.search;
      orders = orders.filter((o) => matchesOrderSearch(o, search));
    }

    return orders;
  },
});

/**
 * Admin query for attention metrics. `clientTime` MUST be supplied by the caller:
 * queries run on a cached reactive snapshot and never re-run because time advanced,
 * so reading Date.now() inside would freeze the overdue counters silently.
 */
export const getOrdersAttentionStats = query({
  args: {
    clientTime: v.number(),
  },
  returns: v.union(attentionStatsValidator, v.null()),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    await requireAdmin(ctx);

    // Bounded index reads. Operational queues rarely exceed these caps;
    // if they do, the number shown is clamped rather than scanning the whole table.
    const STATS_WINDOW = 1000;
    const [paidOrders, latestOrder, variants] = await Promise.all([
      packingQueue(ctx, STATS_WINDOW),
      ctx.db
        .query("orders")
        .withIndex("by_createdAt")
        .order("desc")
        .first(),
      listCatalogVariants(ctx),
    ]);

    return computeAttentionStats(paidOrders, latestOrder?.createdAt || 0, variants, args.clientTime);
  },
});

export const updateShippingAddressAdmin = mutation({
  args: {
    orderId: v.id("orders"),
    shippingAddress: shippingAddressValidator,
    customerPhone: v.optional(v.string()),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
  },
  returns: successResult,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    await ctx.db.patch(args.orderId, {
      shippingAddress: args.shippingAddress,
      ...(args.customerPhone !== undefined && { customerPhone: args.customerPhone }),
      ...(args.customerName !== undefined && { customerName: args.customerName }),
      ...(args.customerEmail !== undefined && { customerEmail: normalizeEmail(args.customerEmail) }),
      ...(args.adminNotes !== undefined && { adminNotes: args.adminNotes }),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Administrative cancellation; called by payments/refunds:cancelAndRefundOrderAdmin. Units go
 * back only if nothing shipped (status.ts planCancellation). With `refundStripe`, a full refund
 * of whatever is left is reserved in the ledger for the action to send to Stripe; when nothing
 * can be refunded the cancellation still goes ahead and says why. A Customer who paid gets an
 * "order cancelled" email; an Order never paid for gets none.
 */
export const cancelOrderAdmin = internalMutation({
  args: {
    orderId: v.id("orders"),
    refundStripe: v.boolean(),
    reason: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
  },
  returns: v.object({
    orderNumber: v.string(),
    stockReleased: v.boolean(),
    refund: v.union(reservationValidator, v.null()),
    refundSkipped: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const plan = planCancellation(order, "administrator", orderHoldsStock(order));
    if (!plan.ok) {
      throw new ConvexError(plan.error);
    }
    const ledger = await readLedger(ctx, order._id);
    const refundPlan = args.refundStripe ? planFullRefund(order, ledger) : undefined;

    if (plan.releaseStock) {
      await releaseStock(ctx, cancellationReleaseLines(order, ledger));
    }

    const updatedNotes = args.adminNotes
      ? order.adminNotes
        ? `${order.adminNotes} | ${args.adminNotes}`
        : args.adminNotes
      : order.adminNotes;

    const now = Date.now();
    await ctx.db.patch(args.orderId, {
      ...statusPatch(order, { cancelledAt: now, cancellationReason: "administrator" }),
      ...(updatedNotes && { adminNotes: updatedNotes }),
      updatedAt: now,
    });

    if (order.stripeSessionId && !hasSettled(order)) {
      await scheduleSessionExpiry(ctx, args.orderId);
    }

    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId: args.orderId,
      orderNumber: order.orderNumber,
      type: "cancelled",
      actor: admin.subject,
      details: args.reason,
    });

    const refund =
      refundPlan?.ok === true
        ? await reserveRefund(ctx, order, refundPlan.plan, {
            requestId: cancellationRequestId(order._id),
            actor: admin.subject,
            reason: args.reason || "Administrative cancellation",
          })
        : null;

    if (hasSettled(order) && hasEmail(order.customerEmail)) {
      await ctx.scheduler.runAfter(0, internal.notifications.emails.sendCustomerNotice, {
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        notice: cancellationNotice({
          orderNumber: order.orderNumber,
          by: "administrator",
          refundCents: refund?.amountCents ?? null,
        }),
      });
    }

    if (refundPlan && !refundPlan.ok) {
      return { orderNumber: order.orderNumber, stockReleased: plan.releaseStock, refund: null, refundSkipped: refundPlan.error };
    }
    return { orderNumber: order.orderNumber, stockReleased: plan.releaseStock, refund };
  },
});

/**
 * Administrator sets Fulfillment Status by hand (manual dispatch, confirm or revert delivery).
 * Payment Status is never touched; a change into or out of delivered locks out carrier
 * overwrites. A move into in transit or delivered sends the same shipped or delivered email a
 * carrier scan would (orderEmails.ts manualMoveEmail). Cancelling goes through
 * payments/refunds:cancelAndRefundOrderAdmin.
 */
export const updateFulfillmentStatusAdmin = mutation({
  args: {
    orderId: v.id("orders"),
    fulfillmentStatus: fulfillmentStatusValidator,
    carrier: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), orderId: v.id("orders"), fulfillmentStatus: fulfillmentStatusValidator }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const previous = statusAxes(order).fulfillmentStatus;
    const plan = planManualFulfillmentChange(order, args.fulfillmentStatus);
    if (!plan.ok) {
      throw new ConvexError(plan.error);
    }

    const updatePayload: Partial<Order> = {
      ...statusPatch(order, { fulfillmentStatus: plan.fulfillmentStatus }),
      updatedAt: Date.now(),
    };

    if (args.carrier !== undefined) updatePayload.carrier = args.carrier;
    if (args.trackingNumber !== undefined) updatePayload.trackingNumber = args.trackingNumber;
    if (args.adminNotes !== undefined) updatePayload.adminNotes = args.adminNotes;

    if (plan.lockCarrierUpdates) {
      updatePayload.manualStatusOverride = true;
    }

    await ctx.db.patch(args.orderId, updatePayload);

    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId: args.orderId,
      orderNumber: order.orderNumber,
      type: "status_changed",
      actor: admin.subject,
      details: `fulfillment ${previous} → ${args.fulfillmentStatus}`,
    });

    const email = manualMoveEmail(previous, plan.fulfillmentStatus);
    if (email && hasEmail(order.customerEmail)) {
      const carrier = (args.carrier ?? order.carrier) || undefined;
      const trackingNumber = (args.trackingNumber ?? carrierTrackingNumber(order)) || undefined;
      const recipient = { orderNumber: order.orderNumber, customerName: order.customerName, customerEmail: order.customerEmail };
      if (email === "dispatched") {
        await ctx.scheduler.runAfter(0, internal.notifications.emails.sendOrderDispatchedEmail, {
          ...recipient,
          stage: "in_transit",
          carrier,
          trackingNumber,
          shippingAddress: order.shippingAddress,
          items: order.items,
        });
      } else {
        await ctx.scheduler.runAfter(0, internal.notifications.emails.sendOrderDeliveredEmail, {
          ...recipient,
          carrier,
          trackingNumber,
          items: order.items,
        });
      }
    }

    return { success: true, orderId: args.orderId, fulfillmentStatus: plan.fulfillmentStatus };
  },
});

export const updateOrderFulfillmentAdmin = mutation({
  args: {
    orderId: v.id("orders"),
    carrier: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
  },
  returns: successResult,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    await ctx.db.patch(args.orderId, {
      ...(args.carrier !== undefined && { carrier: args.carrier }),
      ...(args.trackingNumber !== undefined && { trackingNumber: args.trackingNumber }),
      ...(args.adminNotes !== undefined && { adminNotes: args.adminNotes }),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
