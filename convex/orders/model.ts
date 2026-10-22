/**
 * Pure order rules (ADR 0006, ADR 0007, ADR 0023, ADR 0024): stock holds and settlement,
 * the Checkout Hold, totals and shipping, replay guards, lookups and the customer-facing
 * projections. The Payment / Fulfillment Status rules live in status.ts. No database
 * access; covered by model.test.ts.
 */
import type { Doc } from "../_generated/dataModel";
import type { ShippingSettings } from "../settings/model";
import {
  hasSettled,
  isCancelled,
  settledHoldsStock,
  statusAxes,
  statusPatch,
  type StatusSource,
} from "./status";
import { carrierTrackingNumber } from "./trackingNumber";

type Order = Doc<"orders">;

// ── Stock and settlement (axes and their transitions live in status.ts) ─────

/** Whether this order's units are out of Available Inventory: settled and kept, or a live Checkout Hold. */
export function orderHoldsStock(order: StatusSource & Pick<Partial<Order>, "checkoutHoldExpiresAt">): boolean {
  return settledHoldsStock(order) || isCheckoutHoldActive(order);
}

export type StripeSettlementDecision = "replay" | "double_settlement" | "cancelled" | "settle";

/**
 * What a completed Stripe session does to an order that already exists. A settled order
 * paid again by its own session is a replay (never re-applied, so a shipped order cannot
 * regress to paid); paid by a different session it is a double settlement, and a payment
 * on a cancelled order is flagged too. Both go to a human, never applied.
 */
export function decideStripeSettlement(
  existing: StatusSource & Pick<Order, "stripeSessionId" | "webhookEventIds">,
  incoming: { webhookEventId?: string; stripeSessionId: string }
): StripeSettlementDecision {
  if (hasProcessedWebhookEvent(existing, incoming.webhookEventId)) return "replay";
  if (hasSettled(existing)) {
    return existing.stripeSessionId === incoming.stripeSessionId ? "replay" : "double_settlement";
  }
  if (isCancelled(existing)) return "cancelled";
  return "settle";
}

/**
 * Stock movement when a completed Stripe session settles an existing order. A pending Order
 * with a Checkout Hold already took its units at Pay, so settling never deducts again; an
 * order that held nothing (a legacy admin-created order awaiting payment) deducts now.
 */
export function settlementStockAction(
  existing: StatusSource & Pick<Partial<Order>, "checkoutHoldExpiresAt">
): "deduct" | "none" {
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

/**
 * The backstop expires the session of any Order still awaiting payment 5 minutes after its
 * hold ended: by then Stripe's `checkout.session.expired` event should have released it.
 */
export const BACKSTOP_GRACE_MS = 5 * 60 * 1000;

/** How often the backstop runs; with the grace, a lost event holds stock at most ~46 minutes. */
export const BACKSTOP_INTERVAL_MINUTES = 10;

/** Most overdue holds one backstop run handles; the next run takes the rest. */
export const BACKSTOP_BATCH_SIZE = 50;

/** When a Checkout Hold placed at `nowMs` ends (its session's `expires_at`), in milliseconds. */
export function checkoutHoldExpiresAt(nowMs: number): number {
  return nowMs + CHECKOUT_SESSION_MS + STRIPE_EXPIRY_MARGIN_MS;
}

/** Stripe's `expires_at` (Unix seconds) for the hold's Checkout Session. */
export function stripeSessionExpiresAt(holdExpiresAtMs: number): number {
  return Math.floor(holdExpiresAtMs / 1000);
}

/** An Order awaiting payment that took its units at Pay and has not settled or been released. */
export function isCheckoutHoldActive(order: StatusSource & Pick<Partial<Order>, "checkoutHoldExpiresAt">): boolean {
  const axes = statusAxes(order);
  return (
    axes.paymentStatus === "awaiting_payment" &&
    axes.cancelledAt === undefined &&
    typeof order.checkoutHoldExpiresAt === "number"
  );
}

/** Holds whose hold-expiry is at or before this instant ended 5+ minutes ago, so the backstop picks them up. */
export function backstopHoldExpiryCutoff(nowMs: number): number {
  return nowMs - BACKSTOP_GRACE_MS;
}

/** True when the backstop should expire this order's session: a live hold that ended 5+ minutes ago. */
export function isBackstopDue(
  order: StatusSource & Pick<Partial<Order>, "checkoutHoldExpiresAt">,
  nowMs: number
): boolean {
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
  order: StatusSource & Pick<Partial<Order>, "checkoutHoldExpiresAt" | "stripeSessionId">,
  stripeSessionId: string | undefined
): boolean {
  if (!isCheckoutHoldActive(order)) return false;
  return (order.stripeSessionId ?? undefined) === stripeSessionId;
}

/**
 * An Order the Customer never paid for: still awaiting payment, or cancelled before payment
 * (e.g. its Checkout Hold was released). Hidden from the Customer's order history.
 */
export function isUnpaidCheckout(order: StatusSource): boolean {
  return !hasSettled(order);
}

/** The fields that release a Checkout Hold unpaid: the Order is cancelled, awaiting payment forever. */
export function checkoutHoldReleasePatch(order: StatusSource, nowMs: number) {
  return {
    ...statusPatch(order, { cancelledAt: nowMs, cancellationReason: "checkout_expired" }),
    checkoutHoldReleasedAt: nowMs,
  };
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

/**
 * Index keys an admin search can hit exactly, so an Order older than the desk's recent window
 * is still found by its number, email or tracking number (security review M9).
 */
export function exactOrderSearchKeys(search: string): { orderNumbers: string[]; email?: string; trackingNumbers: string[] } {
  const q = search.trim();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q) ? q.toLowerCase() : undefined;
  const tracking = /^[A-Za-z0-9]{8,40}$/.test(q) ? [...new Set([q, q.toUpperCase()])] : [];
  return { orderNumbers: email ? [] : orderNumberCandidates(q), ...(email && { email }), trackingNumbers: tracking };
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

/** The lifecycle fields every view shows: both axes and the cancelled marker. */
function lifecycleView(order: Order) {
  const axes = statusAxes(order);
  return {
    paymentStatus: axes.paymentStatus,
    fulfillmentStatus: axes.fulfillmentStatus,
    cancelledAt: axes.cancelledAt,
  };
}

/** Shared core projection: never exposes payment links, session ids, or admin notes. */
function orderStatusView(order: Order) {
  return {
    _id: order._id,
    orderNumber: order.orderNumber,
    ...lifecycleView(order),
    carrier: order.carrier,
    trackingNumber: carrierTrackingNumber(order),
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
    ...lifecycleView(order),
    carrier: order.carrier,
    trackingNumber: carrierTrackingNumber(order),
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
    ...lifecycleView(order),
    paymentMethod: order.paymentMethod,
    carrier: order.carrier,
    trackingNumber: carrierTrackingNumber(order),
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
