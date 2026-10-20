/**
 * Pure order rules (ADR 0006, ADR 0007, ADR 0023): the status state machine, stock
 * holds, totals and shipping, replay guards, lookups and the customer-facing
 * projections. No database access; covered by orderModel.test.ts.
 */
import type { Doc } from "../_generated/dataModel";
import { randomDigitString } from "../lib/ids";
import type { ShippingSettings } from "../settings/model";

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

/** Stock is held while the order is settled, or a legacy WhatsApp reservation (ADR 0023) not yet cancelled. */
export function holdsStock(status: string): boolean {
  return isPaidLike(status) || status === "whatsapp_initiated";
}

/** Whether this order's units are out of Available Inventory: settled, a legacy reservation, or a live Checkout Hold. */
export function orderHoldsStock(order: Pick<Order, "status" | "checkoutHoldExpiresAt">): boolean {
  return holdsStock(order.status) || isCheckoutHoldActive(order);
}

export type AdminStatusChange =
  | { ok: false; error: string }
  | { ok: true; stock: "deduct" | "release" | "none"; lockCarrierUpdates: boolean };

/**
 * Administrator status change (`orders/desk:updateOrderStatusAdmin`). Settled orders never
 * regress into lead/pending states (stranded stock, double-settlement windows), and a legacy
 * WhatsApp reservation (ADR 0023) can only be cancelled, never settled here.
 * `previousHoldsStock` is true for a `pending` Order with a live Checkout Hold (ADR 0024).
 */
export function planAdminStatusChange(
  previous: OrderStatus,
  next: OrderStatus,
  previousHoldsStock: boolean = holdsStock(previous)
): AdminStatusChange {
  const wasPaidLike = isPaidLike(previous);
  if (wasPaidLike && (next === "pending" || next === "whatsapp_initiated")) {
    return { ok: false, error: `Invalid transition: cannot move a ${previous} order back to ${next}.` };
  }
  if (previous === "whatsapp_initiated" && isPaidLike(next)) {
    return {
      ok: false,
      error: "WhatsApp reservations can no longer be settled (ADR 0023); cancel it instead.",
    };
  }
  let stock: "deduct" | "release" | "none" = "none";
  // Paid from an unpaid state whose units are NOT already held (e.g. a "pending" order with no Checkout Hold).
  if (!wasPaidLike && isPaidLike(next) && !previousHoldsStock) stock = "deduct";
  // Cancelling an order that held stock gives it back.
  if (previousHoldsStock && next === "cancelled") stock = "release";
  // A manual change away from delivered locks out automated carrier webhook overwrites.
  const lockCarrierUpdates = previous === "delivered" && next !== "delivered";
  return { ok: true, stock, lockCarrierUpdates };
}

export type StripeSettlementDecision = "replay" | "double_settlement" | "cancelled" | "settle";

/**
 * What a completed Stripe session does to an order that already exists. A settled order
 * paid again by its own session is a replay (never re-applied, so a dispatched order cannot
 * regress to paid); paid by a different session it is a double settlement, and a payment
 * on a cancelled order is flagged too. Both go to a human, never applied.
 */
export function decideStripeSettlement(
  existing: Pick<Order, "status" | "stripeSessionId" | "webhookEventIds">,
  incoming: { webhookEventId?: string; stripeSessionId: string }
): StripeSettlementDecision {
  if (hasProcessedWebhookEvent(existing, incoming.webhookEventId)) return "replay";
  if (isPaidLike(existing.status)) {
    return existing.stripeSessionId === incoming.stripeSessionId ? "replay" : "double_settlement";
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

/**
 * Stock movement when a completed Stripe session settles an existing order. A pending Order
 * with a Checkout Hold already took its units at Pay, so settling never deducts again; an
 * order that held nothing (a legacy admin-created `pending`) deducts now.
 */
export function settlementStockAction(existing: Pick<Order, "status" | "checkoutHoldExpiresAt">): "deduct" | "none" {
  return orderHoldsStock(existing) ? "none" : "deduct";
}

// ── Checkout Hold (ADR 0024) ─────────────────────────────────────────────────

/** A Checkout Session lasts 30 minutes. */
export const CHECKOUT_SESSION_MS = 30 * 60 * 1000;

/**
 * Stripe rejects an `expires_at` less than 30 minutes after it creates the session, and it
 * creates the session after we compute the time, so the deadline carries a one-minute margin.
 */
export const STRIPE_EXPIRY_MARGIN_MS = 60 * 1000;

/** The hourly backstop expires the session of any Order still awaiting payment 45 minutes after Pay. */
export const BACKSTOP_AFTER_MS = 45 * 60 * 1000;

/** Most overdue holds one backstop run handles; the next hourly run takes the rest. */
export const BACKSTOP_BATCH_SIZE = 50;

/** When a Checkout Hold placed at `nowMs` ends (its session's `expires_at`), in milliseconds. */
export function checkoutHoldExpiresAt(nowMs: number): number {
  return nowMs + CHECKOUT_SESSION_MS + STRIPE_EXPIRY_MARGIN_MS;
}

/** Stripe's `expires_at` (Unix seconds) for the hold's Checkout Session. */
export function stripeSessionExpiresAt(holdExpiresAtMs: number): number {
  return Math.floor(holdExpiresAtMs / 1000);
}

/** A `pending` Order that took its units at Pay and has not settled or been released. */
export function isCheckoutHoldActive(order: Pick<Order, "status" | "checkoutHoldExpiresAt">): boolean {
  return order.status === "pending" && typeof order.checkoutHoldExpiresAt === "number";
}

/**
 * Holds whose hold-expiry is at or before this instant are 45+ minutes past Pay (the hold
 * itself ends 30 minutes and a margin after Pay), so the backstop picks them up.
 */
export function backstopHoldExpiryCutoff(nowMs: number): number {
  return nowMs - (BACKSTOP_AFTER_MS - CHECKOUT_SESSION_MS - STRIPE_EXPIRY_MARGIN_MS);
}

/** True when the backstop should expire this order's session: a live hold placed 45+ minutes ago. */
export function isBackstopDue(order: Pick<Order, "status" | "checkoutHoldExpiresAt">, nowMs: number): boolean {
  return isCheckoutHoldActive(order) && order.checkoutHoldExpiresAt! <= backstopHoldExpiryCutoff(nowMs);
}

/** A Checkout Session's state as Stripe reports it; "unknown" when Stripe could not be reached. */
export type CheckoutSessionState = "open" | "complete" | "expired" | "unknown";

/** Narrow Stripe's session `status` (an open string union) to the states the hold rules know. */
export function toCheckoutSessionState(status: string | null | undefined): CheckoutSessionState {
  return status === "open" || status === "complete" || status === "expired" ? status : "unknown";
}

export type HoldReleaseDecision = "release" | "paid" | "retry";

/**
 * Whether a hold may be released given what Stripe says about its sessions. Only a session
 * Stripe reports expired lets the units go; a completed one means payment is settling, and
 * anything else waits for the next attempt. An order whose session was never created (the
 * action failed before recording it) has nothing to wait for.
 */
export function decideHoldRelease(sessionStates: CheckoutSessionState[]): HoldReleaseDecision {
  if (sessionStates.includes("complete")) return "paid";
  if (sessionStates.every((s) => s === "expired")) return "release";
  return "retry";
}

/** Whether a release request targets this order's live hold: the order must still hold it, through this session. */
export function canReleaseCheckoutHold(
  order: Pick<Order, "status" | "checkoutHoldExpiresAt" | "stripeSessionId">,
  stripeSessionId: string | undefined
): boolean {
  if (!isCheckoutHoldActive(order)) return false;
  return (order.stripeSessionId ?? undefined) === stripeSessionId;
}

/**
 * An Order the Customer never paid for: still awaiting payment, or its Checkout Hold was
 * released unpaid. Hidden from the Customer's order history.
 */
export function isUnpaidCheckout(order: Pick<Order, "status" | "checkoutHoldReleasedAt">): boolean {
  return order.status === "pending" || (order.status === "cancelled" && typeof order.checkoutHoldReleasedAt === "number");
}

export type HoldLine = { variantId: string; name: string; quantity: number; colorway?: string; size?: string };

/** One stock pool: a cap's variant, or a tee's SKU (ADR 0015). */
export function stockKey(line: { variantId: string; colorway?: string; size?: string }): string {
  return [line.variantId, line.colorway ?? "", line.size ?? ""].join("|");
}

/** Units the hold asks of each stock pool, so two lines drawing on one SKU are checked together. */
export function holdDemand(lines: HoldLine[]): Array<{ key: string; line: HoldLine; quantity: number }> {
  const byKey = new Map<string, { key: string; line: HoldLine; quantity: number }>();
  for (const line of lines) {
    const key = stockKey(line);
    const entry = byKey.get(key);
    if (entry) entry.quantity += line.quantity;
    else byKey.set(key, { key, line, quantity: line.quantity });
  }
  return [...byKey.values()];
}

export type HoldPlan = { ok: true } | { ok: false; line: HoldLine; available: number };

/**
 * Whether every stock pool can cover its demand. Never clamps: the first short pool fails
 * the whole hold so the Customer is told, instead of paying for fewer units than they chose.
 */
export function planCheckoutHold(lines: HoldLine[], availableByKey: Map<string, number>): HoldPlan {
  for (const demand of holdDemand(lines)) {
    const available = availableByKey.get(demand.key) ?? 0;
    if (demand.quantity > available) return { ok: false, line: demand.line, available };
  }
  return { ok: true };
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
 * Canonical free-shipping rule: at or above the threshold ships free, otherwise the flat fee.
 * The rules come from store_settings (see settings/model.ts); this stays pure.
 * Single source of truth for all checkout and reservation paths.
 */
export function computeShipping(
  totalUnits: number,
  settings: ShippingSettings,
): { freeShipping: boolean; shippingFee: number } {
  const freeShipping = totalUnits >= settings.freeShippingThresholdUnits;
  return { freeShipping, shippingFee: freeShipping ? 0 : settings.flatShippingFeeUsd };
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
