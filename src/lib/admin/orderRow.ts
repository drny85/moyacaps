/** One Orders-list card (plan 0009 D10): what the Administrator glances at, and the one thing they can do from it. */
import { labelAction } from "../../../convex/orders/status";
import type { FulfillmentStatus, PaymentStatus } from "../../../convex/orders/status";
import { handoffFlag, isHandedOff, type HandoffFlag } from "../../../convex/orders/handoff";
import type { ShippingLabel } from "../../../convex/orders/labels";
import { formatUsd } from "./homeView";

const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;
const THUMBS = 3;

export type OrderRowInput = {
  _id: string;
  orderNumber: string;
  customerName?: string;
  customerEmail?: string;
  total: number;
  createdAt: number;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  cancelledAt?: number;
  items: Array<{ name: string; image: string; quantity: number }>;
  shippingAddress?: { line1: string };
  labels?: ShippingLabel[];
};

export type OrderAge = { value: number; unit: "m" | "h" | "d" };

export type OrderRowVM = {
  id: string;
  orderNumber: string;
  href: string;
  customer: string;
  totalLabel: string;
  itemCount: number;
  thumbs: string[];
  lifecycle: { paymentStatus: PaymentStatus; fulfillmentStatus: FulfillmentStatus; cancelledAt?: number };
  age: OrderAge;
  /** Needs Packing for more than 24 hours (CONTEXT.md "Needs Packing"; spec D12). */
  overdue: boolean;
  quickAction: "buy" | "reship" | null;
  addressMissing: boolean;
  /** Ready to Ship and already given to the carrier (ADR 0030). */
  handedOff: boolean;
  /** A forgotten box, or a handed-off one the carrier never scanned. */
  handoffFlag: HandoffFlag | null;
};

export function orderAge(createdAt: number, now: number): OrderAge {
  const elapsed = Math.max(0, now - createdAt);
  if (elapsed < HOUR_MS) return { value: Math.floor(elapsed / MIN_MS), unit: "m" };
  if (elapsed < DAY_MS) return { value: Math.floor(elapsed / HOUR_MS), unit: "h" };
  return { value: Math.floor(elapsed / DAY_MS), unit: "d" };
}

function needsPacking(o: OrderRowInput): boolean {
  return (
    o.cancelledAt === undefined &&
    (o.paymentStatus === "paid" || o.paymentStatus === "partially_refunded") &&
    o.fulfillmentStatus === "unfulfilled"
  );
}

export function toOrderRow(order: OrderRowInput, now: number, locale: "en" | "es"): OrderRowVM {
  const action = labelAction(order).action;
  return {
    id: order._id,
    orderNumber: order.orderNumber,
    href: `/admin/orders/${order.orderNumber}`,
    customer: order.customerName || order.customerEmail || "",
    totalLabel: formatUsd(order.total, locale),
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    thumbs: order.items.map((item) => item.image).filter(Boolean).slice(0, THUMBS),
    lifecycle: { paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillmentStatus, cancelledAt: order.cancelledAt },
    age: orderAge(order.createdAt, now),
    overdue: needsPacking(order) && order.createdAt < now - DAY_MS,
    quickAction: action,
    addressMissing: !order.shippingAddress?.line1,
    handedOff: isHandedOff(order),
    handoffFlag: handoffFlag(order, now),
  };
}
