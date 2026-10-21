"use node";

import { internalAction } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { api, components, internal } from "../_generated/api";
import { Resend } from "@convex-dev/resend";
import { renderEmail } from "./templates/layout/renderEmail";
import React from "react";
import { AdminOrderAlertEmail } from "./templates/AdminOrderAlert";
import { AdminDisputeAlertEmail } from "./templates/AdminDisputeAlert";
import { AdminTerritoryAlertEmail } from "./templates/AdminTerritoryAlert";
import { CustomerReceiptEmail } from "./templates/CustomerReceipt";
import { OrderDispatchedEmail } from "./templates/OrderDispatchedEmail";
import { OrderDeliveredEmail } from "./templates/OrderDeliveredEmail";
import { ReviewInviteEmail } from "./templates/ReviewInviteEmail";
import { listUnsubscribeHeaders } from "./unsubscribe";
import { REVIEW_INVITE_UNSUBSCRIBE_PATH } from "../reviews/model";
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
  reviewInviteCopy,
  reviewInviteIdempotencyKey,
  SUPPORT_EMAIL,
} from "./orderEmails";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import { resolveAdminRecipient } from "./adminRecipient";

export const resend = new Resend(components.resend, {
  testMode: false,
});

const DEFAULT_SENDER =
  process.env.RESEND_FROM_EMAIL || "Good Luck Alerts <onboarding@resend.dev>";
/** The admin alerts inbox, read at send time so ADMIN_NOTIFICATION_EMAIL changes apply at once. */
function adminEmail(): string {
  const recipient = resolveAdminRecipient(process.env.ADMIN_NOTIFICATION_EMAIL, PRIMARY_ADMIN_EMAIL);
  if (!recipient.fromEnv) {
    console.warn("[Email] ADMIN_NOTIFICATION_EMAIL is not set to one valid address; sending admin alerts to the primary Administrator.");
  }
  return recipient.email;
}
// If a Customer replies anyway, the reply goes to the orders inbox, not the sending address.
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
      const recipient = adminEmail();
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com";
      const adminDashboardUrl = `${baseUrl}/admin/orders/${args.orderNumber}`;

      const email = await renderEmail(
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
        html: email.html,
        text: email.text,
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
      const email = await renderEmail(
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
          returnPolicyUrl: `${baseUrl}/returns`,
        })
      );

      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: args.customerEmail,
        replyTo: CUSTOMER_REPLY_TO,
        subject: copy.subject,
        html: email.html,
        text: email.text,
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
export const sendTestAdminOrderAlert = internalAction({
  args: {
    targetEmail: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), emailId: v.string(), recipient: v.string() }),
  handler: async (ctx, args) => {
    const recipient = args.targetEmail || adminEmail();
    const testOrderNum = `TEST-${Math.floor(1000 + Math.random() * 9000)}`;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com";
    const adminDashboardUrl = `${baseUrl}/admin/orders/${testOrderNum}`;

    const email = await renderEmail(
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
        html: email.html,
        text: email.text,
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
      const recipient = adminEmail();
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com";
      const adminDashboardUrl = `${baseUrl}/admin/orders/${args.orderNumber}`;
      const stripeDisputeUrl = `https://dashboard.stripe.com/disputes/${args.disputeId}`;

      const email = await renderEmail(
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
        html: email.html,
        text: email.text,
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
      const email = await renderEmail(
        React.createElement(AdminTerritoryAlertEmail, {
          ...args,
          adminDashboardUrl: `${baseUrl}/admin/orders/${args.orderNumber}`,
        })
      );

      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: adminEmail(),
        subject: `⚠️ [Refund Before Packing] Order #${args.orderNumber} ships outside the Fulfillment Territory`,
        html: email.html,
        text: email.text,
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
      const email = await renderEmail(
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
        })
      );

      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: args.customerEmail,
        replyTo: CUSTOMER_REPLY_TO,
        subject: copy.subject,
        html: email.html,
        text: email.text,
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

      const email = await renderEmail(
        React.createElement(OrderDeliveredEmail, {
          orderNumber: args.orderNumber,
          customerName: args.customerName || "Valued Customer",
          carrier: args.carrier,
          trackingNumber: args.trackingNumber,
          deliveredLocation: args.deliveredLocation || "Delivery Destination",
          deliveredDetails: args.deliveredDetails || "Courier scan confirmed successful drop-off",
          storeTrackingUrl,
          items: args.items,
        })
      );

      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: args.customerEmail,
        replyTo: CUSTOMER_REPLY_TO,
        subject: deliveredCopy(args.orderNumber).subject,
        html: email.html,
        text: email.text,
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

/** Review invite a week after delivery: links to the account Orders page; one-click opt-out. */
export const sendReviewInviteEmail = internalAction({
  args: {
    orderNumber: v.string(),
    customerName: v.optional(v.string()),
    customerEmail: v.string(),
    unsubscribeToken: v.string(),
    itemNames: v.array(v.string()),
  },
  returns: emailResult,
  handler: async (ctx, args) => {
    try {
      if (!args.customerEmail.includes("@")) return { success: false, reason: "invalid_email" };

      const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://goodluckcaps.com").replace(/\/+$/, "");
      const convexSiteUrl = process.env.CONVEX_SITE_URL?.replace(/\/+$/, "");
      const oneClickUrl = convexSiteUrl
        ? `${convexSiteUrl}${REVIEW_INVITE_UNSUBSCRIBE_PATH}?token=${encodeURIComponent(args.unsubscribeToken)}`
        : undefined;

      const email = await renderEmail(
        React.createElement(ReviewInviteEmail, {
          orderNumber: args.orderNumber,
          customerName: args.customerName || "Valued Customer",
          itemNames: args.itemNames,
          reviewUrl: `${baseUrl}/account/orders?review=${encodeURIComponent(args.orderNumber)}`,
          unsubscribeUrl: oneClickUrl,
        })
      );

      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: args.customerEmail,
        replyTo: CUSTOMER_REPLY_TO,
        subject: reviewInviteCopy(args.orderNumber).subject,
        html: email.html,
        text: email.text,
        headers: oneClickUrl ? listUnsubscribeHeaders(oneClickUrl) : undefined,
        idempotencyKey: reviewInviteIdempotencyKey(args.orderNumber),
      });
      return { success: true, emailId };
    } catch (err: any) {
      console.error(`[ReviewInviteEmail] Failed for ${args.orderNumber}:`, err?.message || err);
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
        const email = await renderEmail(
          React.createElement(DeliveryExceptionEmail, {
            audience: isAdmin ? "admin" : "customer",
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
          html: email.html,
          text: email.text,
          idempotencyKey: `${args.kind}-${audience}-${args.orderNumber}-${args.trackingNumber}`,
        });
        return { success: true, emailId };
      } catch (err: any) {
        console.error(`[DeliveryException] ${audience} email for ${args.orderNumber} failed:`, err?.message || err);
        return { success: false, error: err?.message || String(err) };
      }
    };

    const administrator = await send("administrator", adminEmail());
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
      const email = await renderEmail(
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
        html: email.html,
        text: email.text,
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
      const email = await renderEmail(
        React.createElement(AdminAlertEmail, {
          alert: args.alert,
          actionUrl: orderNumber ? `${baseUrl}/admin/orders/${orderNumber}` : "https://dashboard.stripe.com/disputes",
          actionLabel: orderNumber ? "Open order" : "Open Stripe disputes",
        })
      );
      const emailId = await resend.sendEmail(ctx, {
        from: DEFAULT_SENDER,
        to: adminEmail(),
        subject: args.alert.subject,
        html: email.html,
        text: email.text,
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
