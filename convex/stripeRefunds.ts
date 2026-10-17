"use node";

/**
 * Cancel-and-refund actions: cancel the order in Convex (stock restored), then refund
 * the Stripe payment. Customer self-service and Administrator variants.
 */
import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { getStripe, refundCheckoutSession, requireAdminIdentity } from "./stripeClient";

export const cancelAndRefundOrder = action({
  args: {
    orderId: v.id("orders"),
    clerkUserId: v.string(),
    reason: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), refundIssued: v.boolean(), orderNumber: v.string(), message: v.string() }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    refundIssued: boolean;
    orderNumber: string;
    message: string;
  }> => {
    // Authenticate caller
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized: Authentication required to cancel order.");
    }
    if (identity.subject !== args.clerkUserId) {
      const user = await ctx.runQuery(api.users.getUserByClerkId, {
        clerkId: identity.subject,
      });
      if (user?.role !== "admin") {
        throw new ConvexError("Forbidden: Cannot cancel another customer's order.");
      }
    }

    // 1. Cancel order in Convex and restore inventory
    const result: {
      success: boolean;
      stripeSessionId?: string;
      orderNumber: string;
      total: number;
      currency: string;
    } = await ctx.runMutation(internal.orders.cancelOrder, {
      orderId: args.orderId,
      clerkUserId: args.clerkUserId,
      reason: args.reason || "Customer self-service cancellation",
    });

    // 2. Issue Stripe refund if order has stripeSessionId
    let refundIssued = false;
    if (result.stripeSessionId) {
      try {
        refundIssued = await refundCheckoutSession(getStripe(), result.stripeSessionId, {
          orderNumber: result.orderNumber,
          clerkUserId: args.clerkUserId,
        });
      } catch (err: any) {
        console.error("Stripe refund error in Convex action:", err);
      }
    }

    return {
      success: true,
      refundIssued,
      orderNumber: result.orderNumber,
      message: refundIssued
        ? "Order cancelled and full refund sent to original payment method."
        : "Order cancelled and stock restored.",
    };
  },
});

export const cancelAndRefundOrderAdmin = action({
  args: {
    orderId: v.id("orders"),
    refundStripe: v.boolean(),
    reason: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    refundIssued: v.boolean(),
    refundError: v.optional(v.string()),
    orderNumber: v.string(),
    message: v.string(),
  }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    refundIssued: boolean;
    refundError?: string;
    orderNumber: string;
    message: string;
  }> => {
    // 1. Strictly verify caller has authenticated admin identity
    const identity = await requireAdminIdentity(ctx, {
      unauthenticated: "Unauthorized: Staff authentication required to cancel orders.",
      forbidden: "Unauthorized: Administrative privileges required to cancel orders.",
    });

    // 2. Cancel order in Convex and restore inventory
    const result: {
      success: boolean;
      stripeSessionId?: string;
      orderNumber: string;
      total: number;
      currency: string;
      paymentMethod: string;
    } = await ctx.runMutation(internal.orderDesk.cancelOrderAdmin, {
      orderId: args.orderId,
      reason: args.reason || "Administrative cancellation",
      adminNotes: args.adminNotes,
    });

    // 3. Issue Stripe refund if requested and session exists
    let refundIssued = false;
    let refundError: string | undefined;
    if (args.refundStripe && result.stripeSessionId) {
      try {
        refundIssued = await refundCheckoutSession(getStripe(), result.stripeSessionId, {
          orderNumber: result.orderNumber,
          cancelledByAdmin: identity?.subject || "admin",
        });
      } catch (err: any) {
        console.error("Stripe refund error in cancelAndRefundOrderAdmin:", err);
        refundError = err?.message || "Failed to process refund on Stripe.";
      }
    }

    return {
      success: true,
      refundIssued,
      refundError,
      orderNumber: result.orderNumber,
      message: refundIssued
        ? "Order cancelled, inventory restocked, and full Stripe refund processed."
        : refundError
        ? `Order cancelled and restocked, but Stripe refund failed: ${refundError}`
        : "Order cancelled and inventory restocked without automated Stripe refund.",
    };
  },
});
