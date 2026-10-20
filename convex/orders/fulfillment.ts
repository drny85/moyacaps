/**
 * Fulfillment writes (ADR 0012): commit a purchased shipping label to its order and
 * apply carrier tracking webhook scans. Called by shipping/functions.ts and http.ts.
 */
import { internalMutation } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { hasEmail } from "./shared";
import { fulfillmentStatusValidator, planLabelPurchase, statusAxes, statusPatch } from "./status";
import { planTrackingUpdate } from "./tracking";

/**
 * INTERNAL: Commits shipping label purchase to an order, moves Fulfillment Status to label
 * purchased (Payment Status untouched), logs fulfillment audit trail, and schedules dispatch
 * email notification. Buying a label never moves stock: a paid order already took its units.
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

    const plan = planLabelPurchase(order);
    if (!plan.ok) {
      throw new ConvexError(plan.error);
    }
    const now = Date.now();

    await ctx.db.patch(args.orderId, {
      ...statusPatch(order, { fulfillmentStatus: plan.fulfillmentStatus }),
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

    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId: args.orderId,
      orderNumber: order.orderNumber,
      type: "shipping_label_created",
      actor: args.actor || "admin",
      details: `${args.carrier} (${args.shippingServiceLevel || "Standard"}) - Tracking: ${args.trackingNumber} - Cost: $${args.shippingCost?.toFixed(2) ?? "0.00"}`,
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

    if (plan.event) {
      await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
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
