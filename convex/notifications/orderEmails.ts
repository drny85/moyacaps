/**
 * Order email copy and send decisions (order-email audit, 2026-10-20): what each Customer email
 * and Administrator alert says, its Resend idempotency key, and when a manual desk move sends
 * one. The mutations build a message here and schedule it; notifications/emails.ts only renders
 * and sends. Pure: no database access; covered by orderEmails.test.ts.
 */
import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { FulfillmentStatus } from "../orders/status";
import type { RefundKind } from "../payments/refundModel";

export const BRAND = "Good Luck";
export const SUPPORT_EMAIL = "orders@goodluckcaps.com";
export const POLICY_LINE = "Standard shipping 2–5 business days.";

const money = (amount: number, currency = "USD") => `${currency.toUpperCase()} $${amount.toFixed(2)}`;
const cents = (amountCents: number) => `$${(amountCents / 100).toFixed(2)}`;

// ── Dispatched and delivered ─────────────────────────────────────────────────

/** When the dispatch email goes out: a label was bought, or the package is with the carrier. */
export type DispatchStage = "label_purchased" | "in_transit";

export type ShipmentCopy = { subject: string; preview: string; badge: string; heading: string; body: string };

export function dispatchedCopy(stage: DispatchStage, orderNumber: string, carrier?: string): ShipmentCopy {
  if (stage === "label_purchased") {
    const label = carrier ? `a ${carrier} shipping label` : "a shipping label";
    return {
      subject: `Your ${BRAND} order #${orderNumber} is packed and ready to ship`,
      preview: `Order #${orderNumber} is packed and has ${label}.`,
      badge: "READY TO SHIP",
      heading: "Your order is packed",
      body: `Your order is packed and has ${label}. Tracking updates start once ${carrier ?? "the carrier"} scans the package.`,
    };
  }
  return {
    subject: `Your ${BRAND} order #${orderNumber} has shipped`,
    preview: `Order #${orderNumber} is on its way${carrier ? ` with ${carrier}` : ""}.`,
    badge: "ON ITS WAY",
    heading: "Your order has shipped",
    body: `Your order is on its way${carrier ? ` with ${carrier}` : ""}.`,
  };
}

export function deliveredCopy(orderNumber: string): ShipmentCopy {
  return {
    subject: `Your ${BRAND} order #${orderNumber} has been delivered`,
    preview: `Order #${orderNumber} has been delivered.`,
    badge: "DELIVERED",
    heading: "Your order has arrived",
    body: `The carrier confirmed that order #${orderNumber} was delivered.`,
  };
}

/** Resend key for a dispatch email. The label email keeps its original key. */
export function dispatchedIdempotencyKey(stage: DispatchStage, orderNumber: string, trackingNumber?: string): string {
  const prefix = stage === "label_purchased" ? "customer-dispatched" : "customer-shipped";
  return `${prefix}-${orderNumber}-${trackingNumber ?? "manual"}`;
}

/** Resend key for a delivered email; a carrier scan and a desk move for one package share it. */
export function deliveredIdempotencyKey(orderNumber: string, trackingNumber?: string): string {
  return `customer-delivered-${orderNumber}-${trackingNumber ?? "manual"}`;
}

type CareItem = { size?: string };
export type CareTip = { title: string; body: string };

const CAP_CARE: CareTip[] = [
  { title: "Caps: keep the shape", body: "Store caps upright or on a hook so the crown keeps its shape." },
  { title: "Caps: spot clean only", body: "Wipe with a damp cloth or a soft brush and let air-dry. Never machine wash a cap." },
];
const TEE_CARE: CareTip[] = [
  { title: "Tees: wash cold, inside out", body: "Machine wash cold, inside out, with similar colors to protect the print." },
  { title: "Tees: low heat", body: "Tumble dry low or hang dry. Do not iron directly on the print." },
];

/** Care tips for what is in the package. Tees carry a size; caps do not. */
export function careGuide(items: CareItem[] | undefined): CareTip[] {
  const list = items ?? [];
  const hasTee = list.some((item) => item.size !== undefined);
  const hasCap = list.length === 0 || list.some((item) => item.size === undefined);
  return [...(hasCap ? CAP_CARE : []), ...(hasTee ? TEE_CARE : [])];
}

/**
 * The shipment email a manual desk move sends. A move into delivered sends the delivered email;
 * a move into in transit sends the shipped email, unless the package already went out (a
 * Reship gets its own label email).
 */
export function manualMoveEmail(previous: FulfillmentStatus, next: FulfillmentStatus): "dispatched" | "delivered" | null {
  if (next === "delivered" && previous !== "delivered") return "delivered";
  if (next === "in_transit" && (previous === "unfulfilled" || previous === "label_purchased")) return "dispatched";
  return null;
}

// ── Receipt ──────────────────────────────────────────────────────────────────

export type ReceiptCopy = { subject: string; heading: string; body: string };

/** The receipt; an Order outside the Fulfillment Territory is told it will be refunded, not packed. */
export function receiptCopy(orderNumber: string, outOfTerritory: boolean): ReceiptCopy {
  if (outOfTerritory) {
    return {
      subject: `We received your ${BRAND} order #${orderNumber}, but can't ship it`,
      heading: "We can't ship to this address",
      body: `Thanks for order #${orderNumber}. We only ship to the 50 US states and DC, so we won't pack this order. We'll refund it in full and email you when the refund is sent. If the address is wrong, write to us at ${SUPPORT_EMAIL}.`,
    };
  }
  return {
    subject: `Your ${BRAND} Order Confirmation #${orderNumber}`,
    heading: "Thank You for Your Order!",
    body: `We're preparing your order #${orderNumber}. We'll email you tracking information as soon as your package ships.`,
  };
}

// ── Customer notices: cancellation and refund ────────────────────────────────

export const customerNoticeValidator = v.object({
  subject: v.string(),
  preview: v.string(),
  badge: v.string(),
  heading: v.string(),
  paragraphs: v.array(v.string()),
  idempotencyKey: v.string(),
});
export type CustomerNotice = Infer<typeof customerNoticeValidator>;

/**
 * Order cancelled. `refundCents` is the full refund reserved with the cancellation; null when
 * none was (an Administrator cancelled without refunding, or nothing was left to refund).
 */
export function cancellationNotice(args: {
  orderNumber: string;
  by: "customer" | "administrator";
  refundCents: number | null;
}): CustomerNotice {
  const opening =
    args.by === "customer"
      ? `You cancelled order #${args.orderNumber}. Nothing from it will ship.`
      : `We cancelled order #${args.orderNumber}. Nothing from it will ship.`;
  const refund =
    args.refundCents && args.refundCents > 0
      ? `We've started a full refund of ${cents(args.refundCents)} to your original payment method. Banks usually post it within 5–10 business days.`
      : "If you were charged, our team will follow up about your refund.";
  return {
    subject: `Your ${BRAND} order #${args.orderNumber} is cancelled`,
    preview: `Order #${args.orderNumber} is cancelled.`,
    badge: "ORDER CANCELLED",
    heading: "Your order is cancelled",
    paragraphs: [opening, refund],
    idempotencyKey: `order-cancelled-${args.orderNumber}`,
  };
}

/**
 * Refund issued, for line refunds, Returns and Goodwill Refunds. A cancellation's refund is
 * covered by the cancellation email, so it gets none (null).
 */
export function refundIssuedNotice(args: {
  orderNumber: string;
  refundId: string;
  kind: RefundKind;
  amountCents: number;
}): CustomerNotice | null {
  const amount = cents(args.amountCents);
  const opening = {
    line: `We refunded ${amount} for part of order #${args.orderNumber}.`,
    return: `We received your return and refunded ${amount} for order #${args.orderNumber}.`,
    goodwill: `We've sent you a ${amount} refund on order #${args.orderNumber}.`,
    cancellation: null,
  }[args.kind];
  if (!opening) return null;
  return {
    subject: `Your ${BRAND} refund of ${amount} for order #${args.orderNumber}`,
    preview: `${amount} is on its way back to you.`,
    badge: "REFUND ISSUED",
    heading: "Your refund is on its way",
    paragraphs: [
      opening,
      "It goes back to your original payment method. Banks usually post it within 5–10 business days.",
    ],
    idempotencyKey: `refund-${args.refundId}`,
  };
}

// ── Administrator alerts ─────────────────────────────────────────────────────

export const adminAlertValidator = v.object({
  subject: v.string(),
  badge: v.string(),
  heading: v.string(),
  body: v.string(),
  facts: v.array(v.object({ label: v.string(), value: v.string() })),
  // The order to link to; absent when the alert could not be linked to one.
  orderNumber: v.optional(v.string()),
  idempotencyKey: v.string(),
});
export type AdminAlert = Infer<typeof adminAlertValidator>;

export function customerCancellationAlert(args: {
  orderNumber: string;
  refundCents: number;
  stockReleased: boolean;
  reason?: string;
}): AdminAlert {
  return {
    subject: `🛑 [Customer Cancellation] Order #${args.orderNumber} — ${cents(args.refundCents)} refund started`,
    badge: "CUSTOMER CANCELLATION",
    heading: "A Customer cancelled their order",
    body: "Do not pack this order. A full refund is being sent through Stripe; you get a separate alert if it fails or stays pending.",
    facts: [
      { label: "Refund", value: cents(args.refundCents) },
      { label: "Stock", value: args.stockReleased ? "Units returned to inventory" : "Inventory unchanged" },
      ...(args.reason ? [{ label: "Reason", value: args.reason }] : []),
    ],
    orderNumber: args.orderNumber,
    idempotencyKey: `customer-cancellation-${args.orderNumber}`,
  };
}

/** A refund Stripe refused or failed after issuing (failed), or one an outage left pending. */
export function refundProblemAlert(args: {
  orderNumber: string;
  refundId: string;
  kind: RefundKind;
  amountCents: number;
  problem: "failed" | "pending";
  error?: string;
}): AdminAlert {
  const failed = args.problem === "failed";
  return {
    subject: failed
      ? `❌ [Refund Failed] Order #${args.orderNumber} — ${cents(args.amountCents)} was not refunded`
      : `⏳ [Refund Pending] Order #${args.orderNumber} — ${cents(args.amountCents)} needs a retry`,
    badge: failed ? "REFUND FAILED" : "REFUND PENDING",
    heading: failed ? "A refund failed" : "A refund is stuck pending",
    body: failed
      ? "The Customer has not been refunded. Open the order and start a new refund, or refund them another way."
      : "Stripe could not be reached. Retry the refund from the order's refunds panel; the retry can never refund twice.",
    facts: [
      { label: "Refund", value: `${args.kind} ${cents(args.amountCents)}` },
      ...(args.error ? [{ label: "Error", value: args.error }] : []),
    ],
    orderNumber: args.orderNumber,
    idempotencyKey: `refund-${args.problem}-${args.refundId}`,
  };
}

/** Stripe took money that settlement refused to apply: a second payment, or a payment on a cancelled Order. */
export function moneyTakenAlert(args: {
  kind: "double_settlement" | "cancelled";
  orderNumber: string;
  stripeSessionId: string;
  total: number;
  currency: string;
}): AdminAlert {
  const double = args.kind === "double_settlement";
  return {
    subject: double
      ? `⚠️ [Double Payment] Order #${args.orderNumber} was paid twice (${money(args.total, args.currency)})`
      : `⚠️ [Payment on Cancelled Order] Order #${args.orderNumber} (${money(args.total, args.currency)})`,
    badge: double ? "DOUBLE PAYMENT" : "PAID AFTER CANCEL",
    heading: double ? "An order was paid twice" : "A cancelled order was paid",
    body: double
      ? "A second Stripe Checkout Session paid an order that was already paid. Refund one of the payments in Stripe."
      : "Stripe took payment for an order that is cancelled, and its stock was already released. Refund the payment, or re-create the order.",
    facts: [
      { label: "Amount", value: money(args.total, args.currency) },
      { label: "Stripe session", value: args.stripeSessionId },
    ],
    orderNumber: args.orderNumber,
    idempotencyKey: `money-${args.kind}-${args.stripeSessionId}`,
  };
}

/** A dispute opened or closed on a charge no order could be found for. */
export function unlinkedDisputeAlert(args: {
  disputeId: string;
  status: string;
  amount: number;
  currency: string;
  reason?: string;
  paymentIntent?: string;
}): AdminAlert {
  return {
    subject: `🚨 [Unlinked Dispute] ${args.disputeId} (${money(args.amount, args.currency)}) — no matching order`,
    badge: "UNLINKED DISPUTE",
    heading: "A dispute could not be linked to an order",
    body: "Find the charge in the Stripe Dashboard and respond to the dispute there before the evidence deadline.",
    facts: [
      { label: "Dispute", value: args.disputeId },
      { label: "Status", value: args.status },
      { label: "Amount", value: money(args.amount, args.currency) },
      ...(args.reason ? [{ label: "Reason", value: args.reason }] : []),
      ...(args.paymentIntent ? [{ label: "Payment intent", value: args.paymentIntent }] : []),
    ],
    idempotencyKey: `dispute-unlinked-${args.disputeId}-${args.status}`,
  };
}
