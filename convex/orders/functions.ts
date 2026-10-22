/**
 * Order core: the payment-event audit log, internal lookups used by actions, and the
 * customer-facing order reads and edits. Settlement, the admin
 * order desk, fulfillment and analytics live in their own modules (ADR 0017).
 */
import { query, internalQuery } from "../_generated/server";
import { mutation, internalMutation } from "../lib/functions";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { isAdmin, isAdminRow, isAllowlistedAdmin, requireAdmin } from "../lib/auth";
import { confirmationView, guestTrackingView, isUnpaidCheckout, orderHoldsStock, ownerTrackingView } from "./model";
import { canEditShippingAddress, planCustomerCancellation, statusAxes, statusPatch } from "./status";
import {
  cancellationReleaseLines,
  cancellationRequestId,
  planFullRefund,
  reservationValidator,
} from "../payments/refundModel";
import { carrierTrackingNumber } from "./trackingNumber";
import { insertPaymentEvent } from "./paymentEvents";
import { claimableEmail } from "./guestClaimModel";
import { readLedger, reserveRefund } from "../payments/refundLedger";
import {
  findOrderByTypedNumber,
  getOrderByNumber,
  getOrderByStripeSessionId,
  hasEmail,
  releaseStock,
} from "./shared";
import { cancellationNotice, customerCancellationAlert } from "../notifications/orderEmails";
import {
  confirmationViewValidator,
  guestTrackingViewValidator,
  orderDoc,
  ownerTrackingViewValidator,
  shippingAddressValidator,
  successResult,
} from "./validators";

/**
 * Append-only audit log for every money-relevant state transition on an order. For actions;
 * mutations call `insertPaymentEvent` directly.
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
    await insertPaymentEvent(ctx, args);
    return { success: true };
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

    // Order numbers are partly time-based and can be guessed, so a bare number only shows
    // its owner or an Administrator anything; others look up by number and email (M4).
    const byNumber = await getOrderByNumber(ctx, args.identifier);
    if (!byNumber) return null;
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const isOwner = Boolean(byNumber.clerkUserId) && byNumber.clerkUserId === identity.subject;
    if (!isOwner && !(await isAdmin(ctx))) return null;
    return confirmationView(byNumber, false);
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

    // Customers only see confirmed purchases (never unpaid or abandoned checkouts)
    // A legacy GL-TRK placeholder is not a carrier Tracking Number: never shown as one.
    return orders
      .filter((o) => !isUnpaidCheckout(o))
      .map((o) => ({ ...o, trackingNumber: carrierTrackingNumber(o) }));
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

    if (!canEditShippingAddress(order)) {
      const axes = statusAxes(order);
      const state = axes.cancelledAt !== undefined ? "cancelled" : axes.fulfillmentStatus.replace(/_/g, " ");
      throw new ConvexError(`Cannot modify address when order is ${state}`);
    }

    await ctx.db.patch(args.orderId, {
      shippingAddress: args.shippingAddress,
      customerPhone: args.customerPhone ?? order.customerPhone,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Customer Cancellation (CONTEXT.md); called by payments/refunds:cancelAndRefundOrder. The
 * signed-in owner of a paid, unfulfilled Order cancels it: its units go back and a full refund
 * is reserved in the ledger for the action to send to Stripe. Identity comes from the auth
 * token only; guests cancel through support. The Customer gets an "order cancelled" email and
 * the Administrator an alert not to pack it.
 */
export const cancelOrder = internalMutation({
  args: {
    orderId: v.id("orders"),
    reason: v.optional(v.string()),
  },
  returns: v.object({ orderNumber: v.string(), refund: reservationValidator }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized: Authentication required.");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError("Order not found");
    }

    const plan = planCustomerCancellation(order, identity.subject);
    if (!plan.ok) {
      throw new ConvexError(plan.error);
    }
    // The cancellation promises a full refund: refuse before cancelling if one cannot be sent.
    const ledger = await readLedger(ctx, order._id);
    const refundPlan = planFullRefund(order, ledger);
    if (!refundPlan.ok) {
      throw new ConvexError(`${refundPlan.error} Please contact support.`);
    }

    if (plan.releaseStock) {
      await releaseStock(ctx, cancellationReleaseLines(order, ledger));
    }

    const now = Date.now();
    await ctx.db.patch(args.orderId, {
      ...statusPatch(order, { cancelledAt: now, cancellationReason: "customer" }),
      updatedAt: now,
    });

    await insertPaymentEvent(ctx, {
      orderId: args.orderId,
      orderNumber: order.orderNumber,
      type: "cancelled",
      actor: identity.subject,
      details: args.reason,
    });

    const refund = await reserveRefund(ctx, order, refundPlan.plan, {
      requestId: cancellationRequestId(order._id),
      actor: identity.subject,
      reason: "Customer Cancellation",
    });

    if (hasEmail(order.customerEmail)) {
      await ctx.scheduler.runAfter(0, internal.notifications.emails.sendCustomerNotice, {
        orderNumber: order.orderNumber,
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        notice: cancellationNotice({ orderNumber: order.orderNumber, by: "customer", refundCents: refund.amountCents }),
      });
    }
    await ctx.scheduler.runAfter(0, internal.notifications.emails.sendAdminAlert, {
      alert: customerCancellationAlert({
        orderNumber: order.orderNumber,
        refundCents: refund.amountCents,
        stockReleased: plan.releaseStock,
        reason: args.reason,
      }),
    });
    return { orderNumber: order.orderNumber, refund };
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
      } else if (orderEmail && claimableEmail(identity.email, identity.emailVerified) === orderEmail) {
        // Only a verified email proves the order is theirs (M5), as for guest claims.
        isOwnerOrAdmin = true;
      } else {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
          .first();
        // The users row's email is not known to be verified, so it does not prove ownership.
        if (isAdminRow(user) || isAllowlistedAdmin(identity)) {
          isOwnerOrAdmin = true;
        }
      }
    }

    // Unauthenticated or unrelated viewers get redacted PII and never the live payment link.
    return isOwnerOrAdmin ? ownerTrackingView(order) : guestTrackingView(order);
  },
});
