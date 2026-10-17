/**
 * Pure order rules (ADR 0006, ADR 0007, ADR 0010): the status state machine, stock
 * holds, totals and shipping, replay guards, lookups and the customer-facing
 * projections. No database access; covered by orderModel.test.ts.
 */
import type { Doc } from "./_generated/dataModel";
import { randomDigitString } from "./ids";

type Order = Doc<"orders">;

// ── Status state machine ─────────────────────────────────────────────────────

export const ORDER_STATUSES = [
  "pending",
  "paid",
  "dispatched",
  "delivered",
  "cancelled",
  "whatsapp_initiated",
  "refunded",
  "partially_refunded",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** Settled orders: money received, stock deducted. */
export function isPaidLike(status: string): boolean {
  return status === "paid" || status === "dispatched" || status === "delivered";
}

/** Stock is held (deducted or reserved) while the order is settled or a WhatsApp reservation. */
export function holdsStock(status: string): boolean {
  return isPaidLike(status) || status === "whatsapp_initiated";
}

export type AdminStatusChange =
  | { ok: false; error: string }
  | { ok: true; stock: "deduct" | "release" | "none"; lockCarrierUpdates: boolean };

/**
 * Administrator status change (`orderDesk:updateOrderStatusAdmin`). Settled orders never
 * regress into lead/pending states (stranded stock, double-settlement windows), and WhatsApp
 * reservations settle only through the dedicated payment flows.
 */
export function planAdminStatusChange(previous: OrderStatus, next: OrderStatus): AdminStatusChange {
  const wasPaidLike = isPaidLike(previous);
  if (wasPaidLike && (next === "pending" || next === "whatsapp_initiated")) {
    return { ok: false, error: `Invalid transition: cannot move a ${previous} order back to ${next}.` };
  }
  if (previous === "whatsapp_initiated" && isPaidLike(next)) {
    return {
      ok: false,
      error: "Use 'Mark as Paid (Zelle)' or the Stripe payment link flow to settle a WhatsApp reservation.",
    };
  }
  let stock: "deduct" | "release" | "none" = "none";
  // Paid from an unpaid state where stock was NOT already reserved (e.g. "pending").
  if (!wasPaidLike && isPaidLike(next) && previous !== "whatsapp_initiated") stock = "deduct";
  // Cancelling an order that held stock gives it back.
  if (holdsStock(previous) && next === "cancelled") stock = "release";
  // A manual change away from delivered locks out automated carrier webhook overwrites.
  const lockCarrierUpdates = previous === "delivered" && next !== "delivered";
  return { ok: true, stock, lockCarrierUpdates };
}

export type StripeSettlementDecision = "replay" | "double_settlement" | "cancelled" | "settle";

/**
 * What a completed Stripe session does to an order that already exists: replays and
 * settlements on already-settled WhatsApp orders or cancelled orders are flagged for a
 * human, never applied.
 */
export function decideStripeSettlement(
  existing: Pick<Order, "status" | "paymentMethod" | "webhookEventIds">,
  incoming: { webhookEventId?: string; isWhatsAppOrder?: boolean }
): StripeSettlementDecision {
  if (hasProcessedWebhookEvent(existing, incoming.webhookEventId)) return "replay";
  if (isPaidLike(existing.status) && (incoming.isWhatsAppOrder || existing.paymentMethod === "whatsapp")) {
    return "double_settlement";
  }
  if (existing.status === "cancelled") return "cancelled";
  return "settle";
}

/**
 * Refund recorded from Stripe: status follows whether the charge is fully refunded, and the
 * refunded total never goes down (events can arrive out of order).
 */
export function planRefund(currentRefunded: number | undefined, refundedAmount: number, isFullRefund: boolean) {
  return {
    status: isFullRefund ? ("refunded" as const) : ("partially_refunded" as const),
    refundedAmount: Math.max(currentRefunded || 0, refundedAmount),
  };
}

// ── Bounded id histories and notes ───────────────────────────────────────────

/** Orders keep the 10 most recent Stripe session ids and processed webhook event ids. */
export const MAX_TRACKED_IDS = 10;

export function appendBoundedId(ids: string[] | undefined, id: string): string[] {
  const next = ids ? [...ids] : [];
  if (!next.includes(id)) next.push(id);
  return next.slice(-MAX_TRACKED_IDS);
}

/** True when this Stripe webhook event id was already processed for the order (replay guard). */
export function hasProcessedWebhookEvent(order: { webhookEventIds?: string[] }, eventId?: string): boolean {
  return Boolean(eventId && order.webhookEventIds?.includes(eventId));
}

export function withWebhookEventId(order: { webhookEventIds?: string[] }, eventId?: string): string[] | undefined {
  if (!eventId) return order.webhookEventIds;
  return appendBoundedId(order.webhookEventIds, eventId);
}

/** Append one line to the order's admin notes. */
export function appendNote(notes: string | undefined, line: string): string {
  return `${notes ? notes + "\n" : ""}${line}`;
}

export function newTrackingNumber(): string {
  return `GL-TRK-${randomDigitString(6)}`;
}

/** Every Stripe Checkout session ever issued for the order, current one last, no duplicates. */
export function orderSessionIds(order: { stripeSessionIds?: string[]; stripeSessionId?: string }): string[] {
  return Array.from(
    new Set([...(order.stripeSessionIds || []), ...(order.stripeSessionId ? [order.stripeSessionId] : [])].filter(Boolean))
  );
}

// ── Totals and shipping ──────────────────────────────────────────────────────

/**
 * Canonical free-shipping rule: 2+ items ship free, otherwise flat $8 US express.
 * Single source of truth for all checkout and reservation paths.
 */
export const FREE_SHIPPING_THRESHOLD_CAPS = 2;
export const FLAT_SHIPPING_FEE_USD = 8;

export function computeShipping(totalUnits: number): { freeShipping: boolean; shippingFee: number } {
  const freeShipping = totalUnits >= FREE_SHIPPING_THRESHOLD_CAPS;
  return { freeShipping, shippingFee: freeShipping ? 0 : FLAT_SHIPPING_FEE_USD };
}

// ── Lookups ──────────────────────────────────────────────────────────────────

/**
 * Order numbers to try for a typed lookup: the cleaned input, then (when it has no prefix)
 * the "GL-" form and the legacy "MC-" form. Empty input yields no candidates.
 */
export function orderNumberCandidates(input: string): string[] {
  const clean = input.trim().toUpperCase().replace(/^#/, "");
  if (!clean) return [];
  if (clean.startsWith("GL-") || clean.startsWith("MC-")) return [clean];
  return [clean, `GL-${clean}`, `MC-${clean}`];
}

/** Admin order search across number, contact, tracking and line items. */
export function matchesOrderSearch(order: Order, search: string): boolean {
  const q = search.trim().toLowerCase();
  return Boolean(
    order.orderNumber.toLowerCase().includes(q) ||
      (order.customerEmail && order.customerEmail.toLowerCase().includes(q)) ||
      (order.customerName && order.customerName.toLowerCase().includes(q)) ||
      (order.customerPhone && order.customerPhone.toLowerCase().includes(q)) ||
      (order.trackingNumber && order.trackingNumber.toLowerCase().includes(q)) ||
      order.items.some((item) => item.name.toLowerCase().includes(q) || item.variantId.toLowerCase().includes(q))
  );
}

// ── Customer-facing projections ──────────────────────────────────────────────

const firstName = (name?: string) => (name ? name.split(" ")[0] : undefined);

const publicItems = (order: Order) =>
  order.items.map((item) => ({
    variantId: item.variantId,
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    image: item.image,
  }));

/** Shared core projection: never exposes payment links, session ids, or admin notes. */
function orderStatusView(order: Order) {
  return {
    _id: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    trackingStatus: order.trackingStatus,
    trackingStatusDetails: order.trackingStatusDetails,
    trackingStatusDate: order.trackingStatusDate,
    trackingLocation: order.trackingLocation,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    currency: order.currency,
    items: publicItems(order),
    customerName: order.customerName,
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    tax: order.tax,
    taxDetails: order.taxDetails,
    total: order.total,
    paymentMethod: order.paymentMethod,
    invoicePdfUrl: order.invoicePdfUrl,
    hostedInvoiceUrl: order.hostedInvoiceUrl,
  };
}

/**
 * Checkout confirmation view. A Stripe session id is high-entropy and only appears in the
 * payer's own return URL, so it may show the address and phone; a bare order number stays
 * minimal because enumeration must not reveal PII.
 */
export function confirmationView(order: Order, viaStripeSession: boolean) {
  if (viaStripeSession) {
    return {
      ...orderStatusView(order),
      customerName: order.customerName,
      shippingAddress: order.shippingAddress,
      customerPhone: order.customerPhone,
      isGuestView: false,
    };
  }
  return {
    ...orderStatusView(order),
    customerName: firstName(order.customerName),
    shippingAddress: undefined,
    customerPhone: undefined,
    isGuestView: true,
  };
}

/**
 * Order tracking view for someone who is not the owner or an Administrator: redacts street,
 * postal code, contact details and NEVER exposes the live Stripe payment link.
 */
export function guestTrackingView(order: Order) {
  return {
    _id: order._id,
    orderNumber: order.orderNumber,
    status: order.status,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    trackingStatus: order.trackingStatus,
    trackingStatusDetails: order.trackingStatusDetails,
    trackingStatusDate: order.trackingStatusDate,
    trackingLocation: order.trackingLocation,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    currency: order.currency,
    items: publicItems(order),
    shippingAddress: order.shippingAddress
      ? {
          line1: order.shippingAddress.line1 ? "***" : "",
          line2: undefined as string | undefined,
          city: order.shippingAddress.city,
          state: order.shippingAddress.state,
          postalCode: order.shippingAddress.postalCode ? "***" : "",
          country: order.shippingAddress.country,
        }
      : undefined,
    customerName: firstName(order.customerName),
    customerEmail: undefined,
    customerPhone: undefined,
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    tax: order.tax,
    taxDetails: order.taxDetails,
    total: order.total,
    paymentMethod: order.paymentMethod,
    paymentUrl: undefined,
    paymentLinkSentAt: order.paymentLinkSentAt,
    reservationExpiresAt: order.reservationExpiresAt,
    invoicePdfUrl: order.invoicePdfUrl,
    hostedInvoiceUrl: order.hostedInvoiceUrl,
    isGuestView: true,
  };
}

/** Order tracking view for the authenticated owner or an Administrator. */
export function ownerTrackingView(order: Order) {
  return {
    _id: order._id,
    orderNumber: order.orderNumber,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    shippingAddress: order.shippingAddress,
    items: order.items,
    currency: order.currency,
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    tax: order.tax,
    taxDetails: order.taxDetails,
    total: order.total,
    status: order.status,
    paymentMethod: order.paymentMethod,
    carrier: order.carrier,
    trackingNumber: order.trackingNumber,
    trackingStatus: order.trackingStatus,
    trackingStatusDetails: order.trackingStatusDetails,
    trackingStatusDate: order.trackingStatusDate,
    trackingLocation: order.trackingLocation,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    paymentUrl: order.paymentUrl,
    paymentLinkSentAt: order.paymentLinkSentAt,
    reservationExpiresAt: order.reservationExpiresAt,
    invoicePdfUrl: order.invoicePdfUrl,
    hostedInvoiceUrl: order.hostedInvoiceUrl,
    isGuestView: false,
  };
}
