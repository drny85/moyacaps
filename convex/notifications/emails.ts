"use node";

import { internalAction, action } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { api, components, internal } from "../_generated/api";
import { Resend } from "@convex-dev/resend";
import { render } from "@react-email/render";
import React from "react";
import { AdminOrderAlertEmail } from "./templates/AdminOrderAlert";
import { AdminDisputeAlertEmail } from "./templates/AdminDisputeAlert";
import { AdminTerritoryAlertEmail } from "./templates/AdminTerritoryAlert";
import { CustomerReceiptEmail } from "./templates/CustomerReceipt";
import { OrderDispatchedEmail } from "./templates/OrderDispatchedEmail";
import { OrderDeliveredEmail } from "./templates/OrderDeliveredEmail";
import { DeliveryExceptionEmail } from "./templates/DeliveryExceptionEmail";
import { CustomerNoticeEmail } from "./templates/CustomerNoticeEmail";
import { AdminAlertEmail } from "./templates/AdminAlertEmail";
import { deliveryExceptionCopy, type EmailAudience } from "./deliveryException";
import {
  adminAlertValidator,
  customerNoticeValidator,
  deliveredCopy,
  deliveredIdempotencyKey,
  dispatchedCopy,
  dispatchedIdempotencyKey,
  receiptCopy,
  SUPPORT_EMAIL,
} from "./orderEmails";
import { PRIMARY_ADMIN_EMAIL, requireAdminInAction } from "../lib/auth";

export const resend = new Resend(components.resend, {
  testMode: false,
});

const DEFAULT_SENDER =
  process.env.RESEND_FROM_EMAIL || "Good Luck Alerts <onboarding@resend.dev>";
const DEFAULT_ADMIN_EMAIL =
  process.env.ADMIN_NOTIFICATION_EMAIL || PRIMARY_ADMIN_EMAIL;
// Customer emails say "reply to this email": replies go to the orders inbox, not the sender.
const CUSTOMER_REPLY_TO = [SUPPORT_EMAIL];

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
  // Tee lines carry a colorway and size (ADR 0015); a scheduled email must accept the stored line.
  colorway: v.optional(v.string()),
  size: v.optional(v.string()),
});

/** Result of a scheduled transactional email; failures are reported, not thrown. */
const emailResult = v.object({
  success: v.boolean(),
  emailId: v.optional(v.string()),
  error: v.optional(v.string()),
  reason: v.optional(v.string()),
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
  returns: emailResult,
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

      const subject = `⚡ [New Order] #${args.orderNumber} Received (${args.currency} $${args.total.toFixed(2)})`;

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
    // Settlement flagged the address outside the Fulfillment Territory: say it will be refunded.
    outOfTerritory: v.optional(v.boolean()),
  },
  returns: emailResult,
  handler: async (ctx, args) => {
    try {
      if (!args.customerEmail || !args.customerEmail.includes("@")) {
        console.warn(`[CustomerReceipt] Skipped receipt: invalid email for order ${args.orderNumber}`);
        return { success: false, reason: "invalid_email" };
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com";
      const trackingUrl = `${baseUrl}/track?order=${encodeURIComponent(args.orderNumber)}`;

      const copy = receiptCopy(args.orderNumber, args.outOfTerritory ?? false);
      const html = await render(
        React.createElement(CustomerReceiptEmail, {
          copy,
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
          supportEmail: SUPPORT_EMAIL,
        })
      );

      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: args.customerEmail,
        replyTo: CUSTOMER_REPLY_TO,
        subject: copy.subject,
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
  returns: v.object({ success: v.boolean(), emailId: v.string(), recipient: v.string() }),
  handler: async (ctx, args) => {
    const identity = await requireAdminInAction(ctx);

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
  returns: emailResult,
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
 * Alerts the store administrator that a paid Order ships outside the Fulfillment Territory,
 * so it is refunded before packing (plan 0008 PR 4). Never refunds by itself.
 */
export const sendAdminTerritoryAlert = internalAction({
  args: {
    orderNumber: v.string(),
    total: v.number(),
    currency: v.string(),
    reason: v.string(),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    shippingAddress: shippingAddressValidator,
  },
  returns: emailResult,
  handler: async (ctx, args) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com";
      const html = await render(
        React.createElement(AdminTerritoryAlertEmail, {
          ...args,
          adminDashboardUrl: `${baseUrl}/admin/orders/${args.orderNumber}`,
        })
      );

      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: DEFAULT_ADMIN_EMAIL,
        subject: `⚠️ [Refund Before Packing] Order #${args.orderNumber} ships outside the Fulfillment Territory`,
        html,
        idempotencyKey: `territory-${args.orderNumber}`,
      });

      console.log(`[AdminTerritoryAlert] Dispatched territory alert for order ${args.orderNumber}, emailId: ${emailId}`);
      return { success: true, emailId };
    } catch (err: any) {
      console.error(
        `[AdminTerritoryAlert] Failed to send territory alert for order ${args.orderNumber}:`,
        err?.message || err
      );
      return { success: false, error: err?.message || String(err) };
    }
  },
});

/**
 * Sends the dispatch email: "packed and ready to ship" when a label is bought, "has shipped"
 * when an Administrator moves the order in transit by hand (orderEmails.ts dispatchedCopy).
 */
export const sendOrderDispatchedEmail = internalAction({
  args: {
    orderNumber: v.string(),
    customerName: v.optional(v.string()),
    customerEmail: v.string(),
    // Omitted means label_purchased (emails scheduled before this field existed).
    stage: v.optional(v.union(v.literal("label_purchased"), v.literal("in_transit"))),
    carrier: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    carrierTrackingUrl: v.optional(v.string()),
    estimatedDelivery: v.optional(v.string()),
    shippingAddress: shippingAddressValidator,
    items: v.optional(v.array(orderItemValidator)),
  },
  returns: emailResult,
  handler: async (ctx, args) => {
    try {
      if (!args.customerEmail || !args.customerEmail.includes("@")) {
        console.warn(`[OrderDispatchedEmail] Skipped: invalid email for order ${args.orderNumber}`);
        return { success: false, reason: "invalid_email" };
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com";
      const storeTrackingUrl = `${baseUrl}/track?order=${encodeURIComponent(args.orderNumber)}`;

      const stage = args.stage ?? "label_purchased";
      const copy = dispatchedCopy(stage, args.orderNumber, args.carrier);
      const html = await render(
        React.createElement(OrderDispatchedEmail, {
          orderNumber: args.orderNumber,
          customerName: args.customerName || "Valued Customer",
          copy,
          carrier: args.carrier || "Carrier",
          trackingNumber: args.trackingNumber,
          carrierTrackingUrl: args.carrierTrackingUrl,
          storeTrackingUrl,
          estimatedDelivery: args.estimatedDelivery || "2–5 Business Days",
          shippingAddress: args.shippingAddress,
          items: args.items,
          supportEmail: SUPPORT_EMAIL,
        })
      );

      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: args.customerEmail,
        replyTo: CUSTOMER_REPLY_TO,
        subject: copy.subject,
        html,
        idempotencyKey: dispatchedIdempotencyKey(stage, args.orderNumber, args.trackingNumber),
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
 * Sends the delivery confirmation with a care guide for what was in the package, from a carrier
 * DELIVERED scan or an Administrator marking the order delivered by hand.
 */
export const sendOrderDeliveredEmail = internalAction({
  args: {
    orderNumber: v.string(),
    customerName: v.optional(v.string()),
    customerEmail: v.string(),
    carrier: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    deliveredLocation: v.optional(v.string()),
    deliveredDetails: v.optional(v.string()),
    items: v.optional(v.array(orderItemValidator)),
  },
  returns: emailResult,
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
          customerName: args.customerName || "Valued Customer",
          carrier: args.carrier,
          trackingNumber: args.trackingNumber,
          deliveredLocation: args.deliveredLocation || "Delivery Destination",
          deliveredDetails: args.deliveredDetails || "Courier scan confirmed successful drop-off",
          storeTrackingUrl,
          items: args.items,
          supportEmail: SUPPORT_EMAIL,
        })
      );

      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: args.customerEmail,
        replyTo: CUSTOMER_REPLY_TO,
        subject: deliveredCopy(args.orderNumber).subject,
        html,
        idempotencyKey: deliveredIdempotencyKey(args.orderNumber, args.trackingNumber),
      });

      console.log(`[OrderDeliveredEmail] Sent delivery confirmation email for ${args.orderNumber} to ${args.customerEmail}, emailId: ${emailId}`);
      return { success: true, emailId };
    } catch (err: any) {
      console.error(`[OrderDeliveredEmail] Failed to send delivery email for ${args.orderNumber}:`, err?.message || err);
      return { success: false, error: err?.message || String(err) };
    }
  },
});

/**
 * Delivery Exception or returned to sender (CONTEXT.md): emails the Administrator (Reship or
 * refund) and, when the order has an email, the Customer. Each send is independent and idempotent.
 */
export const sendDeliveryExceptionEmails = internalAction({
  args: {
    orderNumber: v.string(),
    kind: v.union(v.literal("delivery_exception"), v.literal("returned")),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    carrier: v.string(),
    trackingNumber: v.string(),
    details: v.optional(v.string()),
    location: v.optional(v.string()),
  },
  returns: v.object({ administrator: emailResult, customer: v.optional(emailResult) }),
  handler: async (ctx, args) => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com";
    const send = async (audience: EmailAudience, to: string) => {
      try {
        const copy = deliveryExceptionCopy(args.kind, audience, args.orderNumber);
        const isAdmin = audience === "administrator";
        const html = await render(
          React.createElement(DeliveryExceptionEmail, {
            orderNumber: args.orderNumber,
            greetingName: isAdmin ? undefined : args.customerName?.split(" ")[0],
            copy,
            carrier: args.carrier,
            trackingNumber: args.trackingNumber,
            details: args.details,
            location: args.location,
            actionUrl: isAdmin
              ? `${baseUrl}/admin/orders/${args.orderNumber}`
              : `${baseUrl}/track?order=${encodeURIComponent(args.orderNumber)}`,
            actionLabel: isAdmin ? "Open order" : "Track your order",
          })
        );
        const emailId = await resend.sendEmail(ctx, {
          from: DEFAULT_SENDER,
          to,
          ...(!isAdmin && { replyTo: CUSTOMER_REPLY_TO }),
          subject: copy.subject,
          html,
          idempotencyKey: `${args.kind}-${audience}-${args.orderNumber}-${args.trackingNumber}`,
        });
        return { success: true, emailId };
      } catch (err: any) {
        console.error(`[DeliveryException] ${audience} email for ${args.orderNumber} failed:`, err?.message || err);
        return { success: false, error: err?.message || String(err) };
      }
    };

    const administrator = await send("administrator", DEFAULT_ADMIN_EMAIL);
    const customer =
      args.customerEmail && args.customerEmail.includes("@") ? await send("customer", args.customerEmail) : undefined;
    return { administrator, ...(customer && { customer }) };
  },
});

/**
 * A Customer notice built by orderEmails.ts (order cancelled, refund issued). The scheduling
 * mutation chose the copy and the idempotency key; this only renders and sends.
 */
export const sendCustomerNotice = internalAction({
  args: {
    orderNumber: v.string(),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    notice: customerNoticeValidator,
  },
  returns: emailResult,
  handler: async (ctx, args) => {
    try {
      if (!args.customerEmail.includes("@")) {
        console.warn(`[CustomerNotice] Skipped: invalid email for order ${args.orderNumber}`);
        return { success: false, reason: "invalid_email" };
      }
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com";
      const html = await render(
        React.createElement(CustomerNoticeEmail, {
          notice: args.notice,
          greetingName: args.customerName?.split(" ")[0],
          actionUrl: `${baseUrl}/track?order=${encodeURIComponent(args.orderNumber)}`,
        })
      );
      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: args.customerEmail,
        replyTo: CUSTOMER_REPLY_TO,
        subject: args.notice.subject,
        html,
        idempotencyKey: args.notice.idempotencyKey,
      });
      console.log(`[CustomerNotice] ${args.notice.idempotencyKey} queued, emailId: ${emailId}`);
      return { success: true, emailId };
    } catch (err: any) {
      console.error(`[CustomerNotice] ${args.notice.idempotencyKey} failed:`, err?.message || err);
      return { success: false, error: err?.message || String(err) };
    }
  },
});

/**
 * An Administrator alert built by orderEmails.ts (Customer Cancellation, failed or pending
 * refund, money taken on a refused settlement, unlinked dispute).
 */
export const sendAdminAlert = internalAction({
  args: { alert: adminAlertValidator },
  returns: emailResult,
  handler: async (ctx, args) => {
    try {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com";
      const { orderNumber } = args.alert;
      const html = await render(
        React.createElement(AdminAlertEmail, {
          alert: args.alert,
          actionUrl: orderNumber ? `${baseUrl}/admin/orders/${orderNumber}` : "https://dashboard.stripe.com/disputes",
          actionLabel: orderNumber ? "Open order" : "Open Stripe disputes",
        })
      );
      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: DEFAULT_ADMIN_EMAIL,
        subject: args.alert.subject,
        html,
        idempotencyKey: args.alert.idempotencyKey,
      });
      console.log(`[AdminAlert] ${args.alert.idempotencyKey} queued, emailId: ${emailId}`);
      return { success: true, emailId };
    } catch (err: any) {
      console.error(`[AdminAlert] ${args.alert.idempotencyKey} failed:`, err?.message || err);
      return { success: false, error: err?.message || String(err) };
    }
  },
});
