/**
 * How the storefront and admin desk show an Order's two status axes (ADR 0024): Payment
 * Status and Fulfillment Status, plus the cancelled marker. Pure; the rules that move the
 * axes live in convex/orders/status.ts. Covered by orderStatus.test.ts.
 */
import type { FulfillmentStatus, PaymentStatus } from "@convex/orders/status";

export type OrderLifecycle = {
  paymentStatus?: PaymentStatus;
  fulfillmentStatus?: FulfillmentStatus;
  cancelledAt?: number | null;
  /** The current label's Handoff, as customer views carry it (ADR 0030). */
  handoff?: { at: number } | null;
  /** Full order documents carry it on the label history instead. */
  labels?: Array<{ handoff?: { at: number } }> | null;
};

/** Every read hands the axes filled in; these defaults only cover a stale client cache. */
const payment = (o: OrderLifecycle): PaymentStatus => o.paymentStatus ?? "awaiting_payment";
const fulfillment = (o: OrderLifecycle): FulfillmentStatus => o.fulfillmentStatus ?? "unfulfilled";

export const isCancelledOrder = (o: OrderLifecycle): boolean => o.cancelledAt != null;

/** The package left the Administrator: a Handoff was recorded on the current label. */
const handedOff = (o: OrderLifecycle): boolean => Boolean(o.handoff ?? o.labels?.[o.labels.length - 1]?.handoff);

/** An Expired Checkout (CONTEXT.md): cancelled before any money arrived. */
export const isExpiredCheckout = (o: OrderLifecycle): boolean => isCancelledOrder(o) && payment(o) === "awaiting_payment";

/** Money was received (it may since have been refunded or disputed): "Total Paid", not "Total Due". */
export const isPaidOrder = (o: OrderLifecycle): boolean => payment(o) !== "awaiting_payment";

/** A label exists and the package has not been delivered or come back. */
export const isShippedOrder = (o: OrderLifecycle): boolean =>
  ["label_purchased", "in_transit", "delivery_exception"].includes(fulfillment(o));

/** In the packing queue: paid (or partially refunded), nothing shipped, not cancelled. */
export function awaitsPacking(o: OrderLifecycle): boolean {
  return (
    !isCancelledOrder(o) &&
    (payment(o) === "paid" || payment(o) === "partially_refunded") &&
    fulfillment(o) === "unfulfilled"
  );
}

/** A Customer (or Administrator) may still cancel: not cancelled and nothing shipped. */
export const isCancellableOrder = (o: OrderLifecycle): boolean => !isCancelledOrder(o) && fulfillment(o) === "unfulfilled";

/** The shipping address can change until a label is bought. */
export const isAddressEditable = isCancellableOrder;

export type CustomerBadge =
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "placed"
  | "paid"
  | "label_purchased"
  | "in_transit"
  | "delivered"
  | "delivery_exception"
  | "returned";

/**
 * Badges a Customer sees, money first: cancelled, a refund, then where the package is. A
 * dispute is the Customer's own chargeback and shows as paid.
 */
export function customerBadges(o: OrderLifecycle): CustomerBadge[] {
  const badges: CustomerBadge[] = [];
  if (isCancelledOrder(o)) badges.push("cancelled");
  const money = payment(o);
  if (money === "refunded" || money === "partially_refunded") badges.push(money);
  if (isCancelledOrder(o)) return badges;
  if (money === "awaiting_payment") return [...badges, "placed"];

  const pkg = fulfillment(o);
  // A Ready to Ship package already handed to the carrier is on its way (ADR 0030).
  if (pkg === "label_purchased" && handedOff(o)) return [...badges, "in_transit"];
  if (pkg !== "unfulfilled") return [...badges, pkg];
  return badges.length > 0 ? badges : ["paid"];
}

/**
 * Step on the four-step customer timeline (placed, paid, shipped, delivered), or null when
 * the timeline does not apply: cancelled, or refunded with nothing shipped. Shipped means a
 * Handoff or a carrier scan, not just a bought label (ADR 0030).
 */
export function trackingStep(o: OrderLifecycle): 1 | 2 | 3 | 4 | null {
  if (isCancelledOrder(o)) return null;
  const pkg = fulfillment(o);
  if (payment(o) === "refunded" && pkg === "unfulfilled") return null;
  if (payment(o) === "awaiting_payment") return 1;
  if (pkg === "delivered") return 4;
  if (pkg === "unfulfilled") return 2;
  if (pkg === "label_purchased" && !handedOff(o)) return 2;
  return 3;
}

/** Admin wording for each value on either axis. */
export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  awaiting_payment: "Awaiting payment",
  paid: "Paid",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
  disputed: "Disputed",
};

export const FULFILLMENT_LABELS: Record<FulfillmentStatus, string> = {
  unfulfilled: "Unfulfilled",
  label_purchased: "Ready to ship",
  in_transit: "In transit",
  delivered: "Delivered",
  delivery_exception: "Delivery exception",
  returned: "Returned",
};

/** One-line admin summary, e.g. "Paid · In transit", "Cancelled · Refunded" or "Checkout expired". */
export function adminStatusSummary(o: OrderLifecycle): string {
  if (isExpiredCheckout(o)) return "Checkout expired";
  const money = PAYMENT_LABELS[payment(o)];
  if (isCancelledOrder(o)) return `Cancelled · ${money}`;
  return `${money} · ${FULFILLMENT_LABELS[fulfillment(o)]}`;
}

export type AdminTone = "amber" | "emerald" | "blue" | "purple" | "rose" | "zinc";

export const PAYMENT_TONES: Record<PaymentStatus, AdminTone> = {
  awaiting_payment: "amber",
  paid: "emerald",
  partially_refunded: "amber",
  refunded: "rose",
  disputed: "rose",
};

export const FULFILLMENT_TONES: Record<FulfillmentStatus, AdminTone> = {
  unfulfilled: "zinc",
  label_purchased: "blue",
  in_transit: "blue",
  delivered: "purple",
  delivery_exception: "rose",
  returned: "rose",
};

/** The admin desk tabs, in display order (convex/orders/deskFilters.ts). */
export const ADMIN_DESK_TABS = [
  { id: "all", label: "All" },
  { id: "needs_packing", label: "Needs packing" },
  { id: "overdue", label: "Overdue" },
  { id: "awaiting_payment", label: "Awaiting payment" },
  { id: "ready_to_ship", label: "Ready to ship" },
  { id: "shipped", label: "Shipped" },
  { id: "problems", label: "Problems" },
  { id: "done", label: "Done" },
  { id: "label_purchased", label: "Ready to ship (all)" },
  { id: "in_transit", label: "In transit" },
  { id: "delivered", label: "Delivered" },
  { id: "delivery_exception", label: "Delivery exception" },
  { id: "returned", label: "Returned" },
  { id: "partially_refunded", label: "Partially refunded" },
  { id: "refunded", label: "Refunded" },
  { id: "disputed", label: "Disputed" },
  { id: "cancelled", label: "Cancelled" },
] as const;
