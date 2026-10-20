/**
 * Stripe settlement writes (ADR 0006, ADR 0010): paid sessions become paid orders (flagged
 * for refund when they ship outside the Fulfillment Territory), refunds and disputes are
 * recorded, and Stripe customer/invoice ids are attached.
 * Called only by the Stripe actions (payments/webhook, payments/checkout).
 */
import { internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { v } from "convex/values";
import type { Infer } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { checkFulfillmentTerritory, outOfTerritoryNote } from "../shipping/territory";
import {
  appendBoundedId,
  appendNote,
  decideStripeSettlement,
  hasProcessedWebhookEvent,
  isPaidLike,
  newTrackingNumber,
  planRefund,
  settlementStockAction,
  withWebhookEventId,
} from "./model";
import {
  deductStock,
  getOrderByNumber,
  getOrderByStripeSessionId,
  hasEmail,
  mirrorStripeCustomerToUser,
} from "./shared";
import { orderItemValidator, shippingAddressValidator, successResult } from "./validators";

/**
 * Plan 0008 PR 4: a paid Order whose shipping address is outside the Fulfillment Territory
 * stays settled (the money was taken) but is flagged so an Administrator refunds it before
 * packing: an adminNotes line, an `out_of_territory` payment event and an admin alert email.
 * Never refunds by itself. Runs once per settlement (replays return before it).
 */
async function flagIfOutOfTerritory(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  settled: {
    orderNumber: string;
    shippingAddress?: Infer<typeof shippingAddressValidator>;
    total: number;
    currency: string;
    customerName?: string;
    customerEmail?: string;
    webhookEventId?: string;
    stripeSessionId: string;
  }
): Promise<void> {
  if (!settled.shippingAddress) return;
  const verdict = checkFulfillmentTerritory(settled.shippingAddress);
  if (verdict.inTerritory) return;

  const order = await ctx.db.get(orderId);
  if (!order) return;
  await ctx.db.patch(orderId, {
    adminNotes: appendNote(order.adminNotes, outOfTerritoryNote(verdict, settled.total, settled.currency)),
    updatedAt: Date.now(),
  });
  await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
    orderId,
    orderNumber: settled.orderNumber,
    type: "out_of_territory",
    stripeEventId: settled.webhookEventId,
    stripeSessionId: settled.stripeSessionId,
    actor: "system",
    details: `${verdict.exclusion}: ${verdict.reason} Refund before packing.`,
  });
  await ctx.scheduler.runAfter(0, internal.notifications.emails.sendAdminTerritoryAlert, {
    orderNumber: settled.orderNumber,
    total: settled.total,
    currency: settled.currency,
    reason: verdict.reason,
    customerName: settled.customerName,
    customerEmail: settled.customerEmail,
    shippingAddress: settled.shippingAddress,
  });
}

/**
 * INTERNAL: record a processed Stripe event id on the order (bounded replay guard).
 */
export const recordWebhookEventIdInternal = internalMutation({
  args: {
    orderId: v.id("orders"),
    webhookEventId: v.string(),
  },
  returns: successResult,
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) return { success: false };
    if (hasProcessedWebhookEvent(order, args.webhookEventId)) return { success: true };
    await ctx.db.patch(args.orderId, { webhookEventIds: appendBoundedId(order.webhookEventIds, args.webhookEventId) });
    return { success: true };
  },
});

/**
 * INTERNAL: record a Stripe refund on the order. Sets status to "refunded" (if 100% refunded)
 * or "partially_refunded", updates refundedAmount, and audits the event.
 * NOTE: Does NOT restock physical inventory automatically (manual inspection required for physical apparel).
 */
export const recordStripeRefundInternal = internalMutation({
  args: {
    orderId: v.id("orders"),
    orderNumber: v.string(),
    refundedAmount: v.number(),
    isFullRefund: v.boolean(),
    webhookEventId: v.string(),
    stripeChargeId: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    replayed: v.optional(v.boolean()),
    status: v.optional(v.union(v.literal("refunded"), v.literal("partially_refunded"))),
  }),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      console.warn(`Order ${args.orderId} not found for Stripe refund event ${args.webhookEventId}`);
      return { success: false };
    }

    if (hasProcessedWebhookEvent(order, args.webhookEventId)) {
      return { success: true, replayed: true };
    }

    const refund = planRefund(order.refundedAmount, args.refundedAmount, args.isFullRefund);

    await ctx.db.patch(args.orderId, {
      status: refund.status,
      refundedAmount: refund.refundedAmount,
      webhookEventIds: withWebhookEventId(order, args.webhookEventId),
      updatedAt: Date.now(),
    });

    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId: args.orderId,
      orderNumber: args.orderNumber,
      type: args.isFullRefund ? "charge_refunded" : "charge_partially_refunded",
      stripeEventId: args.webhookEventId,
      details: `${args.isFullRefund ? "Full" : "Partial"} refund of $${args.refundedAmount.toFixed(
        2
      )} processed via Stripe${args.stripeChargeId ? ` (${args.stripeChargeId})` : ""}. Total refunded: $${refund.refundedAmount.toFixed(
        2
      )}. Physical inventory retained (manual restock required).`,
      actor: "stripe_webhook",
    });

    return { success: true, status: refund.status };
  },
});

/**
 * INTERNAL: record a Stripe dispute / chargeback opened or closed on an order.
 * Flags the order, records audit trail, and prepares for admin response.
 */
export const recordStripeDisputeInternal = internalMutation({
  args: {
    orderId: v.id("orders"),
    orderNumber: v.string(),
    disputeId: v.string(),
    status: v.string(),
    amount: v.number(),
    currency: v.string(),
    reason: v.optional(v.string()),
    evidenceDueBy: v.optional(v.number()),
    webhookEventId: v.string(),
    action: v.union(v.literal("opened"), v.literal("closed")),
  },
  returns: v.object({ success: v.boolean(), replayed: v.optional(v.boolean()) }),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      console.warn(`Order ${args.orderId} not found for Stripe dispute event ${args.webhookEventId}`);
      return { success: false };
    }

    if (hasProcessedWebhookEvent(order, args.webhookEventId)) {
      return { success: true, replayed: true };
    }

    if (args.action === "opened") {
      const dueStr = args.evidenceDueBy
        ? new Date(args.evidenceDueBy).toLocaleDateString()
        : "deadline unknown";
      const disputeMsg = `⚠️ CHARGEBACK DISPUTE: $${args.amount.toFixed(2)} ${args.currency} (${args.reason || "general"}). Status: ${args.status}. Due by: ${dueStr}. Respond in Stripe Dashboard.`;

      await ctx.db.patch(args.orderId, {
        disputed: true,
        disputeDetails: disputeMsg,
        adminNotes: appendNote(order.adminNotes, disputeMsg),
        webhookEventIds: withWebhookEventId(order, args.webhookEventId),
        updatedAt: Date.now(),
      });

      await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
        orderId: args.orderId,
        orderNumber: args.orderNumber,
        type: "dispute_created",
        stripeEventId: args.webhookEventId,
        details: `Dispute ${args.disputeId} opened: $${args.amount.toFixed(2)} ${args.currency}, Reason: ${args.reason || "none"}, Status: ${args.status}`,
        actor: "stripe_webhook",
      });
    } else {
      const isWon = args.status === "won";
      const closeMsg = `ℹ️ DISPUTE CLOSED: ${isWon ? "WON by merchant" : "LOST by merchant"} (${args.status}).`;

      await ctx.db.patch(args.orderId, {
        disputed: false,
        disputeDetails: closeMsg,
        adminNotes: appendNote(order.adminNotes, closeMsg),
        webhookEventIds: withWebhookEventId(order, args.webhookEventId),
        updatedAt: Date.now(),
      });

      await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
        orderId: args.orderId,
        orderNumber: args.orderNumber,
        type: "dispute_closed",
        stripeEventId: args.webhookEventId,
        details: `Dispute ${args.disputeId} closed with status: ${args.status} (${isWon ? "Merchant won" : "Merchant lost"})`,
        actor: "stripe_webhook",
      });
    }

    return { success: true };
  },
});

export const createOrUpdateStripeOrder = internalMutation({
  args: {
    stripeSessionId: v.string(),
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
    tax: v.optional(v.number()),
    taxDetails: v.optional(
      v.object({
        amount: v.number(),
        rate: v.optional(v.number()),
        jurisdiction: v.optional(v.string()),
      })
    ),
    total: v.number(),
    // Stripe customer ID (upserted or auto-created by Checkout)
    stripeCustomerId: v.optional(v.string()),
    // Stripe Invoice details
    stripeInvoiceId: v.optional(v.string()),
    invoicePdfUrl: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),
    // Stripe event id that triggered this settlement (bounded replay-dedupe guard).
    webhookEventId: v.optional(v.string()),
  },
  returns: v.id("orders"),
  handler: async (ctx, args) => {
    // Check if order exists by stripeSessionId or orderNumber (e.g. GL-WA-XXXXXXXX)
    let existing = await getOrderByStripeSessionId(ctx, args.stripeSessionId);
    if (!existing && args.orderNumber) {
      existing = await getOrderByNumber(ctx, args.orderNumber);
    }

    if (existing) {
      const decision = decideStripeSettlement(existing, args);

      // Replay guard: this exact Stripe event was already applied to this order.
      if (decision === "replay") {
        return existing._id;
      }

      // Double-settlement guard (M2): order was already settled and a different Stripe
      // session paid it again. NEVER silently overwrite — flag for human review/refund decision.
      if (decision === "double_settlement") {
        await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
          orderId: existing._id,
          orderNumber: existing.orderNumber,
          type: "double_settlement_attempted",
          stripeEventId: args.webhookEventId,
          stripeSessionId: args.stripeSessionId,
          details: `Order already ${existing.status} via session ${existing.stripeSessionId ?? "none"} but Stripe session ${args.stripeSessionId} also completed with amount ${args.total}. Manual refund review required.`,
        });
        await ctx.db.patch(existing._id, {
          adminNotes: appendNote(
            existing.adminNotes,
            `⚠️ DOUBLE SETTLEMENT: Stripe session ${args.stripeSessionId} paid $${args.total} after order was already ${existing.status}. Refund one side manually.`
          ),
          updatedAt: Date.now(),
        });
        return existing._id;
      }

      // A cancelled order had its stock released; settling it would sell phantom inventory.
      // Flag for human review (e.g. refund-after-cancel races), never auto-settle.
      if (decision === "cancelled") {
        await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
          orderId: existing._id,
          orderNumber: existing.orderNumber,
          type: "double_settlement_attempted",
          stripeEventId: args.webhookEventId,
          stripeSessionId: args.stripeSessionId,
          details: `Stripe session ${args.stripeSessionId} completed on a CANCELLED order (${args.total} ${args.currency}). Stock was released; review manually.`,
        });
        await ctx.db.patch(existing._id, {
          adminNotes: appendNote(
            existing.adminNotes,
            `⚠️ Payment received on cancelled order via session ${args.stripeSessionId}. Re-create or refund manually.`
          ),
          updatedAt: Date.now(),
        });
        return existing._id;
      }

      const wasAwaitingPayment = !isPaidLike(existing.status);
      // A pending Order with a Checkout Hold took its units at Pay (ADR 0024): never deduct twice.
      const stock = settlementStockAction(existing);

      // Update with latest details and ensure paid
      await ctx.db.patch(existing._id, {
        customerEmail: args.customerEmail ?? existing.customerEmail,
        customerName: args.customerName ?? existing.customerName,
        customerPhone: args.customerPhone ?? existing.customerPhone,
        shippingAddress: args.shippingAddress ?? existing.shippingAddress,
        stripeCustomerId: args.stripeCustomerId ?? existing.stripeCustomerId,
        stripeInvoiceId: args.stripeInvoiceId ?? existing.stripeInvoiceId,
        invoicePdfUrl: args.invoicePdfUrl ?? existing.invoicePdfUrl,
        hostedInvoiceUrl: args.hostedInvoiceUrl ?? existing.hostedInvoiceUrl,
        tax: args.tax ?? existing.tax,
        taxDetails: args.taxDetails ?? existing.taxDetails,
        total: args.total ?? existing.total,
        status: "paid",
        paymentMethod: "stripe",
        stripeSessionId: args.stripeSessionId,
        stripeSessionIds: appendBoundedId(existing.stripeSessionIds, args.stripeSessionId),
        webhookEventIds: withWebhookEventId(existing, args.webhookEventId),
        trackingNumber: existing.trackingNumber ?? newTrackingNumber(),
        updatedAt: Date.now(),
      });
      if (stock === "deduct") await deductStock(ctx, existing.items);

      await mirrorStripeCustomerToUser(
        ctx,
        args.clerkUserId ?? existing.clerkUserId,
        args.stripeCustomerId ?? existing.stripeCustomerId
      );

      await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
        orderId: existing._id,
        orderNumber: existing.orderNumber,
        type: "stripe_settled",
        stripeEventId: args.webhookEventId,
        stripeSessionId: args.stripeSessionId,
        details: JSON.stringify({ total: args.total, tax: args.tax }),
      });

      await flagIfOutOfTerritory(ctx, existing._id, {
        ...args,
        orderNumber: existing.orderNumber,
        shippingAddress: args.shippingAddress ?? existing.shippingAddress,
        customerName: args.customerName ?? existing.customerName,
        customerEmail: args.customerEmail ?? existing.customerEmail,
      });

      // M4: an order created before payment (every card checkout since ADR 0024) never hits
      // the insert branch below, so the admin alert and customer receipt are queued here.
      if (wasAwaitingPayment) {
        await ctx.scheduler.runAfter(0, internal.notifications.emails.sendAdminOrderAlert, {
          orderNumber: existing.orderNumber,
          total: args.total,
          currency: args.currency,
          paymentMethod: "stripe",
          customerName: args.customerName ?? existing.customerName,
          customerEmail: args.customerEmail ?? existing.customerEmail,
          customerPhone: args.customerPhone ?? existing.customerPhone,
          shippingAddress: args.shippingAddress ?? existing.shippingAddress,
          items: existing.items,
          subtotal: args.subtotal ?? existing.subtotal,
          shippingFee: args.shippingFee ?? existing.shippingFee,
          tax: args.tax,
          createdAt: existing.createdAt,
        });
      }
      if (wasAwaitingPayment && hasEmail(args.customerEmail)) {
        await ctx.scheduler.runAfter(0, internal.notifications.emails.sendCustomerReceipt, {
          orderNumber: existing.orderNumber,
          total: args.total,
          currency: args.currency,
          customerName: args.customerName ?? existing.customerName,
          customerEmail: args.customerEmail,
          shippingAddress: args.shippingAddress ?? existing.shippingAddress,
          items: existing.items,
          subtotal: args.subtotal ?? existing.subtotal,
          shippingFee: args.shippingFee ?? existing.shippingFee,
          tax: args.tax,
        });
      }

      return existing._id;
    }

    // Insert new paid order. Legacy only: sessions opened before the Checkout Hold
    // (ADR 0024) have no Order yet; every newer session settles the existing branch above.
    const orderId = await ctx.db.insert("orders", {
      orderNumber: args.orderNumber,
      customerEmail: args.customerEmail,
      customerName: args.customerName,
      customerPhone: args.customerPhone,
      clerkUserId: args.clerkUserId,
      shippingAddress: args.shippingAddress,
      items: args.items,
      currency: args.currency,
      subtotal: args.subtotal,
      shippingFee: args.shippingFee,
      tax: args.tax,
      taxDetails: args.taxDetails,
      total: args.total,
      status: "paid",
      paymentMethod: "stripe",
      stripeSessionId: args.stripeSessionId,
      stripeSessionIds: [args.stripeSessionId],
      stripeCustomerId: args.stripeCustomerId,
      stripeInvoiceId: args.stripeInvoiceId,
      invoicePdfUrl: args.invoicePdfUrl,
      hostedInvoiceUrl: args.hostedInvoiceUrl,
      webhookEventIds: args.webhookEventId ? [args.webhookEventId] : undefined,
      trackingNumber: newTrackingNumber(),
      createdAt: Date.now(),
    });

    await mirrorStripeCustomerToUser(ctx, args.clerkUserId, args.stripeCustomerId);

    await deductStock(ctx, args.items);

    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId,
      orderNumber: args.orderNumber,
      type: "stripe_settled",
      stripeEventId: args.webhookEventId,
      stripeSessionId: args.stripeSessionId,
      details: JSON.stringify({ total: args.total, tax: args.tax }),
    });

    await flagIfOutOfTerritory(ctx, orderId, args);

    // Schedule Admin Order Alert for new paid Stripe order
    await ctx.scheduler.runAfter(0, internal.notifications.emails.sendAdminOrderAlert, {
      orderNumber: args.orderNumber,
      total: args.total,
      currency: args.currency,
      paymentMethod: "stripe",
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      customerPhone: args.customerPhone,
      shippingAddress: args.shippingAddress,
      items: args.items,
      subtotal: args.subtotal,
      shippingFee: args.shippingFee,
      tax: args.tax,
      createdAt: Date.now(),
    });

    // Schedule Customer Order Confirmation receipt if email provided
    if (hasEmail(args.customerEmail)) {
      await ctx.scheduler.runAfter(0, internal.notifications.emails.sendCustomerReceipt, {
        orderNumber: args.orderNumber,
        total: args.total,
        currency: args.currency,
        customerName: args.customerName,
        customerEmail: args.customerEmail,
        shippingAddress: args.shippingAddress,
        items: args.items,
        subtotal: args.subtotal,
        shippingFee: args.shippingFee,
        tax: args.tax,
      });
    }

    return orderId;
  },
});

/**
 * INTERNAL only: links a (re)used Stripe Customer object to an order.
 */
export const attachStripeCustomerInternal = internalMutation({
  args: {
    orderId: v.id("orders"),
    stripeCustomerId: v.string(),
  },
  returns: successResult,
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      stripeCustomerId: args.stripeCustomerId,
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

/**
 * INTERNAL only: attaches Stripe Invoice ID and PDF receipt link to an order.
 */
export const attachStripeInvoiceInternal = internalMutation({
  args: {
    orderNumber: v.optional(v.string()),
    stripeSessionId: v.optional(v.string()),
    stripeInvoiceId: v.string(),
    invoicePdfUrl: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), orderId: v.optional(v.id("orders")), reason: v.optional(v.string()) }),
  handler: async (ctx, args) => {
    let order = null;
    if (args.orderNumber) {
      order = await getOrderByNumber(ctx, args.orderNumber);
    }
    if (!order && args.stripeSessionId) {
      order = await getOrderByStripeSessionId(ctx, args.stripeSessionId);
    }
    if (!order && args.stripeInvoiceId) {
      order = await ctx.db
        .query("orders")
        .withIndex("by_stripeInvoiceId", (q) => q.eq("stripeInvoiceId", args.stripeInvoiceId))
        .first();
    }
    if (order) {
      await ctx.db.patch(order._id, {
        stripeInvoiceId: args.stripeInvoiceId,
        invoicePdfUrl: args.invoicePdfUrl ?? order.invoicePdfUrl,
        hostedInvoiceUrl: args.hostedInvoiceUrl ?? order.hostedInvoiceUrl,
        updatedAt: Date.now(),
      });
      return { success: true, orderId: order._id };
    }
    return { success: false, reason: "Order not found" };
  },
});
