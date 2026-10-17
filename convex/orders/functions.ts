/**
 * Order core: the payment-event audit log, internal lookups used by actions, and the
 * customer-facing order reads and edits. Settlement, WhatsApp reservations, the admin
 * order desk, fulfillment and analytics live in their own modules (ADR 0017).
 */
import { mutation, query, internalMutation, internalQuery } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import { confirmationView, guestTrackingView, holdsStock, ownerTrackingView } from "./model";
import {
  deductStock,
  findOrderByTypedNumber,
  getOrderByNumber,
  getOrderByStripeSessionId,
  releaseStock,
  scheduleSessionExpiry,
} from "./shared";
import {
  confirmationViewValidator,
  guestTrackingViewValidator,
  orderDoc,
  orderItemValidator,
  orderStatusValidator,
  ownerTrackingViewValidator,
  shippingAddressValidator,
  successResult,
} from "./validators";

/**
 * Append-only audit log for every money-relevant state transition on an order.
 */
export const recordPaymentEvent = internalMutation({
  args: {
    orderId: v.id("orders"),
    orderNumber: v.string(),
    type: v.string(),
    stripeEventId: v.optional(v.string()),
    stripeSessionId: v.optional(v.string()),
    actor: v.optional(v.string()),
    details: v.optional(v.string()),
  },
  returns: successResult,
  handler: async (ctx, args) => {
    await ctx.db.insert("payment_events", {
      orderId: args.orderId,
      orderNumber: args.orderNumber,
      type: args.type,
      stripeEventId: args.stripeEventId,
      stripeSessionId: args.stripeSessionId,
      actor: args.actor,
      details: args.details,
      createdAt: Date.now(),
    });
    return { success: true };
  },
});

export const createOrder = mutation({
  args: {
    orderNumber: v.string(),
    customerEmail: v.optional(v.string()),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    shippingAddress: v.optional(shippingAddressValidator),
    items: v.array(orderItemValidator),
    currency: v.string(),
    subtotal: v.optional(v.number()),
    shippingFee: v.optional(v.number()),
    total: v.number(),
    status: orderStatusValidator,
    paymentMethod: v.union(v.literal("stripe"), v.literal("whatsapp")),
    stripeSessionId: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
  },
  returns: v.id("orders"),
  handler: async (ctx, args) => {
    // Only administrators or verified system processes can create orders directly
    await requireAdmin(ctx);

    const orderId = await ctx.db.insert("orders", {
      ...args,
      createdAt: Date.now(),
    });

    // Decrement stock if paid
    if (args.status === "paid") {
      await deductStock(ctx, args.items);
    }

    // Schedule admin order alert if paid or whatsapp
    if (args.status === "paid" || args.paymentMethod === "whatsapp" || args.status === "whatsapp_initiated") {
      await ctx.scheduler.runAfter(0, internal.notifications.emails.sendAdminOrderAlert, {
        orderNumber: args.orderNumber,
        total: args.total,
        currency: args.currency,
        paymentMethod: args.paymentMethod,
        isWhatsAppPending: args.status === "whatsapp_initiated" || args.paymentMethod === "whatsapp",
        customerName: args.customerName,
        customerEmail: args.customerEmail,
        customerPhone: args.customerPhone,
        shippingAddress: args.shippingAddress,
        items: args.items,
        subtotal: args.subtotal,
        shippingFee: args.shippingFee,
        createdAt: Date.now(),
      });
    }

    return orderId;
  },
});

export const getOrderByIdInternal = internalQuery({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.union(orderDoc, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.orderId);
  },
});

export const getOrderByNumberInternal = internalQuery({
  args: {
    orderNumber: v.string(),
  },
  returns: v.union(orderDoc, v.null()),
  handler: async (ctx, args) => {
    return await getOrderByNumber(ctx, args.orderNumber);
  },
});

export const getOrderByStripeSessionIdInternal = internalQuery({
  args: {
    stripeSessionId: v.string(),
  },
  returns: v.union(orderDoc, v.null()),
  handler: async (ctx, args) => {
    return await getOrderByStripeSessionId(ctx, args.stripeSessionId);
  },
});

export const getOrderBySessionOrNumber = query({
  args: {
    identifier: v.string(),
  },
  returns: v.union(confirmationViewValidator, v.null()),
  handler: async (ctx, args) => {
    // Stripe session ids are high-entropy, unguessable, and only appear in the payer's own
    // return URL — safe to render the checkout summary (address/phone) for confirmation.
    if (args.identifier.startsWith("cs_")) {
      const bySession = await getOrderByStripeSessionId(ctx, args.identifier);
      return bySession ? confirmationView(bySession, true) : null;
    }

    // Bare order-number lookups stay minimal: enumeration must not reveal PII.
    const byNumber = await getOrderByNumber(ctx, args.identifier);
    return byNumber ? confirmationView(byNumber, false) : null;
  },
});

/** Most recent orders shown in a customer's account history. */
const MAX_ACCOUNT_ORDERS = 200;

export const getOrdersByClerkId = query({
  args: {
    clerkUserId: v.string(),
  },
  returns: v.array(orderDoc),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const isSelf = identity.subject === args.clerkUserId;
    if (!isSelf) {
      await requireAdmin(ctx);
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .order("desc")
      .take(MAX_ACCOUNT_ORDERS);

    // Customers only see confirmed purchases (never abandoned checkout drafts)
    return orders.filter((o) => o.status !== "pending");
  },
});

export const updateShippingAddress = mutation({
  args: {
    orderId: v.id("orders"),
    clerkUserId: v.string(),
    shippingAddress: shippingAddressValidator,
    customerPhone: v.optional(v.string()),
  },
  returns: successResult,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized: Authentication required.");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError("Order not found");
    }

    const isOwner = identity.subject === args.clerkUserId && order.clerkUserId === identity.subject;
    if (!isOwner) {
      await requireAdmin(ctx);
    }

    if (order.status === "dispatched" || order.status === "delivered" || order.status === "cancelled") {
      throw new ConvexError(`Cannot modify address when order status is ${order.status}`);
    }

    await ctx.db.patch(args.orderId, {
      shippingAddress: args.shippingAddress,
      customerPhone: args.customerPhone ?? order.customerPhone,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/** Customer self-service cancellation; called by stripeRefunds:cancelAndRefundOrder. */
export const cancelOrder = internalMutation({
  args: {
    orderId: v.id("orders"),
    clerkUserId: v.string(),
    reason: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    stripeSessionId: v.optional(v.string()),
    orderNumber: v.string(),
    total: v.number(),
    currency: v.string(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized: Authentication required.");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError("Order not found");
    }

    const isOwner = identity.subject === args.clerkUserId && order.clerkUserId === identity.subject;
    if (!isOwner) {
      await requireAdmin(ctx);
    }

    if (order.status === "dispatched" || order.status === "delivered") {
      throw new ConvexError("Cannot cancel an order that has already been dispatched. Please request a return via concierge.");
    }

    if (order.status === "cancelled") {
      throw new ConvexError("Order is already cancelled");
    }

    // Restore stock only if it was actually reserved or deducted
    if (holdsStock(order.status)) {
      await releaseStock(ctx, order.items);
    }

    await ctx.db.patch(args.orderId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });

    if (order.stripeSessionId) {
      await scheduleSessionExpiry(ctx, args.orderId);
    }

    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId: args.orderId,
      orderNumber: order.orderNumber,
      type: "cancelled",
      actor: identity.subject,
      details: args.reason,
    });

    return {
      success: true,
      stripeSessionId: order.stripeSessionId,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
    };
  },
});

export const getOrderByOrderNumberAndEmail = query({
  args: {
    orderNumber: v.string(),
    email: v.optional(v.string()),
  },
  returns: v.union(ownerTrackingViewValidator, guestTrackingViewValidator, v.null()),
  handler: async (ctx, args) => {
    const cleanEmail = args.email?.trim().toLowerCase();
    const order = await findOrderByTypedNumber(ctx, args.orderNumber);
    if (!order) {
      return null;
    }

    const orderEmail = (order.customerEmail || "").trim().toLowerCase();

    // If the order carries an email, the lookup MUST match it (no blank-email bypass).
    if (orderEmail && orderEmail !== cleanEmail) {
      return null;
    }

    // Verify authentication to gate sensitive PII (exact street address line, phone)
    const identity = await ctx.auth.getUserIdentity();
    let isOwnerOrAdmin = false;

    if (identity) {
      if (order.clerkUserId && identity.subject === order.clerkUserId) {
        isOwnerOrAdmin = true;
      } else if (identity.email && orderEmail && identity.email.toLowerCase() === orderEmail) {
        isOwnerOrAdmin = true;
      } else {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
          .first();
        if (user) {
          if (user.role === "admin") {
            isOwnerOrAdmin = true;
          } else if (user.email && orderEmail && user.email.toLowerCase() === orderEmail) {
            isOwnerOrAdmin = true;
          }
        }
      }
    }

    // Unauthenticated or unrelated viewers get redacted PII and never the live payment link.
    return isOwnerOrAdmin ? ownerTrackingView(order) : guestTrackingView(order);
  },
});
