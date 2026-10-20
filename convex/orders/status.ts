/**
 * Order lifecycle on two independent axes (ADR 0024): Payment Status (where the money stands)
 * and Fulfillment Status (where the package stands), plus a cancelled marker. Every rule that
 * moves an axis lives here, so a refund or dispute never touches the package and a label or
 * carrier scan never touches the money. Pure: no database access; covered by status.test.ts.
 *
 * Transition planners return `{ ok: false, error }` instead of throwing, so callers decide
 * whether a refusal is a customer-facing error or a silent no-op.
 */
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";

// ── The two axes and the cancelled marker ────────────────────────────────────

export const PAYMENT_STATUSES = ["awaiting_payment", "paid", "partially_refunded", "refunded", "disputed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const FULFILLMENT_STATUSES = [
  "unfulfilled",
  "label_purchased",
  "in_transit",
  "delivered",
  "delivery_exception",
  "returned",
] as const;
export type FulfillmentStatus = (typeof FULFILLMENT_STATUSES)[number];

/** Why an Order was cancelled. Free-text detail goes to the payment event and admin notes. */
export const CANCELLATION_REASONS = [
  "checkout_expired",
  "customer",
  "administrator",
  "whatsapp_retired",
  "legacy",
] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export const paymentStatusValidator = v.union(
  v.literal("awaiting_payment"),
  v.literal("paid"),
  v.literal("partially_refunded"),
  v.literal("refunded"),
  v.literal("disputed")
);

export const fulfillmentStatusValidator = v.union(
  v.literal("unfulfilled"),
  v.literal("label_purchased"),
  v.literal("in_transit"),
  v.literal("delivered"),
  v.literal("delivery_exception"),
  v.literal("returned")
);

export const cancellationReasonValidator = v.union(
  v.literal("checkout_expired"),
  v.literal("customer"),
  v.literal("administrator"),
  v.literal("whatsapp_retired"),
  v.literal("legacy")
);

/** An Order's resolved lifecycle state. */
export type StatusAxes = {
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  cancelledAt?: number;
  cancellationReason?: CancellationReason;
};

type Order = Doc<"orders">;

/** The order fields the lifecycle rules read; every field optional so callers pass what they have. */
export type StatusSource = Partial<
  Pick<
    Order,
    | "paymentStatus"
    | "fulfillmentStatus"
    | "cancelledAt"
    | "cancellationReason"
    // Legacy single status and the evidence the backfill infers the axes from.
    | "status"
    | "disputed"
    | "refundedAmount"
    | "total"
    | "shippingLabelUrl"
    | "trackingNumber"
    | "trackingDeliveredAt"
    | "stripeInvoiceId"
    | "checkoutHoldReleasedAt"
    | "updatedAt"
    | "createdAt"
  >
>;

export type Transition<T> = { ok: true } & T | { ok: false; error: string };

// ── Reading an order's axes ──────────────────────────────────────────────────

/**
 * An Order's lifecycle state. Backfilled and new Orders carry both fields; an Order written
 * before the split and not yet backfilled is read through the backfill's own mapping, so the
 * deploy works before `orders/migrations:backfillOrderStatusAxes` finishes.
 */
export function statusAxes(order: StatusSource): StatusAxes {
  if (order.paymentStatus && order.fulfillmentStatus) {
    return {
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      ...(order.cancelledAt !== undefined && { cancelledAt: order.cancelledAt }),
      ...(order.cancellationReason !== undefined && { cancellationReason: order.cancellationReason }),
    };
  }
  return legacyStatusAxes(order);
}

export function isCancelled(order: StatusSource): boolean {
  return statusAxes(order).cancelledAt !== undefined;
}

/**
 * The fields to write when one axis changes. Always writes both axes (and the cancelled marker
 * of a not-yet-backfilled Order), so a stored Order never carries one axis without the other.
 */
export function statusPatch(order: StatusSource, change: Partial<StatusAxes>): StatusAxes {
  const next = { ...statusAxes(order), ...change };
  return {
    paymentStatus: next.paymentStatus,
    fulfillmentStatus: next.fulfillmentStatus,
    ...(next.cancelledAt !== undefined && { cancelledAt: next.cancelledAt }),
    ...(next.cancellationReason !== undefined && { cancellationReason: next.cancellationReason }),
  };
}

/** The Order with both axes filled in, for reads that hand whole documents to the admin UI. */
export function withStatusAxes<T extends StatusSource>(order: T): T & StatusAxes {
  return { ...order, ...statusPatch(order, {}) };
}

// ── Derived questions ────────────────────────────────────────────────────────

/** Money was received at some point (it may since have been refunded or disputed). */
export function hasSettled(order: StatusSource): boolean {
  return statusAxes(order).paymentStatus !== "awaiting_payment";
}

/** Counts toward revenue: settled and kept (not refunded at all, not cancelled). A dispute still counts until it closes. */
export function countsAsSale(order: StatusSource): boolean {
  const axes = statusAxes(order);
  return axes.cancelledAt === undefined && (axes.paymentStatus === "paid" || axes.paymentStatus === "disputed");
}

/**
 * Settled units still out of Available Inventory because of this Order. Refunds never restock
 * (a Restock is an explicit Administrator choice), so a refunded Order holds nothing to release.
 */
export function settledHoldsStock(order: StatusSource): boolean {
  return countsAsSale(order);
}

/** Paid (or partially refunded), not cancelled, not disputed, and nothing shipped yet: the packing queue. */
export function awaitsFulfillment(order: StatusSource): boolean {
  const axes = statusAxes(order);
  return (
    axes.cancelledAt === undefined &&
    (axes.paymentStatus === "paid" || axes.paymentStatus === "partially_refunded") &&
    axes.fulfillmentStatus === "unfulfilled"
  );
}

/** The shipping address can change until a label is bought. */
export function canEditShippingAddress(order: StatusSource): boolean {
  const axes = statusAxes(order);
  return axes.cancelledAt === undefined && axes.fulfillmentStatus === "unfulfilled";
}

// ── Payment axis ─────────────────────────────────────────────────────────────

/** Payment Status implied by how much has been refunded (amounts in currency units, compared in cents). */
export function paymentStatusFromRefunds(
  refundedAmount: number | undefined,
  total: number | undefined
): "paid" | "partially_refunded" | "refunded" {
  const refundedCents = Math.round((refundedAmount ?? 0) * 100);
  if (refundedCents <= 0) return "paid";
  return refundedCents >= Math.round((total ?? 0) * 100) ? "refunded" : "partially_refunded";
}

/** A completed Checkout Session settles an Order still awaiting payment and not cancelled. */
export function planSettlement(order: StatusSource): Transition<{ paymentStatus: "paid" }> {
  const axes = statusAxes(order);
  if (axes.paymentStatus !== "awaiting_payment") return { ok: false, error: "Order is already settled." };
  if (axes.cancelledAt !== undefined) return { ok: false, error: "Order is cancelled." };
  return { ok: true, paymentStatus: "paid" };
}

/**
 * Refund recorded from Stripe: Payment Status follows whether the charge is fully refunded,
 * and the refunded total never goes down (events can arrive out of order). An open dispute
 * stays the Payment Status until it closes. Fulfillment is never touched.
 */
export function planRefund(
  order: StatusSource,
  refundedAmount: number,
  isFullRefund: boolean
): { paymentStatus: PaymentStatus; refundedAmount: number } {
  const total = Math.max(order.refundedAmount || 0, refundedAmount);
  if (statusAxes(order).paymentStatus === "disputed") return { paymentStatus: "disputed", refundedAmount: total };
  return { paymentStatus: isFullRefund ? "refunded" : "partially_refunded", refundedAmount: total };
}

/**
 * A dispute opened makes the Payment Status disputed; once it closes it returns to what the
 * refunds say. Fulfillment is never touched.
 */
export function planDispute(order: StatusSource, action: "opened" | "closed"): { paymentStatus: PaymentStatus } {
  if (action === "opened") return { paymentStatus: "disputed" };
  return { paymentStatus: paymentStatusFromRefunds(order.refundedAmount, order.total) };
}

// ── Cancelled marker ─────────────────────────────────────────────────────────

export type CancellationActor = "customer" | "administrator";

/**
 * Cancelling an Order. A Customer may cancel only before anything ships; an Administrator any
 * time. Cancelling gives back the units the Order holds. Payment Status is left alone: the
 * refund that may follow records itself.
 */
export function planCancellation(
  order: StatusSource,
  actor: CancellationActor,
  holdsStock: boolean
): Transition<{ releaseStock: boolean }> {
  const axes = statusAxes(order);
  if (axes.cancelledAt !== undefined) return { ok: false, error: "Order is already cancelled" };
  if (actor === "customer" && axes.fulfillmentStatus !== "unfulfilled") {
    return {
      ok: false,
      error: "Cannot cancel an order that has already been dispatched. Please request a return via concierge.",
    };
  }
  return { ok: true, releaseStock: holdsStock };
}

// ── Fulfillment axis ─────────────────────────────────────────────────────────

const AWAITING_PAYMENT_ERROR = "Fulfillment can only change once the order is paid.";

/** Fulfillment Status only changes once the Order is paid. */
export function canChangeFulfillment(order: StatusSource): boolean {
  return hasSettled(order);
}

/**
 * Buying a shipping label. A delivered Order stays delivered; any other settled Order moves
 * to label purchased. Payment Status is never touched.
 */
export function planLabelPurchase(order: StatusSource): Transition<{ fulfillmentStatus: FulfillmentStatus }> {
  if (!canChangeFulfillment(order)) return { ok: false, error: AWAITING_PAYMENT_ERROR };
  const current = statusAxes(order).fulfillmentStatus;
  return { ok: true, fulfillmentStatus: current === "delivered" ? "delivered" : "label_purchased" };
}

/** Carrier scan codes (Shippo `tracking_status.status`). */
export type CarrierScan = "PRE_TRANSIT" | "TRANSIT" | "DELIVERED" | "RETURNED" | "FAILURE" | "UNKNOWN";

/** Which Fulfillment Statuses each carrier scan moves an Order out of, and where to. */
const SCAN_TRANSITIONS: Partial<Record<CarrierScan, { from: FulfillmentStatus[]; to: FulfillmentStatus }>> = {
  TRANSIT: { from: ["label_purchased", "delivery_exception"], to: "in_transit" },
  DELIVERED: { from: ["label_purchased", "in_transit", "delivery_exception"], to: "delivered" },
  FAILURE: { from: ["label_purchased", "in_transit"], to: "delivery_exception" },
  RETURNED: { from: ["label_purchased", "in_transit", "delivery_exception"], to: "returned" },
};

/**
 * Fulfillment Status after a carrier scan, or undefined when the scan changes nothing. An
 * Administrator's manual change locks carrier overwrites (`manualStatusOverride`), and an
 * Order awaiting payment has no fulfillment to move. Payment Status is never touched.
 */
export function fulfillmentAfterScan(
  order: StatusSource,
  scan: string,
  manualStatusOverride: boolean | undefined
): FulfillmentStatus | undefined {
  if (manualStatusOverride || !canChangeFulfillment(order)) return undefined;
  const rule = SCAN_TRANSITIONS[scan.toUpperCase() as CarrierScan];
  const current = statusAxes(order).fulfillmentStatus;
  return rule && rule.from.includes(current) ? rule.to : undefined;
}

/**
 * Administrator sets Fulfillment Status by hand. Delivered comes from the carrier scan, so a
 * manual change into or out of delivered locks out carrier overwrites.
 */
export function planManualFulfillmentChange(
  order: StatusSource,
  next: FulfillmentStatus
): Transition<{ fulfillmentStatus: FulfillmentStatus; lockCarrierUpdates: boolean }> {
  if (!canChangeFulfillment(order)) return { ok: false, error: AWAITING_PAYMENT_ERROR };
  const current = statusAxes(order).fulfillmentStatus;
  if (current === next) return { ok: false, error: `Order is already ${next.replace(/_/g, " ")}.` };
  const lockCarrierUpdates = current === "delivered" || next === "delivered";
  return { ok: true, fulfillmentStatus: next, lockCarrierUpdates };
}

// ── Legacy single status (backfill mapping) ──────────────────────────────────

/** Evidence the backfill reads from `payment_events`; the read fallback goes without it. */
export type LegacyEvidence = {
  /** A settlement event exists for the Order (stripe_settled / zelle_settled). */
  settled?: boolean;
  /** When a `cancelled` payment event was recorded, if any. */
  cancelledAt?: number;
};

/** Settlement used to mint a placeholder `GL-TRK-` number for every paid Order: not a shipment. */
function isCarrierTrackingNumber(trackingNumber: string | undefined): boolean {
  return Boolean(trackingNumber && !trackingNumber.startsWith("GL-TRK-"));
}

/** Fulfillment of a refunded or cancelled Order, read from what the carrier and label left behind. */
function inferredFulfillment(order: StatusSource): FulfillmentStatus {
  if (order.trackingDeliveredAt) return "delivered";
  if (order.shippingLabelUrl || isCarrierTrackingNumber(order.trackingNumber)) return "in_transit";
  return "unfulfilled";
}

/** Payment Status of an Order whose legacy status was `cancelled`. */
function cancelledPaymentStatus(order: StatusSource, evidence: LegacyEvidence): PaymentStatus {
  if ((order.refundedAmount ?? 0) > 0) return paymentStatusFromRefunds(order.refundedAmount, order.total);
  if (order.checkoutHoldReleasedAt !== undefined) return "awaiting_payment";
  // Every card settlement since ADR 0010 attaches a Stripe invoice.
  return evidence.settled ?? Boolean(order.stripeInvoiceId) ? "paid" : "awaiting_payment";
}

/**
 * Map the legacy single `status` to the two axes (the backfill rule, ADR 0024):
 * pending → awaiting payment; paid → paid (label purchased when a label exists); dispatched →
 * in transit; delivered → delivered; refunded / partially refunded keep that Payment Status
 * with fulfillment inferred from delivery, label or carrier tracking; cancelled sets the
 * marker and keeps its payment state; whatsapp_initiated is cancelled. `disputed` wins the
 * Payment Status of a settled Order.
 */
export function legacyStatusAxes(order: StatusSource, evidence: LegacyEvidence = {}): StatusAxes {
  const changedAt = order.updatedAt ?? order.createdAt ?? 0;
  let axes: StatusAxes;
  switch (order.status) {
    case "paid":
      axes = { paymentStatus: "paid", fulfillmentStatus: order.shippingLabelUrl ? "label_purchased" : "unfulfilled" };
      break;
    case "dispatched":
      axes = { paymentStatus: "paid", fulfillmentStatus: "in_transit" };
      break;
    case "delivered":
      axes = { paymentStatus: "paid", fulfillmentStatus: "delivered" };
      break;
    case "refunded":
    case "partially_refunded":
      axes = { paymentStatus: order.status, fulfillmentStatus: inferredFulfillment(order) };
      break;
    case "cancelled": {
      const paymentStatus = cancelledPaymentStatus(order, evidence);
      axes = {
        paymentStatus,
        fulfillmentStatus: paymentStatus === "awaiting_payment" ? "unfulfilled" : inferredFulfillment(order),
        cancelledAt: evidence.cancelledAt ?? changedAt,
        cancellationReason: order.checkoutHoldReleasedAt !== undefined ? "checkout_expired" : "legacy",
      };
      break;
    }
    case "whatsapp_initiated":
      axes = {
        paymentStatus: "awaiting_payment",
        fulfillmentStatus: "unfulfilled",
        cancelledAt: changedAt,
        cancellationReason: "whatsapp_retired",
      };
      break;
    default:
      axes = { paymentStatus: "awaiting_payment", fulfillmentStatus: "unfulfilled" };
  }

  // A refund used to overwrite `cancelled`; the audit log still remembers the cancellation.
  if (axes.cancelledAt === undefined && evidence.cancelledAt !== undefined) {
    axes = { ...axes, cancelledAt: evidence.cancelledAt, cancellationReason: "legacy" };
  }
  if (order.disputed && axes.paymentStatus !== "awaiting_payment") {
    axes = { ...axes, paymentStatus: "disputed" };
  }
  return axes;
}
