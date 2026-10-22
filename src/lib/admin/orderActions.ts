/**
 * What an Administrator can do next with an Order (plan 0009 D14, D16), derived from the
 * status rules in convex/orders/status.ts so the page never offers a move the server rejects.
 */
import { labelAction, manualFulfillmentBlock, statusAxes } from "../../../convex/orders/status";
import type { StatusSource } from "../../../convex/orders/status";
import { currentHandoff, isReadyToShip, type HandoffOrder } from "../../../convex/orders/handoff";

export type NextAction =
  | { kind: "buy_label"; addressMissing: boolean }
  /** The carrier bounced it: Reship when a new label is allowed, or refund. */
  | { kind: "resolve_exception"; reship: boolean }
  /** Ready to Ship and still with the Administrator: record the Handoff (ADR 0030). */
  | { kind: "hand_off" }
  | { kind: "mark_delivered" }
  | { kind: "await_payment"; holdExpiresAt?: number }
  /** Nothing to do; `reason` explains a fully refunded Order, or a paid, unshipped one that still cannot get a label. */
  | { kind: "none"; reason?: string };

export type ManualMove = "mark_delivered" | "revert";

type ActionSource = HandoffOrder & { shippingAddress?: { line1: string }; checkoutHoldExpiresAt?: number };

const BOUNCED = ["delivery_exception", "returned"] as const;
const SHIPPED = ["label_purchased", "in_transit"] as const;
const includes = <T extends string>(list: readonly T[], value: string): value is T => (list as readonly string[]).includes(value);

export function nextOrderAction(order: ActionSource): NextAction {
  const axes = statusAxes(order);
  if (axes.cancelledAt !== undefined) return { kind: "none" };
  if (axes.paymentStatus === "awaiting_payment") return { kind: "await_payment", holdExpiresAt: order.checkoutHoldExpiresAt };
  // A fully refunded Order is done: no label, hand-off or delivery is offered past this point.
  const manualBlock = manualFulfillmentBlock(order);
  if (manualBlock) return { kind: "none", reason: manualBlock };

  const label = labelAction(order);
  if (label.action === "buy") return { kind: "buy_label", addressMissing: !order.shippingAddress?.line1 };
  if (includes(BOUNCED, axes.fulfillmentStatus)) return { kind: "resolve_exception", reship: label.action === "reship" };
  if (isReadyToShip(order) && !currentHandoff(order)) return { kind: "hand_off" };
  if (includes(SHIPPED, axes.fulfillmentStatus)) return { kind: "mark_delivered" };
  if (axes.fulfillmentStatus === "unfulfilled" && label.action === null) return { kind: "none", reason: label.reason };
  return { kind: "none" };
}

/** Manual Fulfillment moves, each behind a confirm; carrier scans remain the normal path. */
export function allowedManualMoves(order: StatusSource): ManualMove[] {
  const axes = statusAxes(order);
  if (manualFulfillmentBlock(order)) return [];
  if (includes([...SHIPPED, "delivery_exception"] as const, axes.fulfillmentStatus)) return ["mark_delivered"];
  if (axes.fulfillmentStatus === "delivered") return ["revert"];
  return [];
}

/**
 * Saving a carrier and Tracking Number by hand (D15): a paid Order that has not shipped moves
 * to in transit (the dispatch email goes out); any later save only corrects the numbers.
 */
export function manualTrackingMove(order: StatusSource): "in_transit" | null {
  if (manualFulfillmentBlock(order)) return null;
  const axes = statusAxes(order);
  return axes.fulfillmentStatus === "unfulfilled" ? "in_transit" : null;
}
