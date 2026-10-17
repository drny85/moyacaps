/**
 * Fulfillment writes (ADR 0012): commit a purchased shipping label to its order and
 * apply carrier tracking webhook scans. Called by shipping.ts and http.ts.
 */
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { holdsStock } from "./orderModel";
import { deductStock, hasEmail } from "./orderShared";
import { planTrackingUpdate } from "./trackingModel";

/**
 * INTERNAL: Commits shipping label purchase to an order, transitions status to dispatched,
 * logs fulfillment audit trail, and schedules dispatch email notification.
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
    status: v.union(v.literal("dispatched"), v.literal("delivered")),
  }),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error(`Order ${args.orderId} not found`);
    }

    const previousStatus = order.status;
    const now = Date.now();

    // Dispatching an order that never held stock (e.g. "pending") deducts it now.
    if (!holdsStock(previousStatus)) {
      await deductStock(ctx, order.items);
    }

    const nextStatus = previousStatus === "delivered" ? ("delivered" as const) : ("dispatched" as const);

    await ctx.db.patch(args.orderId, {
      status: nextStatus,
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

    await ctx.runMutation(internal.orders.recordPaymentEvent, {
      orderId: args.orderId,
      orderNumber: order.orderNumber,
      type: "shipping_label_created",
      actor: args.actor || "admin",
      details: `${args.carrier} (${args.shippingServiceLevel || "Standard"}) - Tracking: ${args.trackingNumber} - Cost: $${args.shippingCost?.toFixed(2) ?? "0.00"}`,
    });

    // Send dispatch confirmation email to customer
    if (hasEmail(order.customerEmail)) {
      await ctx.scheduler.runAfter(0, internal.emails.sendOrderDispatchedEmail, {
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
      status: nextStatus,
    };
  },
});

/**
 * INTERNAL: Processes automated carrier tracking webhooks (e.g. from Shippo track_updated).
 * Updates transit status, delivers orders upon DELIVERED scan, triggers delivery emails,
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
      status: v.string(),
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
      await ctx.runMutation(internal.orders.recordPaymentEvent, {
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: plan.event.type,
        actor: "courier_webhook",
        details: plan.event.details,
      });
    }

    // Send celebratory delivery email
    if (plan.delivered && hasEmail(order.customerEmail)) {
      await ctx.scheduler.runAfter(0, internal.emails.sendOrderDeliveredEmail, {
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
      status: (plan.patch.status as string | undefined) || order.status,
    };
  },
});
