"use node";

import { internalAction, action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, components, internal } from "./_generated/api";
import { Resend } from "@convex-dev/resend";
import { render } from "@react-email/render";
import React from "react";
import { AdminOrderAlertEmail } from "./emails/AdminOrderAlert";
import { AdminDisputeAlertEmail } from "./emails/AdminDisputeAlert";
import { CustomerReceiptEmail } from "./emails/CustomerReceipt";
import { OrderDispatchedEmail } from "./emails/OrderDispatchedEmail";
import { OrderDeliveredEmail } from "./emails/OrderDeliveredEmail";
import { PRIMARY_ADMIN_EMAIL, PRIMARY_ADMIN_CLERK_ID } from "./auth";

export const resend = new Resend(components.resend, {
  testMode: false,
});

const DEFAULT_SENDER =
  process.env.RESEND_FROM_EMAIL || "Good Luck Alerts <onboarding@resend.dev>";
const DEFAULT_ADMIN_EMAIL =
  process.env.ADMIN_NOTIFICATION_EMAIL || PRIMARY_ADMIN_EMAIL;

const shippingAddressValidator = v.optional(
  v.object({
    line1: v.string(),
    line2: v.optional(v.string()),
    city: v.string(),
    state: v.string(),
    postalCode: v.string(),
    country: v.string(),
  })
);

const orderItemValidator = v.object({
  variantId: v.optional(v.string()),
  name: v.string(),
  quantity: v.number(),
  price: v.number(),
  image: v.optional(v.string()),
});

/**
 * Sends a high-priority order alert to the store administrator(s).
 */
export const sendAdminOrderAlert = internalAction({
  args: {
    orderNumber: v.string(),
    total: v.number(),
    currency: v.string(),
    paymentMethod: v.string(),
    isWhatsAppPending: v.optional(v.boolean()),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    shippingAddress: shippingAddressValidator,
    items: v.array(orderItemValidator),
    subtotal: v.optional(v.number()),
    shippingFee: v.optional(v.number()),
    tax: v.optional(v.number()),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      const recipient = DEFAULT_ADMIN_EMAIL;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com";
      const adminDashboardUrl = `${baseUrl}/admin/orders/${args.orderNumber}`;

      const html = await render(
        React.createElement(AdminOrderAlertEmail, {
          orderNumber: args.orderNumber,
          total: args.total,
          currency: args.currency,
          paymentMethod: args.paymentMethod,
          isWhatsAppPending: args.isWhatsAppPending,
          customerName: args.customerName,
          customerEmail: args.customerEmail,
          customerPhone: args.customerPhone,
          shippingAddress: args.shippingAddress,
          items: args.items,
          subtotal: args.subtotal,
          shippingFee: args.shippingFee,
          tax: args.tax,
          adminDashboardUrl,
          createdAt: args.createdAt || Date.now(),
        })
      );

      const subject = args.isWhatsAppPending
        ? `⚠️ [Action Required] New WhatsApp Order #${args.orderNumber} (${args.currency} $${args.total.toFixed(2)})`
        : `⚡ [New Order] #${args.orderNumber} Received (${args.currency} $${args.total.toFixed(2)})`;

      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: recipient,
        subject,
        html,
        idempotencyKey: `admin-alert-${args.orderNumber}-${args.paymentMethod}`,
      });

      console.log(`[AdminOrderAlert] Dispatched alert for order ${args.orderNumber}, emailId: ${emailId}`);
      return { success: true, emailId };
    } catch (err: any) {
      console.error(`[AdminOrderAlert] Failed to send admin alert for order ${args.orderNumber}:`, err?.message || err);
      return { success: false, error: err?.message || String(err) };
    }
  },
});

/**
 * Sends an order confirmation receipt to the customer.
 */
export const sendCustomerReceipt = internalAction({
  args: {
    orderNumber: v.string(),
    total: v.number(),
    currency: v.string(),
    customerName: v.optional(v.string()),
    customerEmail: v.string(),
    shippingAddress: shippingAddressValidator,
    items: v.array(orderItemValidator),
    subtotal: v.optional(v.number()),
    shippingFee: v.optional(v.number()),
    tax: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    try {
      if (!args.customerEmail || !args.customerEmail.includes("@")) {
        console.warn(`[CustomerReceipt] Skipped receipt: invalid email for order ${args.orderNumber}`);
        return { success: false, reason: "invalid_email" };
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com";
      const trackingUrl = `${baseUrl}/track?order=${encodeURIComponent(args.orderNumber)}`;

      const html = await render(
        React.createElement(CustomerReceiptEmail, {
          orderNumber: args.orderNumber,
          total: args.total,
          currency: args.currency,
          customerName: args.customerName,
          shippingAddress: args.shippingAddress,
          items: args.items,
          subtotal: args.subtotal,
          shippingFee: args.shippingFee,
          tax: args.tax,
          trackingUrl,
          supportEmail: "orders@goodluckcaps.com",
        })
      );

      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: args.customerEmail,
        subject: `Your Good Luck Order Confirmation #${args.orderNumber}`,
        html,
        idempotencyKey: `customer-receipt-${args.orderNumber}`,
      });

      console.log(`[CustomerReceipt] Sent customer receipt for ${args.orderNumber} to ${args.customerEmail}, emailId: ${emailId}`);
      return { success: true, emailId };
    } catch (err: any) {
      console.error(`[CustomerReceipt] Failed to send customer receipt for ${args.orderNumber}:`, err?.message || err);
      return { success: false, error: err?.message || String(err) };
    }
  },
});

/**
 * Public action allowing authenticated staff to test email delivery.
 */
export const sendTestAdminOrderAlert = action({
  args: {
    targetEmail: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized: Staff authentication required.");
    }
    const email = identity.email?.toLowerCase() || "";
    const isPrimary = email === PRIMARY_ADMIN_EMAIL || identity.subject === PRIMARY_ADMIN_CLERK_ID;
    // SECURITY: never trust a token "role" claim (it can originate from client-writable
    // publicMetadata). Non-allowlisted callers must be verified against the users table.
    let hasAdminRole = false;
    if (!isPrimary) {
      const staffUser = await ctx.runQuery(api.users.getUserByClerkId, {
        clerkId: identity.subject,
      });
      hasAdminRole = staffUser?.role === "admin";
    }
    if (!isPrimary && !hasAdminRole) {
      throw new ConvexError("Forbidden: Administrator privileges required.");
    }

    const recipient = args.targetEmail || DEFAULT_ADMIN_EMAIL;
    const testOrderNum = `TEST-${Math.floor(1000 + Math.random() * 9000)}`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com";
    const adminDashboardUrl = `${baseUrl}/admin/orders/${testOrderNum}`;

    const html = await render(
      React.createElement(AdminOrderAlertEmail, {
        orderNumber: testOrderNum,
        total: 95.0,
        currency: "USD",
        paymentMethod: "stripe",
        isWhatsAppPending: false,
        customerName: "Operations Test Staff",
        customerEmail: recipient,
        customerPhone: "+1 (555) 019-2834",
        shippingAddress: {
          line1: "100 Moya Way Suite 4B",
          city: "Austin",
          state: "TX",
          postalCode: "78701",
          country: "US",
        },
        items: [
          {
            name: "Moya Premium Structured Snapback (Midnight Black)",
            quantity: 1,
            price: 65.0,
          },
          {
            name: "Moya Classic Trucker Hat (Navy/White)",
            quantity: 1,
            price: 30.0,
          },
        ],
        subtotal: 95.0,
        shippingFee: 0.0,
        tax: 7.84,
        adminDashboardUrl,
        createdAt: Date.now(),
      })
    );

    try {
      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: recipient,
        subject: `⚡ [Test Alert] New Order #${testOrderNum} Received (USD $102.84)`,
        html,
        idempotencyKey: `test-alert-${testOrderNum}`,
      });

      return { success: true, emailId, recipient };
    } catch (err: any) {
      throw new ConvexError(`Failed to send test email via Resend: ${err?.message || String(err)}`);
    }
  },
});

/**
 * Sends an urgent dispute or chargeback alert to the store administrator.
 */
export const sendAdminDisputeAlert = internalAction({
  args: {
    orderNumber: v.string(),
    disputeId: v.string(),
    amount: v.number(),
    currency: v.string(),
    reason: v.optional(v.string()),
    status: v.string(),
    evidenceDueBy: v.optional(v.number()),
    isClosed: v.optional(v.boolean()),
    outcome: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    try {
      const recipient = DEFAULT_ADMIN_EMAIL;
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com";
      const adminDashboardUrl = `${baseUrl}/admin/orders/${args.orderNumber}`;
      const stripeDisputeUrl = `https://dashboard.stripe.com/disputes/${args.disputeId}`;

      const html = await render(
        React.createElement(AdminDisputeAlertEmail, {
          orderNumber: args.orderNumber,
          total: args.amount,
          currency: args.currency,
          disputeId: args.disputeId,
          reason: args.reason,
          status: args.status,
          evidenceDueBy: args.evidenceDueBy,
          isClosed: args.isClosed,
          outcome: args.outcome,
          adminDashboardUrl,
          stripeDisputeUrl,
          createdAt: Date.now(),
        })
      );

      const subject = args.isClosed
        ? `ℹ️ [Dispute Closed] Order #${args.orderNumber} — ${args.outcome || args.status.toUpperCase()}`
        : `🚨 [URGENT DISPUTE] Order #${args.orderNumber} (${args.currency} $${args.amount.toFixed(2)}) Needs Evidence`;

      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: recipient,
        subject,
        html,
        idempotencyKey: `dispute-${args.disputeId}-${args.status}`,
      });

      console.log(
        `[AdminDisputeAlert] Dispatched dispute alert for order ${args.orderNumber} (${args.disputeId}), emailId: ${emailId}`
      );
      return { success: true, emailId };
    } catch (err: any) {
      console.error(
        `[AdminDisputeAlert] Failed to send dispute alert for order ${args.orderNumber}:`,
        err?.message || err
      );
      return { success: false, error: err?.message || String(err) };
    }
  },
});

/**
 * Sends dispatch & tracking notification email to the customer upon label generation.
 */
export const sendOrderDispatchedEmail = internalAction({
  args: {
    orderNumber: v.string(),
    customerName: v.optional(v.string()),
    customerEmail: v.string(),
    carrier: v.string(),
    trackingNumber: v.string(),
    carrierTrackingUrl: v.optional(v.string()),
    estimatedDelivery: v.optional(v.string()),
    shippingAddress: shippingAddressValidator,
    items: v.optional(v.array(orderItemValidator)),
  },
  handler: async (ctx, args) => {
    try {
      if (!args.customerEmail || !args.customerEmail.includes("@")) {
        console.warn(`[OrderDispatchedEmail] Skipped: invalid email for order ${args.orderNumber}`);
        return { success: false, reason: "invalid_email" };
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com";
      const storeTrackingUrl = `${baseUrl}/track?order=${encodeURIComponent(args.orderNumber)}`;

      const html = await render(
        React.createElement(OrderDispatchedEmail, {
          orderNumber: args.orderNumber,
          customerName: args.customerName || "Valued Customer",
          carrier: args.carrier,
          trackingNumber: args.trackingNumber,
          carrierTrackingUrl: args.carrierTrackingUrl,
          storeTrackingUrl,
          estimatedDelivery: args.estimatedDelivery || "2-4 Business Days",
          shippingAddress: args.shippingAddress,
          items: args.items,
          supportEmail: "orders@goodluckcaps.com",
        })
      );

      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: args.customerEmail,
        subject: `Your Good Luck Cap has Dispatched! #${args.orderNumber} (${args.carrier} ${args.trackingNumber})`,
        html,
        idempotencyKey: `customer-dispatched-${args.orderNumber}-${args.trackingNumber}`,
      });

      console.log(`[OrderDispatchedEmail] Sent dispatch email for ${args.orderNumber} to ${args.customerEmail}, emailId: ${emailId}`);
      return { success: true, emailId };
    } catch (err: any) {
      console.error(`[OrderDispatchedEmail] Failed to send dispatch email for ${args.orderNumber}:`, err?.message || err);
      return { success: false, error: err?.message || String(err) };
    }
  },
});

/**
 * Sends celebratory delivery confirmation email with headwear care instructions to customer.
 */
export const sendOrderDeliveredEmail = internalAction({
  args: {
    orderNumber: v.string(),
    customerName: v.optional(v.string()),
    customerEmail: v.string(),
    carrier: v.string(),
    trackingNumber: v.string(),
    deliveredLocation: v.optional(v.string()),
    deliveredDetails: v.optional(v.string()),
    items: v.optional(v.array(orderItemValidator)),
  },
  handler: async (ctx, args) => {
    try {
      if (!args.customerEmail || !args.customerEmail.includes("@")) {
        console.warn(`[OrderDeliveredEmail] Skipped: invalid email for order ${args.orderNumber}`);
        return { success: false, reason: "invalid_email" };
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com";
      const storeTrackingUrl = `${baseUrl}/track?order=${encodeURIComponent(args.orderNumber)}`;

      const html = await render(
        React.createElement(OrderDeliveredEmail, {
          orderNumber: args.orderNumber,
          customerName: args.customerName || "Valued Collector",
          carrier: args.carrier,
          trackingNumber: args.trackingNumber,
          deliveredLocation: args.deliveredLocation || "Delivery Destination",
          deliveredDetails: args.deliveredDetails || "Courier scan confirmed successful drop-off",
          storeTrackingUrl,
          items: args.items,
          supportEmail: "orders@goodluckcaps.com",
        })
      );

      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: args.customerEmail,
        subject: `Your Good Luck Piece Has Arrived! #${args.orderNumber} Delivered`,
        html,
        idempotencyKey: `customer-delivered-${args.orderNumber}-${args.trackingNumber}`,
      });

      console.log(`[OrderDeliveredEmail] Sent delivery confirmation email for ${args.orderNumber} to ${args.customerEmail}, emailId: ${emailId}`);
      return { success: true, emailId };
    } catch (err: any) {
      console.error(`[OrderDeliveredEmail] Failed to send delivery email for ${args.orderNumber}:`, err?.message || err);
      return { success: false, error: err?.message || String(err) };
    }
  },
});



