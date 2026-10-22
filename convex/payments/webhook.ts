"use node";

/**
 * Stripe settlement actions (ADR 0006, ADR 0024): the signature-verified webhook (settlement,
 * invoices, refunds, disputes, expired/failed sessions releasing their Checkout Hold) and the success-page repair
 * path that settles a paid session the webhook has not delivered yet.
 */
import { action, internalAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import Stripe from "stripe";
import { getStripe } from "./stripeClient";
import { allowStripeSessionLookup } from "./checkoutRateLimit";
import {
  disputeFigures,
  hydrateOrderItems,
  isHandledStripeEvent,
  refundFromCharge,
  settlementFromSession,
} from "./settlementModel";
import { refundFailureFromEvent } from "./refundFailureModel";
import { hasSettled, isCancelled } from "../orders/status";
import { unlinkedDisputeAlert } from "../notifications/orderEmails";

/** Hydrate a paid session's line items, using live variants for compact metadata. */
async function sessionItems(ctx: ActionCtx, metadata: Record<string, string> | null | undefined) {
  return await hydrateOrderItems(metadata, (variantId) => ctx.runQuery(api.catalog.queries.getVariantById, { variantId }));
}

/** Checkout session behind a charge or dispute: listed by payment intent first. */
async function sessionIdForPaymentIntent(stripe: Stripe, paymentIntent: string): Promise<string | undefined> {
  try {
    const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent, limit: 1 });
    if (sessions.data.length > 0) return sessions.data[0].id;
  } catch {
    /* fallback */
  }
  return undefined;
}

/** Session id that a non-settlement event refers to, when Stripe can tell us. */
async function sessionIdForEvent(stripe: Stripe, event: Stripe.Event): Promise<string | undefined> {
  if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    return (event.data.object as Stripe.Checkout.Session).id;
  }
  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const sessionId = (charge as any).checkout_session || undefined;
    if (sessionId || !charge.payment_intent) return sessionId;
    return await sessionIdForPaymentIntent(stripe, charge.payment_intent as string);
  }
  const dispute = event.data.object as Stripe.Dispute;
  if (!dispute.payment_intent) return undefined;
  const sessionId = await sessionIdForPaymentIntent(stripe, dispute.payment_intent as string);
  if (sessionId) return sessionId;
  try {
    const pi = await stripe.paymentIntents.retrieve(dispute.payment_intent as string, {
      expand: ["charges.data.checkout_session"],
    });
    return ((pi as any)?.charges?.data?.[0]?.checkout_session as string) || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Resolve the order: current session id first, then via the session's own metadata
 * or charge metadata (covers refreshed links whose replaced sessions live only in bounded history).
 */
async function orderForEvent(ctx: ActionCtx, stripe: Stripe, event: Stripe.Event, sessionId: string | undefined) {
  let order: any = null;
  if (sessionId) {
    order = await ctx.runQuery(internal.orders.functions.getOrderByStripeSessionIdInternal, {
      stripeSessionId: sessionId,
    });
    if (!order) {
      try {
        const sessionObj = await stripe.checkout.sessions.retrieve(sessionId);
        const orderNumber = sessionObj.metadata?.orderNumber || sessionObj.client_reference_id || undefined;
        if (orderNumber) {
          order = await ctx.runQuery(internal.orders.functions.getOrderByNumberInternal, { orderNumber });
        }
      } catch {
        /* session not retrievable */
      }
    }
  }

  if (!order && event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const orderNum = charge.metadata?.orderNumber;
    if (orderNum) {
      order = await ctx.runQuery(internal.orders.functions.getOrderByNumberInternal, { orderNumber: orderNum });
    }
  }
  return order;
}

export const syncCheckoutSession = action({
  args: {
    sessionId: v.string(),
  },
  returns: v.object({ success: v.boolean(), orderId: v.optional(v.id("orders")), status: v.string() }),
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    orderId?: any;
    status: string;
  }> => {
    // Public and unauthenticated, and every call reaches Stripe: only `cs_` ids, under a budget (M1).
    if (!args.sessionId.startsWith("cs_")) return { success: false, status: "unrecognized_session" };
    if (!(await allowStripeSessionLookup(ctx, args.sessionId, "sync"))) {
      return { success: false, status: "rate_limited" };
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(args.sessionId, {
      expand: ["total_details.breakdown", "invoice"],
    });

    // S8 gate: only accept sessions that carry this app's own checkout contract. A paid
    // session with no order contract is rejected, so this repair path cannot be used to
    // mint orders for unrelated session ids.
    const metadata = session.metadata || {};
    if (!metadata.orderNumber || !metadata.itemsJson) {
      return { success: false, status: "unrecognized_session" };
    }

    if (session.payment_status === "paid") {
      const items = await sessionItems(ctx, metadata);
      const orderId: any = await ctx.runMutation(
        internal.orders.settlement.createOrUpdateStripeOrder,
        settlementFromSession(session, items, { useClientReference: false })
      );

      return { success: true, orderId, status: "paid" };
    }

    return { success: false, status: session.payment_status };
  },
});

/**
 * INTERNAL Stripe webhook processor. Signature-verified, replay-deduped, with coverage for
 * the settlement lifecycle: completed / async_payment_failed / expired / refunded / disputes,
 * and ledger refunds Stripe failed or canceled after accepting them.
 */
export const fulfillStripeWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
  },
  returns: v.object({ received: v.boolean() }),
  handler: async (
    ctx,
    args
  ): Promise<{
    received: boolean;
  }> => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripe = getStripe();

    // Every deployment verifies: an unsigned event could settle an order as paid.
    // Locally, `stripe listen` prints the whsec_ to set.
    if (!webhookSecret) {
      throw new Error("STRIPE_WEBHOOK_SECRET is not configured; refusing unsigned Stripe events.");
    }
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(args.payload, args.signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      throw new Error(`Webhook Error: ${err.message}`);
    }

    if (!isHandledStripeEvent(event.type)) {
      // Ack unrelated events quickly (e.g. customer.created) without side effects.
      return { received: true };
    }

    // ── Invoice Paid / Official PDF Ready ───────────────────────────────────────
    if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.id) {
        await ctx.runMutation(internal.orders.settlement.attachStripeInvoiceInternal, {
          orderNumber: invoice.metadata?.orderNumber || undefined,
          stripeInvoiceId: invoice.id,
          invoicePdfUrl: invoice.invoice_pdf || undefined,
          hostedInvoiceUrl: invoice.hosted_invoice_url || undefined,
        });
      }
      return { received: true };
    }

    // ── Settlement ──────────────────────────────────────────────────────────────
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      let session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_status !== "paid") {
        // completed fires only when paid for card flows; trust the retrieved status.
        session = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ["total_details.breakdown", "invoice"],
        });
        if (session.payment_status !== "paid") return { received: true };
      }

      // Retrieve full session with tax breakdown and invoice if not already present
      if ((!session.total_details?.breakdown || !session.invoice) && session.id) {
        try {
          session = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ["total_details.breakdown", "invoice"],
          });
        } catch (e) {
          console.warn("Could not retrieve expanded session in webhook, continuing with payload:", e);
        }
      }

      const items = await sessionItems(ctx, session.metadata);
      await ctx.runMutation(
        internal.orders.settlement.createOrUpdateStripeOrder,
        settlementFromSession(session, items, { webhookEventId: event.id, useClientReference: true })
      );
      return { received: true };
    }

    // ── Refund failed or canceled after Stripe accepted it (ADR 0025) ─────────────
    // Linked through the refund ledger, not the Checkout session. A refund.updated for any
    // other status is acknowledged without side effects.
    if (event.type === "refund.failed" || event.type === "refund.updated") {
      const failure = refundFailureFromEvent(event.type, event.data.object as Stripe.Refund);
      if (failure) {
        await ctx.runMutation(internal.payments.refundLedger.failIssuedRefundFromStripe, {
          ...failure,
          webhookEventId: event.id,
        });
      }
      return { received: true };
    }

    // ── Non-settlement lifecycle: link every session-shaped event to its order ──
    const sessionId = await sessionIdForEvent(stripe, event);
    const order = await orderForEvent(ctx, stripe, event, sessionId);

    if (!order) {
      console.warn(`Stripe ${event.type} could not be linked to an order (session: ${sessionId || "none"}); ignoring.`);
      // A dispute still needs a response in Stripe even when no order matches it.
      if (event.type === "charge.dispute.created" || event.type === "charge.dispute.closed") {
        const dispute = event.data.object as Stripe.Dispute;
        const { amount, currency } = disputeFigures(dispute);
        await ctx.scheduler.runAfter(0, internal.notifications.emails.sendAdminAlert, {
          alert: unlinkedDisputeAlert({
            disputeId: dispute.id,
            status: dispute.status,
            amount,
            currency,
            reason: dispute.reason || undefined,
            paymentIntent: typeof dispute.payment_intent === "string" ? dispute.payment_intent : undefined,
          }),
        });
      }
      return { received: true };
    }

    // ── Dedicated Refund Lifecycle Handler ─────────────────────────────────────
    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const { refundedAmount, isFullRefund } = refundFromCharge(charge);

      await ctx.runMutation(internal.orders.settlement.recordStripeRefundInternal, {
        orderId: order._id,
        orderNumber: order.orderNumber,
        refundedAmount,
        isFullRefund,
        webhookEventId: event.id,
        stripeChargeId: charge.id,
      });

      return { received: true };
    }

    // ── Dedicated Dispute Lifecycle Handlers ────────────────────────────────────
    if (event.type === "charge.dispute.created" || event.type === "charge.dispute.closed") {
      const dispute = event.data.object as Stripe.Dispute;
      const { amount, currency, evidenceDueBy, outcome } = disputeFigures(dispute);
      const isClosed = event.type === "charge.dispute.closed";

      await ctx.runMutation(internal.orders.settlement.recordStripeDisputeInternal, {
        orderId: order._id,
        orderNumber: order.orderNumber,
        disputeId: dispute.id,
        status: dispute.status,
        amount,
        currency,
        reason: dispute.reason,
        ...(isClosed ? {} : { evidenceDueBy }),
        webhookEventId: event.id,
        action: isClosed ? "closed" : "opened",
      });

      await ctx.scheduler.runAfter(0, internal.notifications.emails.sendAdminDisputeAlert, {
        orderNumber: order.orderNumber,
        disputeId: dispute.id,
        amount,
        currency,
        reason: dispute.reason,
        status: dispute.status,
        ...(isClosed ? { isClosed: true, outcome } : { evidenceDueBy, isClosed: false }),
      });

      return { received: true };
    }

    // ── Generic Non-settlement Handlers (expired sessions & async payment failures) ──
    const auditType =
      event.type === "checkout.session.expired"
        ? "session_expired"
        : "async_payment_failed";

    // Replay guard: skip if this exact event was already applied to the order.
    if (order.webhookEventIds?.includes(event.id)) {
      return { received: true };
    }

    // Checkout Hold (ADR 0024): Stripe says the session expired unpaid, or its delayed payment
    // (e.g. a bank debit) failed, so the Order awaiting payment is cancelled and its units go
    // back. The mutation ignores a settled or replaced hold.
    if (!hasSettled(order) && !isCancelled(order)) {
      await ctx.runMutation(internal.orders.checkoutHold.releaseCheckoutHold, {
        orderId: order._id,
        stripeSessionId: sessionId,
        reason: event.type === "checkout.session.expired" ? "session_expired" : "async_payment_failed",
        webhookEventId: event.id,
      });
    }

    await ctx.runMutation(internal.orders.settlement.recordWebhookEventIdInternal, {
      orderId: order._id,
      webhookEventId: event.id,
    });

    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId: order._id,
      orderNumber: order.orderNumber,
      type: auditType,
      stripeEventId: event.id,
      stripeSessionId: sessionId,
      details: `Stripe ${event.type}`,
    });

    return { received: true };
  },
});
