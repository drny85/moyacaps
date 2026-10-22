/**
 * Admin order desk filters (ADR 0024): which Orders each desk tab lists, on the Payment and
 * Fulfillment Status axes. Pure; the desk query narrows with an index, then applies
 * `matchesDeskFilter` as the source of truth. Covered by deskFilters.test.ts.
 */
import { awaitsFulfillment, isCancelled, isExpiredCheckout, statusAxes } from "./status";
import { currentHandoff, isReadyToShip, type HandoffOrder } from "./handoff";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const DESK_FILTERS = [
  // Every Order except Expired Checkouts, which only the cancelled tab lists.
  "all",
  // Paid (or partially refunded), unfulfilled, not cancelled, not disputed: Needs Packing (CONTEXT.md).
  "needs_packing",
  // Needs Packing, waiting more than 24 hours.
  "overdue",
  "awaiting_payment",
  // Ready to Ship with no Handoff yet: boxes still with the Administrator (ADR 0030).
  "ready_to_ship",
  // Queues (plan 0009 D11): groups of statuses the desk works from.
  "shipped", // handed-off Ready to Ship + in_transit
  "problems", // delivery_exception + returned + disputed, until refunded
  "done", // delivered + refunded (a partial refund alone is a money note, not a finished order)
  "label_purchased",
  "in_transit",
  "delivered",
  "delivery_exception",
  "returned",
  "partially_refunded",
  "refunded",
  "disputed",
  "cancelled",
] as const;
export type DeskFilter = (typeof DESK_FILTERS)[number];

/** Tab values of the single-status desk, still accepted so an older admin page keeps working. */
const LEGACY_FILTERS: Record<string, DeskFilter> = {
  paid: "needs_packing",
  needs_attention: "needs_packing",
  dispatched: "in_transit",
  pending: "awaiting_payment",
};

/** A desk filter from the query argument; unknown values list everything. */
export function parseDeskFilter(value: string | undefined): DeskFilter {
  if (!value) return "all";
  if ((DESK_FILTERS as readonly string[]).includes(value)) return value as DeskFilter;
  return LEGACY_FILTERS[value] ?? "all";
}

/** Whether an Order belongs in a desk tab. `now` drives the overdue tab. */
export function matchesDeskFilter(
  order: HandoffOrder & { createdAt?: number },
  filter: DeskFilter,
  now: number
): boolean {
  const axes = statusAxes(order);
  switch (filter) {
    case "all":
      return !isExpiredCheckout(order);
    case "needs_packing":
      return awaitsFulfillment(order);
    case "overdue":
      return awaitsFulfillment(order) && (order.createdAt || 0) < now - ONE_DAY_MS;
    case "awaiting_payment":
      return axes.paymentStatus === "awaiting_payment" && axes.cancelledAt === undefined;
    case "partially_refunded":
    case "refunded":
    case "disputed":
      return axes.paymentStatus === filter;
    case "cancelled":
      return isCancelled(order);
    case "ready_to_ship":
      return isReadyToShip(order) && !currentHandoff(order);
    case "shipped":
      return (
        axes.cancelledAt === undefined &&
        (axes.fulfillmentStatus === "in_transit" || (isReadyToShip(order) && currentHandoff(order) !== undefined))
      );
    case "problems":
      // A full refund settles a return or exception: it moves to Done. A dispute is a problem until it closes.
      return (
        axes.cancelledAt === undefined &&
        axes.paymentStatus !== "refunded" &&
        (axes.fulfillmentStatus === "delivery_exception" ||
          axes.fulfillmentStatus === "returned" ||
          axes.paymentStatus === "disputed")
      );
    case "done":
      return axes.cancelledAt === undefined && (axes.fulfillmentStatus === "delivered" || axes.paymentStatus === "refunded");
    default:
      return axes.fulfillmentStatus === filter;
  }
}
