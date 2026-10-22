/**
 * Fulfillment writes (ADR 0012, plan 0008 "Fulfillment"): commit a purchased shipping label
 * (first label or Reship) to its order and apply carrier tracking webhook scans. Called by
 * shipping/functions.ts and http.ts.
 */
import { internalMutation } from "../lib/functions";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { hasEmail } from "./shared";
import { fulfillmentStatusValidator, planLabelPurchase, statusAxes, statusPatch } from "./status";
import { appendLabel } from "./labels";
import { planTrackingUpdate } from "./tracking";
import { scheduleReviewInvite } from "../reviews/invites";
import { insertPaymentEvent } from "./paymentEvents";
import { claimShippedNotice } from "./handoff";
import { scheduleShippedEmail } from "./shippedNotice";

/**
 * INTERNAL: Commits a purchased shipping label to an order: adds it to the label history,
 * mirrors it on the flat shipping fields, moves Fulfillment Status to label purchased (Payment
 * Status untouched), logs the audit trail and schedules the dispatch email. Re-checks the label
 * rules (status.ts planLabelPurchase), so a label bought while the order was cancelled or
 * disputed is refused here too. Buying a label never moves stock: a paid order already took its units.
 */
export const attachShippingLabelInternal = internalMutation({
  args: {
    orderId: v.id("orders"),
    carrier: v.string(),
    trackingNumber: v.string(),
    shippingLabelUrl: v.string(),
    shippingRateId: v.optional(v.string()),
    shippingTransactionId: v.optional(v.string()),
    shippingServiceLevel: v.optional(v.string()),
    shippingCost: v.optional(v.number()),
    shippingEstimatedDays: v.optional(v.number()),
    shippingLabelFileType: v.optional(v.string()),
    carrierTrackingUrl: v.optional(v.string()),
    parcelDimensions: v.optional(
      v.object({
        length: v.number(),
        width: v.number(),
        height: v.number(),
        weight: v.number(),
        unit: v.string(),
      })
    ),
    actor: v.optional(v.string()),
    // A new label after a Delivery Exception or a return to sender (CONTEXT.md "Reship").
    reship: v.optional(v.boolean()),
  },
  returns: v.object({
    success: v.boolean(),
    orderId: v.id("orders"),
    trackingNumber: v.string(),
    labelUrl: v.string(),
    fulfillmentStatus: fulfillmentStatusValidator,
  }),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error(`Order ${args.orderId} not found`);
    }

    const plan = planLabelPurchase(order, { reship: args.reship });
    if (!plan.ok) {
      throw new ConvexError(plan.error);
    }
    const now = Date.now();

    await ctx.db.patch(args.orderId, {
      ...statusPatch(order, { fulfillmentStatus: plan.fulfillmentStatus }),
      labels: appendLabel(order, {
        carrier: args.carrier,
        trackingNumber: args.trackingNumber,
        labelUrl: args.shippingLabelUrl,
        ...(args.shippingTransactionId !== undefined && { transactionId: args.shippingTransactionId }),
        ...(args.shippingRateId !== undefined && { rateId: args.shippingRateId }),
        ...(args.shippingServiceLevel !== undefined && { serviceLevel: args.shippingServiceLevel }),
        ...(args.shippingCost !== undefined && { cost: args.shippingCost }),
        purchasedAt: now,
        reship: plan.reship,
      }),
      // A Reship starts a new package: the old one's scan results no longer describe it.
      ...(plan.reship && {
        trackingStatus: undefined,
        trackingStatusDetails: undefined,
        trackingStatusDate: undefined,
        trackingLocation: undefined,
      }),
      carrier: args.carrier,
      trackingNumber: args.trackingNumber,
      shippingCarrier: args.carrier,
      shippingLabelUrl: args.shippingLabelUrl,
      shippingRateId: args.shippingRateId,
      shippingTransactionId: args.shippingTransactionId,
      shippingServiceLevel: args.shippingServiceLevel,
      shippingCost: args.shippingCost,
      shippingEstimatedDays: args.shippingEstimatedDays,
      shippingLabelFileType: args.shippingLabelFileType,
      ...(args.parcelDimensions && { parcelDimensions: args.parcelDimensions }),
      updatedAt: now,
    });

    await insertPaymentEvent(ctx, {
      orderId: args.orderId,
      orderNumber: order.orderNumber,
      type: plan.reship ? "shipping_label_reshipped" : "shipping_label_created",
      actor: args.actor || "admin",
      details: `${plan.reship ? "Reship: " : ""}${args.carrier} (${args.shippingServiceLevel || "Standard"}) - Tracking: ${args.trackingNumber} - Cost: $${args.shippingCost?.toFixed(2) ?? "0.00"}`,
    });

    // Send dispatch confirmation email to customer
    if (hasEmail(order.customerEmail)) {
      await ctx.scheduler.runAfter(0, internal.notifications.emails.sendOrderDispatchedEmail, {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        carrier: args.carrier,
        trackingNumber: args.trackingNumber,
        carrierTrackingUrl: args.carrierTrackingUrl,
        estimatedDelivery: args.shippingEstimatedDays ? `${args.shippingEstimatedDays} Business Days` : undefined,
        shippingAddress: order.shippingAddress,
        items: order.items,
      });
    }

    return {
      success: true,
      orderId: args.orderId,
      trackingNumber: args.trackingNumber,
      labelUrl: args.shippingLabelUrl,
      fulfillmentStatus: plan.fulfillmentStatus,
    };
  },
});

/**
 * INTERNAL: Processes automated carrier tracking webhooks (e.g. from Shippo track_updated).
 * Moves Fulfillment Status from carrier scans (never Payment Status), triggers delivery emails,
 * and alerts admins on transit failure or return exceptions while respecting manual overrides.
 */
export const handleTrackingWebhookInternal = internalMutation({
  args: {
    trackingNumber: v.string(),
    carrier: v.optional(v.string()),
    status: v.string(), // "PRE_TRANSIT" | "TRANSIT" | "DELIVERED" | "RETURNED" | "FAILURE" | "UNKNOWN"
    statusDetails: v.optional(v.string()),
    statusDate: v.optional(v.string()),
    location: v.optional(
      v.object({
        city: v.optional(v.string()),
        state: v.optional(v.string()),
        zip: v.optional(v.string()),
        country: v.optional(v.string()),
      })
    ),
  },
  returns: v.union(
    v.object({ found: v.literal(false), ignored: v.literal(true) }),
    v.object({
      found: v.literal(true),
      orderNumber: v.string(),
      orderId: v.id("orders"),
      trackingStatus: v.string(),
      fulfillmentStatus: fulfillmentStatusValidator,
    })
  ),
  handler: async (ctx, args) => {
    const cleanTrk = args.trackingNumber.trim();
    const order = await ctx.db
      .query("orders")
      .withIndex("by_trackingNumber", (q) => q.eq("trackingNumber", cleanTrk))
      .first();

    if (!order) {
      console.log(`[TrackingWebhook] Order with tracking number "${cleanTrk}" not found in system.`);
      return { found: false as const, ignored: true as const };
    }

    const plan = planTrackingUpdate(order, args, Date.now());

    // The first scan that puts the package in transit tells the Customer it shipped, unless a
    // Handoff already did (ADR 0030).
    const shippedLabels = plan.fulfillmentStatus === "in_transit" ? claimShippedNotice(order, Date.now()) : null;
    if (shippedLabels) {
      plan.patch.labels = shippedLabels;
      await scheduleShippedEmail(ctx, order, { carrier: order.carrier || args.carrier, trackingNumber: order.trackingNumber || cleanTrk });
    }

    if (plan.event) {
      await insertPaymentEvent(ctx, {
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: plan.event.type,
        actor: "courier_webhook",
        details: plan.event.details,
      });
    }

    // Send celebratory delivery email
    if (plan.delivered && hasEmail(order.customerEmail)) {
      await ctx.scheduler.runAfter(0, internal.notifications.emails.sendOrderDeliveredEmail, {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        carrier: order.carrier || args.carrier || "USPS",
        trackingNumber: order.trackingNumber || cleanTrk,
        deliveredLocation: plan.locationStr || "Delivery Destination",
        deliveredDetails: args.statusDetails,
        items: order.items,
      });
      await scheduleReviewInvite(ctx, order, Date.now());
    }

    // Delivery Exception or returned to sender: tell the Administrator and the Customer, who
    // then hear whether it is reshipped or refunded.
    if (plan.fulfillmentStatus === "delivery_exception" || plan.fulfillmentStatus === "returned") {
      await ctx.scheduler.runAfter(0, internal.notifications.emails.sendDeliveryExceptionEmails, {
        orderNumber: order.orderNumber,
        kind: plan.fulfillmentStatus,
        customerName: order.customerName,
        ...(hasEmail(order.customerEmail) && { customerEmail: order.customerEmail }),
        carrier: order.carrier || args.carrier || "Carrier",
        trackingNumber: order.trackingNumber || cleanTrk,
        details: args.statusDetails,
        location: plan.locationStr,
      });
    }

    await ctx.db.patch(order._id, plan.patch);

    return {
      found: true as const,
      orderNumber: order.orderNumber,
      orderId: order._id,
      trackingStatus: plan.trackingStatus,
      fulfillmentStatus: plan.fulfillmentStatus ?? statusAxes(order).fulfillmentStatus,
    };
  },
});
