"use node";

/**
 * Stripe settlement actions (ADR 0006): the signature-verified webhook (settlement,
 * invoices, refunds, disputes, expired/failed sessions) and the success-page repair
 * path that settles a paid session the webhook has not delivered yet.
 */
import { action, internalAction } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import Stripe from "stripe";
import { getStripe } from "./stripeClient";
import {
  disputeFigures,
  hydrateOrderItems,
  isHandledStripeEvent,
  refundFromCharge,
  settlementFromSession,
} from "./stripeSettlementModel";

/** Hydrate a paid session's line items, using live variants for compact metadata. */
async function sessionItems(ctx: ActionCtx, metadata: Record<string, string> | null | undefined) {
  return await hydrateOrderItems(metadata, (variantId) => ctx.runQuery(api.catalog.getVariantById, { variantId }));
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
    order = await ctx.runQuery(internal.orders.getOrderByStripeSessionIdInternal, {
      stripeSessionId: sessionId,
    });
    if (!order) {
      try {
        const sessionObj = await stripe.checkout.sessions.retrieve(sessionId);
        const orderNumber = sessionObj.metadata?.orderNumber || sessionObj.client_reference_id || undefined;
        if (orderNumber) {
          order = await ctx.runQuery(internal.orders.getOrderByNumberInternal, { orderNumber });
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
      order = await ctx.runQuery(internal.orders.getOrderByNumberInternal, { orderNumber: orderNum });
    }
  }
  return order;
}

export const syncCheckoutSession = action({
  args: {
    sessionId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    orderId?: any;
    status: string;
  }> => {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(args.sessionId, {
      expand: ["total_details.breakdown", "invoice"],
    });

    // S8 gate: only accept sessions that carry this app's own checkout contract. A paid
    // session with no order contract is rejected, so this repair path cannot be used to
    // mint orders for unrelated session ids.
    const metadata = session.metadata || {};
    const isWhatsAppOrder = metadata.isWhatsAppOrder === "true";
    if (!metadata.orderNumber || !metadata.itemsJson) {
      return { success: false, status: "unrecognized_session" };
    }

    if (isWhatsAppOrder) {
      // WhatsApp leads must already exist in the DB; the webhook owns their settlement.
      const existing = await ctx.runQuery(internal.orders.getOrderByNumberInternal, {
        orderNumber: metadata.orderNumber,
      });
      if (!existing) {
        return { success: false, status: "unknown_order" };
      }
    }

    if (session.payment_status === "paid") {
      const items = await sessionItems(ctx, metadata);
      const orderId: any = await ctx.runMutation(
        internal.orderSettlement.createOrUpdateStripeOrder,
        settlementFromSession(session, items, { useClientReference: false })
      );

      return { success: true, orderId, status: "paid" };
    }

    return { success: false, status: session.payment_status };
  },
});

/**
 * INTERNAL Stripe webhook processor. Signature-verified, replay-deduped, with coverage for
 * the settlement lifecycle: completed / async_payment_failed / expired / refunded / disputes.
 */
export const fulfillStripeWebhook = internalAction({
  args: {
    payload: v.string(),
    signature: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    received: boolean;
  }> => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripe = getStripe();

    let event: Stripe.Event;
    if (webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(args.payload, args.signature, webhookSecret);
      } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        throw new Error(`Webhook Error: ${err.message}`);
      }
    } else {
      if (process.env.NODE_ENV === "production") {
        throw new Error("STRIPE_WEBHOOK_SECRET is not configured in production environment.");
      }
      // In dev or sandbox when secret is not configured, parse payload directly
      event = JSON.parse(args.payload) as Stripe.Event;
    }

    if (!isHandledStripeEvent(event.type)) {
      // Ack unrelated events quickly (e.g. customer.created) without side effects.
      return { received: true };
    }

    // ── Invoice Paid / Official PDF Ready ───────────────────────────────────────
    if (event.type === "invoice.paid" || event.type === "invoice.payment_succeeded") {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.id) {
        await ctx.runMutation(internal.orderSettlement.attachStripeInvoiceInternal, {
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
        internal.orderSettlement.createOrUpdateStripeOrder,
        settlementFromSession(session, items, { webhookEventId: event.id, useClientReference: true })
      );
      return { received: true };
    }

    // ── Non-settlement lifecycle: link every session-shaped event to its order ──
    const sessionId = await sessionIdForEvent(stripe, event);
    const order = await orderForEvent(ctx, stripe, event, sessionId);

    if (!order) {
      console.warn(`Stripe ${event.type} could not be linked to an order (session: ${sessionId || "none"}); ignoring.`);
      return { received: true };
    }

    // ── Dedicated Refund Lifecycle Handler ─────────────────────────────────────
    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      const { refundedAmount, isFullRefund } = refundFromCharge(charge);

      await ctx.runMutation(internal.orderSettlement.recordStripeRefundInternal, {
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

      await ctx.runMutation(internal.orderSettlement.recordStripeDisputeInternal, {
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

      await ctx.scheduler.runAfter(0, internal.emails.sendAdminDisputeAlert, {
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
    await ctx.runMutation(internal.orderSettlement.recordWebhookEventIdInternal, {
      orderId: order._id,
      webhookEventId: event.id,
    });

    await ctx.runMutation(internal.orders.recordPaymentEvent, {
      orderId: order._id,
      orderNumber: order.orderNumber,
      type: auditType,
      stripeEventId: event.id,
      stripeSessionId: sessionId,
      details: `Stripe ${event.type}`,
    });

    // Payment link expired at Stripe: if the reservation window also elapsed, release stock
    // immediately instead of waiting for the scheduled job.
    if (event.type === "checkout.session.expired" && order.status === "whatsapp_initiated") {
      await ctx.runMutation(internal.whatsappOrders.expireWhatsAppOrderLead, {
        orderId: order._id,
      });
    }

    return { received: true };
  },
});
