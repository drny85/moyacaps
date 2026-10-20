"use node";

/**
 * Money back through Stripe (plan 0008 "Money back"): line refunds, Returns and Goodwill Refunds
 * from the admin order page, Customer Cancellation, and Administrator cancellation. Each one is
 * first reserved in the refund ledger (refundLedger.ts; rules in refundModel.ts), then sent to
 * the Stripe Refunds API with an idempotency key, then marked issued (Restocking the chosen
 * lines) or failed. Payment Status follows from Stripe's `charge.refunded` webhook, never from here.
 */
import { action } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { getStripe, refundCheckoutSession } from "./stripeClient";
import { requireAdminInAction } from "../lib/auth";
import { adminRefundRequestValidator, formatCents, refundErrorOutcome, type Reservation } from "./refundModel";

const refundOutcomeValidator = v.object({
  refundId: v.id("order_refunds"),
  status: v.union(v.literal("issued"), v.literal("pending"), v.literal("failed")),
  amountCents: v.number(),
  error: v.optional(v.string()),
});
type RefundOutcome = typeof refundOutcomeValidator.type;

/**
 * Send a reserved refund to Stripe and record the result. A final Stripe refusal fails the
 * ledger row (freeing its lines); an ambiguous error (network, outage) leaves it pending so a
 * retry reuses the same idempotency key and can never refund twice.
 */
async function sendRefund(ctx: ActionCtx, reservation: Reservation, actor: string): Promise<RefundOutcome> {
  const base = { refundId: reservation.refundId, amountCents: reservation.amountCents };
  if (reservation.status === "issued") return { ...base, status: "issued" };
  try {
    const refund = await refundCheckoutSession(getStripe(), {
      sessionId: reservation.stripeSessionId,
      amountCents: reservation.amountCents,
      idempotencyKey: reservation.idempotencyKey,
      metadata: { orderNumber: reservation.orderNumber, refundId: reservation.refundId, actor },
    });
    await ctx.runMutation(internal.payments.refundLedger.commitRefund, {
      refundId: reservation.refundId,
      stripeRefundId: refund.id,
    });
    return { ...base, status: "issued" };
  } catch (err: any) {
    const message: string = err?.message || "Stripe refund failed.";
    const outcome = err instanceof ConvexError ? "failed" : refundErrorOutcome(err?.type);
    console.error(`[Refund] ${reservation.orderNumber} ${reservation.refundId} ${outcome}:`, message);
    if (outcome === "failed") {
      await ctx.runMutation(internal.payments.refundLedger.failRefund, { refundId: reservation.refundId, error: message });
      return { ...base, status: "failed", error: message };
    }
    return { ...base, status: "pending", error: message };
  }
}

/**
 * Administrator refunds from the order page: chosen lines and quantities (optionally with
 * shipping), a Return, or a Goodwill Refund. Restock is chosen per line in the request.
 * `requestId` is generated once per dialog submission, so a double click refunds once.
 */
export const refundOrder = action({
  args: {
    orderId: v.id("orders"),
    requestId: v.string(),
    note: v.optional(v.string()),
    request: adminRefundRequestValidator,
  },
  returns: refundOutcomeValidator,
  handler: async (ctx, args): Promise<RefundOutcome> => {
    const admin = await requireAdminInAction(ctx);
    const reservation: Reservation = await ctx.runMutation(internal.payments.refundLedger.reserveAdminRefund, {
      orderId: args.orderId,
      requestId: args.requestId,
      actor: admin.subject,
      note: args.note,
      request: args.request,
    });
    return await sendRefund(ctx, reservation, admin.subject);
  },
});

/** Administrator retries a refund left pending by a network or Stripe outage (same idempotency key). */
export const retryRefund = action({
  args: { refundId: v.id("order_refunds") },
  returns: refundOutcomeValidator,
  handler: async (ctx, args): Promise<RefundOutcome> => {
    const admin = await requireAdminInAction(ctx);
    const reservation: Reservation | null = await ctx.runQuery(internal.payments.refundLedger.getPendingRefundInternal, {
      refundId: args.refundId,
    });
    if (!reservation) throw new ConvexError("Only a pending refund can be retried.");
    return await sendRefund(ctx, reservation, admin.subject);
  },
});

/**
 * Customer Cancellation: the signed-in owner cancels a paid, unfulfilled Order for a full
 * automatic refund with its stock restored. Identity is read from the auth token; guests
 * cancel through support.
 */
export const cancelAndRefundOrder = action({
  args: {
    orderId: v.id("orders"),
    reason: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), refundIssued: v.boolean(), orderNumber: v.string(), message: v.string() }),
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; refundIssued: boolean; orderNumber: string; message: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized: Authentication required to cancel order.");
    }

    const result: { orderNumber: string; refund: Reservation } = await ctx.runMutation(
      internal.orders.functions.cancelOrder,
      { orderId: args.orderId, reason: args.reason || "Customer self-service cancellation" }
    );

    const outcome = await sendRefund(ctx, result.refund, identity.subject);
    const refundIssued = outcome.status === "issued";
    return {
      success: true,
      refundIssued,
      orderNumber: result.orderNumber,
      message: refundIssued
        ? "Order cancelled and full refund sent to original payment method."
        : "Order cancelled. Your refund is being processed; our team has been notified.",
    };
  },
});

/**
 * Administrator cancels an Order. Units go back only if nothing shipped; with `refundStripe`
 * whatever is left of the payment is refunded in full.
 */
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
  ): Promise<{ success: boolean; refundIssued: boolean; refundError?: string; orderNumber: string; message: string }> => {
    const admin = await requireAdminInAction(ctx);

    const result: { orderNumber: string; stockReleased: boolean; refund: Reservation | null; refundSkipped?: string } =
      await ctx.runMutation(internal.orders.desk.cancelOrderAdmin, {
        orderId: args.orderId,
        refundStripe: args.refundStripe,
        reason: args.reason || "Administrative cancellation",
        adminNotes: args.adminNotes,
      });

    const stock = result.stockReleased ? "inventory restored" : "inventory unchanged";
    if (!result.refund) {
      return {
        success: true,
        refundIssued: false,
        ...(result.refundSkipped && { refundError: result.refundSkipped }),
        orderNumber: result.orderNumber,
        message: result.refundSkipped
          ? `Order cancelled (${stock}); no refund sent: ${result.refundSkipped}`
          : `Order cancelled (${stock}) without a Stripe refund.`,
      };
    }

    const outcome = await sendRefund(ctx, result.refund, admin.subject);
    if (outcome.status === "issued") {
      return {
        success: true,
        refundIssued: true,
        orderNumber: result.orderNumber,
        message: `Order cancelled (${stock}) and ${formatCents(outcome.amountCents)} refunded through Stripe.`,
      };
    }
    const refundError = outcome.error || "Stripe refund failed.";
    return {
      success: true,
      refundIssued: false,
      refundError,
      orderNumber: result.orderNumber,
      message:
        outcome.status === "pending"
          ? `Order cancelled (${stock}); the refund is pending — retry it from the refunds panel. ${refundError}`
          : `Order cancelled (${stock}), but the Stripe refund failed: ${refundError}`,
    };
  },
});
