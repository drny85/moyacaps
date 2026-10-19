/**
 * WhatsApp concierge reservations (ADR 0010, ADR 0011): create a lead that holds stock
 * for 24h, attach and dispatch its payment link, settle it via Zelle, and release the
 * stock when the hold expires.
 */
import { mutation, internalMutation, internalQuery } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import { requireAdmin } from "../lib/auth";
import { randomDigitString } from "../lib/ids";
import { adjustStock, checkStock } from "../catalog/inventory";
import { getShippingSettings } from "../settings/model";
import { appendBoundedId, appendNote, computeShipping, isPaidLike, newTrackingNumber, orderSessionIds } from "./model";
import { hasEmail, releaseStock, scheduleSessionExpiry } from "./shared";
import { orderDoc, orderItemValidator, shippingAddressValidator, successResult } from "./validators";
import {
  countReservationsInWindow,
  isValidLineQuantity,
  MAX_ACTIVE_RESERVATIONS,
  MAX_RESERVATION_LINES,
  MAX_RESERVATIONS_PER_DAY,
  RESERVATION_HOLD_MS,
  RESERVATION_RATE_LOOKBACK,
  sanitizeReservationAddress,
  sanitizeReservationContact,
} from "../catalog/reservations";

/**
 * Records a customer WhatsApp checkout lead order, reserves inventory immediately,
 * and schedules a 24-hour auto-cancellation if payment is not confirmed.
 * INTERNAL: invoked only by the stripeCheckout reservation action, never by clients.
 */
export const createWhatsAppOrderLead = internalMutation({
  args: {
    items: v.array(orderItemValidator),
    currency: v.string(),
    subtotal: v.number(),
    shippingFee: v.number(),
    total: v.number(),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    shippingAddress: v.optional(shippingAddressValidator),
    clerkUserId: v.optional(v.string()),
    paymentUrl: v.optional(v.string()),
    stripeSessionId: v.optional(v.string()),
  },
  returns: v.object({
    orderId: v.id("orders"),
    orderNumber: v.string(),
    reservationExpiresAt: v.number(),
    paymentUrl: v.optional(v.string()),
    subtotal: v.number(),
    shippingFee: v.number(),
    total: v.number(),
    items: v.array(orderItemValidator),
  }),
  handler: async (ctx, args) => {
    const timestamp = Date.now();

    // 1. Validate bag constraints
    if (!args.items || args.items.length === 0) {
      throw new Error("Cannot create an order with an empty bag.");
    }
    if (args.items.length > MAX_RESERVATION_LINES) {
      throw new Error("Order exceeds maximum items limit.");
    }

    const contact = sanitizeReservationContact({
      name: args.customerName,
      phone: args.customerPhone,
      email: args.customerEmail,
    });
    const cleanPhone = contact.phone;
    const cleanName = contact.name;
    const cleanEmail = contact.email;

    // The lean concierge flow requires an identity anchor (email, or phone as fallback).
    if (!cleanEmail && !cleanPhone) {
      throw new ConvexError("MISSING_IDENTITY");
    }

    // 2. Prevent inventory hoarding: max 3 active unconfirmed leads per email OR phone anchor,
    //    and a 24h sliding window cap of 5 leads per anchor against rotating-identity spam.
    //    Reading MAX_ACTIVE_RESERVATIONS per anchor is enough to decide the cap.
    const activeLeadIds = new Set<string>();
    if (cleanEmail) {
      const leads = await ctx.db
        .query("orders")
        .withIndex("by_status_and_customerEmail", (q) =>
          q.eq("status", "whatsapp_initiated").eq("customerEmail", cleanEmail)
        )
        .take(MAX_ACTIVE_RESERVATIONS);
      for (const lead of leads) activeLeadIds.add(lead._id);
    }
    if (cleanPhone) {
      const leads = await ctx.db
        .query("orders")
        .withIndex("by_status_and_customerPhone", (q) =>
          q.eq("status", "whatsapp_initiated").eq("customerPhone", cleanPhone)
        )
        .take(MAX_ACTIVE_RESERVATIONS);
      for (const lead of leads) activeLeadIds.add(lead._id);
    }

    if (activeLeadIds.size >= MAX_ACTIVE_RESERVATIONS) {
      throw new ConvexError("MAX_ACTIVE_RESERVATIONS");
    }

    // True 24h sliding window over ALL reservations this email ever created (including
    // cancelled/expired ones): cancel-and-recreate cannot launder the active cap.
    if (cleanEmail) {
      const recent = await ctx.db
        .query("orders")
        .withIndex("by_customerEmail", (q) => q.eq("customerEmail", cleanEmail))
        .order("desc")
        .take(RESERVATION_RATE_LOOKBACK);
      if (countReservationsInWindow(recent, timestamp) >= MAX_RESERVATIONS_PER_DAY) {
        throw new ConvexError("RESERVATION_RATE_LIMITED");
      }
    }

    // 3. Validate real-time stock, compute canonical DB prices, and decrement immediately
    let verifiedSubtotal = 0;
    let totalCaps = 0;
    const verifiedItems = [];

    for (const item of args.items) {
      if (!isValidLineQuantity(item.quantity)) {
        throw new Error(`Invalid quantity for ${item.name}. Must be an integer between 1 and 10.`);
      }

      const check = await checkStock(ctx, item);
      if (!check.ok) {
        if (check.reason === "option_required" || check.reason === "invalid_option") {
          throw new Error(`Choose a valid colorway and size for ${item.name}.`);
        }
        if (check.reason === "unavailable" && check.variant) {
          throw new Error(`"${check.variant.nameEn}" is currently sold out.`);
        }
        throw new Error(`Item ${item.name} is no longer available.`);
      }
      const { variant, available } = check;
      if (available <= 0) {
        throw new Error(`"${variant.nameEn}" is currently sold out.`);
      }
      if (available < item.quantity) {
        throw new Error(`Insufficient stock for ${variant.nameEn}. Only ${available} available.`);
      }

      await adjustStock(ctx, item, -item.quantity);

      const unitPrice = variant.priceUsd;
      verifiedSubtotal += unitPrice * item.quantity;
      totalCaps += item.quantity;

      verifiedItems.push({
        variantId: variant.variantId,
        name: item.colorway || item.size ? item.name : variant.nameEn,
        quantity: item.quantity,
        price: unitPrice,
        image: variant.image,
        ...(item.colorway ? { colorway: item.colorway } : {}),
        ...(item.size ? { size: item.size } : {}),
      });
    }

    // Free-shipping threshold and flat fee come from store_settings (Administrator-controlled).
    const verifiedShippingFee = computeShipping(totalCaps, await getShippingSettings(ctx)).shippingFee;
    const verifiedTotal = verifiedSubtotal + verifiedShippingFee;

    const cleanAddress = sanitizeReservationAddress(args.shippingAddress);

    const orderNumber = `GL-WA-${randomDigitString(8)}`;
    const reservationExpiresAt = timestamp + RESERVATION_HOLD_MS;

    const orderId = await ctx.db.insert("orders", {
      orderNumber,
      customerName: cleanName,
      customerPhone: cleanPhone,
      customerEmail: cleanEmail,
      clerkUserId: args.clerkUserId,
      shippingAddress: cleanAddress,
      items: verifiedItems,
      currency: "USD",
      subtotal: verifiedSubtotal,
      shippingFee: verifiedShippingFee,
      total: verifiedTotal,
      status: "whatsapp_initiated",
      paymentMethod: "whatsapp",
      paymentUrl: args.paymentUrl,
      stripeSessionId: args.stripeSessionId,
      stripeSessionIds: args.stripeSessionId ? [args.stripeSessionId] : undefined,
      reservationExpiresAt,
      createdAt: timestamp,
    });

    // Schedule 24h auto-cancellation of WhatsApp reservation if unpaid
    await ctx.scheduler.runAfter(RESERVATION_HOLD_MS, internal.orders.whatsapp.expireWhatsAppOrderLead, {
      orderId,
    });

    // Audit: reservation created with server-verified totals
    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId,
      orderNumber,
      type: "lead_created",
      actor: cleanEmail || cleanPhone,
      details: JSON.stringify({
        subtotal: verifiedSubtotal,
        shippingFee: verifiedShippingFee,
        total: verifiedTotal,
      }),
    });

    // Schedule Admin Order Alert for WhatsApp order
    await ctx.scheduler.runAfter(0, internal.notifications.emails.sendAdminOrderAlert, {
      orderNumber,
      total: verifiedTotal,
      currency: "USD",
      paymentMethod: "whatsapp",
      isWhatsAppPending: true,
      customerName: cleanName,
      customerEmail: cleanEmail,
      customerPhone: cleanPhone,
      shippingAddress: cleanAddress,
      items: verifiedItems,
      subtotal: verifiedSubtotal,
      shippingFee: verifiedShippingFee,
      createdAt: timestamp,
    });

    return {
      orderId,
      orderNumber,
      reservationExpiresAt,
      paymentUrl: args.paymentUrl,
      // Canonical server-verified amounts for customer-facing messaging
      subtotal: verifiedSubtotal,
      shippingFee: verifiedShippingFee,
      total: verifiedTotal,
      items: verifiedItems,
    };
  },
});

/**
 * INTERNAL only: records the freshly generated Stripe Checkout link on an order and keeps
 * a bounded history of every session id ever issued (refund/expiry must target the right one).
 */
export const updateOrderPaymentUrl = internalMutation({
  args: {
    orderId: v.id("orders"),
    paymentUrl: v.string(),
    stripeSessionId: v.optional(v.string()),
  },
  returns: successResult,
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }
    if (order.status !== "whatsapp_initiated") {
      throw new Error(`Cannot attach payment link to order in status ${order.status}`);
    }

    await ctx.db.patch(args.orderId, {
      paymentUrl: args.paymentUrl,
      ...(args.stripeSessionId && {
        stripeSessionId: args.stripeSessionId,
        stripeSessionIds: appendBoundedId(order.stripeSessionIds, args.stripeSessionId),
      }),
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const dispatchWhatsAppPaymentLinkAdmin = mutation({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.object({ success: v.boolean(), paymentLinkSentAt: v.number(), reservationExpiresAt: v.number() }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }
    if (order.status !== "whatsapp_initiated") {
      throw new ConvexError(`Cannot dispatch a payment link for an order in status ${order.status}.`);
    }

    const now = Date.now();
    const newExpiresAt = now + RESERVATION_HOLD_MS;

    await ctx.db.patch(args.orderId, {
      paymentLinkSentAt: now,
      reservationExpiresAt: newExpiresAt,
      updatedAt: now,
      adminNotes: appendNote(
        order.adminNotes,
        `Payment link dispatched via WhatsApp at ${new Date(now).toISOString()}. 24h stock hold extended.`
      ).trim(),
    });

    // Reschedule 24h expiration from link dispatch moment (older jobs self-veto via the
    // reservationExpiresAt guard in expireWhatsAppOrderLead).
    await ctx.scheduler.runAfter(RESERVATION_HOLD_MS, internal.orders.whatsapp.expireWhatsAppOrderLead, {
      orderId: args.orderId,
    });

    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId: args.orderId,
      orderNumber: order.orderNumber,
      type: "link_dispatched",
      stripeSessionId: order.stripeSessionId,
      actor: admin.subject,
      details: `Stock hold extended to ${new Date(newExpiresAt).toISOString()}`,
    });

    return {
      success: true,
      paymentLinkSentAt: now,
      reservationExpiresAt: newExpiresAt,
    };
  },
});

export const markWhatsAppOrderPaidAdmin = mutation({
  args: {
    orderId: v.id("orders"),
    notes: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.optional(v.string()),
    orderNumber: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (isPaidLike(order.status)) {
      return { success: true, message: "Order is already marked as paid." };
    }

    // A cancelled order had its stock restored; settling it would sell phantom inventory.
    if (order.status === "cancelled") {
      throw new ConvexError(
        "This reservation was cancelled and its stock was released. Create a new order instead."
      );
    }

    const trackingNumber = order.trackingNumber || newTrackingNumber();

    await ctx.db.patch(args.orderId, {
      status: "paid",
      trackingNumber,
      adminNotes: appendNote(order.adminNotes, `Confirmed paid via WhatsApp (Zelle / Transfer). ${args.notes || ""}`).trim(),
      updatedAt: Date.now(),
    });

    // Money safety: expire every still-open Stripe Checkout session for this order so the
    // customer cannot ALSO pay the card link (double settlement). Runs as a scheduled action
    // because mutations cannot call external APIs.
    if (orderSessionIds(order).length > 0) {
      await scheduleSessionExpiry(ctx, args.orderId);
    }

    await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
      orderId: args.orderId,
      orderNumber: order.orderNumber,
      type: "zelle_settled",
      stripeSessionId: order.stripeSessionId,
      actor: admin.subject,
      details: args.notes,
    });

    // Schedule Customer Order Confirmation receipt
    if (hasEmail(order.customerEmail)) {
      await ctx.scheduler.runAfter(0, internal.notifications.emails.sendCustomerReceipt, {
        orderNumber: order.orderNumber,
        total: order.total,
        currency: order.currency,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        shippingAddress: order.shippingAddress,
        items: order.items,
        subtotal: order.subtotal,
        shippingFee: order.shippingFee,
        tax: order.tax,
      });
    }

    return { success: true, orderNumber: order.orderNumber, trackingNumber };
  },
});

/**
 * Automatically releases reserved stock if a WhatsApp order lead is not confirmed within 24 hours.
 */
export const expireWhatsAppOrderLead = internalMutation({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) return null;

    // Race guard: a link dispatch/refresh reschedules a NEW expiry and pushes
    // reservationExpiresAt forward. A stale job scheduled earlier must self-veto so it
    // never cancels a reservation that is still inside its extended hold window.
    if (order.reservationExpiresAt && order.reservationExpiresAt > Date.now()) {
      return null;
    }

    // Only auto-cancel if it's still awaiting WhatsApp payment confirmation
    if (order.status === "whatsapp_initiated") {
      await releaseStock(ctx, order.items);

      await ctx.db.patch(order._id, {
        status: "cancelled",
        adminNotes: appendNote(order.adminNotes, "Auto-cancelled: 24-hour WhatsApp reservation hold expired without payment."),
        updatedAt: Date.now(),
      });

      await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
        orderId: order._id,
        orderNumber: order.orderNumber,
        type: "inventory_released",
        details: "Reservation hold expired without payment; stock restored.",
      });
    }
    return null;
  },
});

/**
 * INTERNAL: orders awaiting payment whose reservation hold window has fully elapsed.
 * Used by the nightly reconciliation cron.
 */
export const getExpiredWhatsAppReservationsInternal = internalQuery({
  args: {
    now: v.number(),
    limit: v.number(),
  },
  returns: v.array(orderDoc),
  handler: async (ctx, args) => {
    // Walk elapsed holds oldest first and keep the first `limit` still awaiting payment.
    const expired: Doc<"orders">[] = [];
    if (args.limit <= 0) return expired;
    const elapsed = ctx.db
      .query("orders")
      .withIndex("by_reservationExpiresAt", (q) => q.lte("reservationExpiresAt", args.now))
      .order("asc");
    for await (const order of elapsed) {
      if (order.status !== "whatsapp_initiated") continue;
      expired.push(order);
      if (expired.length >= args.limit) break;
    }
    return expired;
  },
});
