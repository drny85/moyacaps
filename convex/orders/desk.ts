/**
 * Administrator order desk (ADR 0003): order lists, attention counters, order detail,
 * manual status changes, cancellation and contact/fulfillment edits.
 */
import { mutation, query, internalMutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { attentionStatsValidator, computeAttentionStats } from "../analytics/model";
import { listCatalogVariants } from "../catalog/shared";
import { matchesOrderSearch, newTrackingNumber, orderHoldsStock, planAdminStatusChange } from "./model";
import { deductStock, findOrderByTypedNumber, releaseStock, scheduleSessionExpiry } from "./shared";
import { orderDoc, orderStatusValidator, shippingAddressValidator, successResult } from "./validators";

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

/** Admin order list. `clientTime` (caller-supplied, minute granularity) drives the "overdue" view. */
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

    let orders;
    if (args.status === "needs_attention") {
      orders = await ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", "paid"))
        .order("desc")
        .take(maxItems);
    } else if (args.status === "overdue") {
      const twentyFourHoursAgo = args.clientTime - 24 * 60 * 60 * 1000;
      const paid = await ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", "paid"))
        .order("desc")
        .take(maxItems);
      orders = paid.filter((o) => (o.createdAt || 0) < twentyFourHoursAgo);
    } else if (args.status && args.status !== "all") {
      orders = await ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", args.status as any))
        .order("desc")
        .take(maxItems);
    } else {
      orders = await ctx.db
        .query("orders")
        .withIndex("by_createdAt")
        .order("desc")
        .take(maxItems);
    }

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

    // Bounded reads via by_status indexes. Operational queues rarely exceed these caps;
    // if they do, the number shown is clamped rather than scanning the whole table.
    const STATS_WINDOW = 1000;
    const [paidOrders, latestOrder, variants] = await Promise.all([
      ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", "paid"))
        .order("desc")
        .take(STATS_WINDOW),
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
      ...(args.customerEmail !== undefined && { customerEmail: args.customerEmail }),
      ...(args.adminNotes !== undefined && { adminNotes: args.adminNotes }),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/** Administrative cancellation; called by stripeRefunds:cancelAndRefundOrderAdmin. */
export const cancelOrderAdmin = internalMutation({
  args: {
    orderId: v.id("orders"),
    reason: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    stripeSessionId: v.optional(v.string()),
    orderNumber: v.string(),
    total: v.number(),
    currency: v.string(),
    paymentMethod: v.union(v.literal("stripe"), v.literal("whatsapp")),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status === "cancelled") {
      throw new Error("Order is already cancelled");
    }

    // Restore stock if it was previously deducted, reserved or held at checkout
    if (orderHoldsStock(order)) {
      await releaseStock(ctx, order.items);
    }

    const updatedNotes = args.adminNotes
      ? order.adminNotes
        ? `${order.adminNotes} | ${args.adminNotes}`
        : args.adminNotes
      : order.adminNotes;

    await ctx.db.patch(args.orderId, {
      status: "cancelled",
      ...(updatedNotes && { adminNotes: updatedNotes }),
      updatedAt: Date.now(),
    });

    if (order.stripeSessionId) {
      await scheduleSessionExpiry(ctx, args.orderId);
    }

    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId: args.orderId,
      orderNumber: order.orderNumber,
      type: "cancelled",
      actor: admin.subject,
      details: args.reason,
    });

    return {
      success: true,
      stripeSessionId: order.stripeSessionId,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
      paymentMethod: order.paymentMethod,
    };
  },
});

export const updateOrderStatusAdmin = mutation({
  args: {
    orderId: v.id("orders"),
    newStatus: orderStatusValidator,
    carrier: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), orderId: v.id("orders"), status: orderStatusValidator }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const previousStatus = order.status;
    const plan = planAdminStatusChange(previousStatus, args.newStatus, orderHoldsStock(order));
    if (!plan.ok) {
      throw new ConvexError(plan.error);
    }

    if (plan.stock === "deduct") await deductStock(ctx, order.items);
    if (plan.stock === "release") await releaseStock(ctx, order.items);

    const updatePayload: Record<string, any> = {
      status: args.newStatus,
      updatedAt: Date.now(),
    };

    if (args.carrier !== undefined) updatePayload.carrier = args.carrier;
    if (args.trackingNumber !== undefined) updatePayload.trackingNumber = args.trackingNumber;
    if (args.adminNotes !== undefined) updatePayload.adminNotes = args.adminNotes;

    if (plan.lockCarrierUpdates) {
      updatePayload.manualStatusOverride = true;
    }

    // Auto-generate tracking number if transitioning to dispatched without one
    if (args.newStatus === "dispatched" && !order.trackingNumber && !args.trackingNumber) {
      updatePayload.trackingNumber = newTrackingNumber();
    }

    await ctx.db.patch(args.orderId, updatePayload);

    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId: args.orderId,
      orderNumber: order.orderNumber,
      type: args.newStatus === "cancelled" ? "cancelled" : "status_changed",
      actor: admin.subject,
      details: `${previousStatus} → ${args.newStatus}`,
    });

    // Releasing a reservation through status change must also kill any open payment link.
    if (args.newStatus === "cancelled" && order.stripeSessionId) {
      await scheduleSessionExpiry(ctx, args.orderId);
    }

    return { success: true, orderId: args.orderId, status: args.newStatus };
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
