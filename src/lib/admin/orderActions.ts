/**
 * What an Administrator can do next with an Order (plan 0009 D14, D16), derived from the
 * status rules in convex/orders/status.ts so the page never offers a move the server rejects.
 */
import { canChangeFulfillment, labelAction, statusAxes } from "../../../convex/orders/status";
import type { StatusSource } from "../../../convex/orders/status";

export type NextAction =
  | { kind: "buy_label"; addressMissing: boolean }
  /** The carrier bounced it: Reship when a new label is allowed, or refund. */
  | { kind: "resolve_exception"; reship: boolean }
  | { kind: "mark_delivered" }
  | { kind: "await_payment"; holdExpiresAt?: number }
  /** Nothing to do; `reason` explains a paid, unshipped Order that still cannot get a label. */
  | { kind: "none"; reason?: string };

export type ManualMove = "mark_delivered" | "revert";

type ActionSource = StatusSource & { shippingAddress?: { line1: string }; checkoutHoldExpiresAt?: number };

const BOUNCED = ["delivery_exception", "returned"] as const;
const SHIPPED = ["label_purchased", "in_transit"] as const;
const includes = <T extends string>(list: readonly T[], value: string): value is T => (list as readonly string[]).includes(value);

export function nextOrderAction(order: ActionSource): NextAction {
  const axes = statusAxes(order);
  if (axes.cancelledAt !== undefined) return { kind: "none" };
  if (axes.paymentStatus === "awaiting_payment") return { kind: "await_payment", holdExpiresAt: order.checkoutHoldExpiresAt };

  const label = labelAction(order);
  if (label.action === "buy") return { kind: "buy_label", addressMissing: !order.shippingAddress?.line1 };
  if (includes(BOUNCED, axes.fulfillmentStatus)) return { kind: "resolve_exception", reship: label.action === "reship" };
  if (includes(SHIPPED, axes.fulfillmentStatus) && canChangeFulfillment(order)) return { kind: "mark_delivered" };
  if (axes.fulfillmentStatus === "unfulfilled" && label.action === null) return { kind: "none", reason: label.reason };
  return { kind: "none" };
}

/** Manual Fulfillment moves, each behind a confirm; carrier scans remain the normal path. */
export function allowedManualMoves(order: StatusSource): ManualMove[] {
  const axes = statusAxes(order);
  if (axes.cancelledAt !== undefined || !canChangeFulfillment(order)) return [];
  if (includes([...SHIPPED, "delivery_exception"] as const, axes.fulfillmentStatus)) return ["mark_delivered"];
  if (axes.fulfillmentStatus === "delivered") return ["revert"];
  return [];
}
