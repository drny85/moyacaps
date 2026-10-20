/**
 * Shipping label history (CONTEXT.md "Reship"): every label bought for an Order, oldest first.
 * The current label is also mirrored on the Order's flat shipping fields (trackingNumber,
 * shippingLabelUrl, …), which carrier scans and older readers use. Pure; covered by labels.test.ts.
 */
import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { isCarrierTrackingNumber } from "./trackingNumber";

export const shippingLabelValidator = v.object({
  carrier: v.string(),
  trackingNumber: v.string(),
  labelUrl: v.string(),
  transactionId: v.optional(v.string()),
  rateId: v.optional(v.string()),
  serviceLevel: v.optional(v.string()),
  cost: v.optional(v.number()),
  purchasedAt: v.number(),
  reship: v.boolean(),
});

export type ShippingLabel = Infer<typeof shippingLabelValidator>;

/** Labels kept per Order; a Reship beyond this drops the oldest entry. */
export const MAX_LABELS = 10;

export type LabelSource = Pick<
  Partial<Doc<"orders">>,
  | "labels"
  | "shippingLabelUrl"
  | "trackingNumber"
  | "carrier"
  | "shippingCarrier"
  | "shippingTransactionId"
  | "shippingRateId"
  | "shippingServiceLevel"
  | "shippingCost"
  | "updatedAt"
  | "createdAt"
>;

/**
 * The Order's labels, oldest first. An Order labelled before the history existed has one
 * label, read from its flat shipping fields (purchase date approximated by its last update).
 */
export function labelHistory(order: LabelSource): ShippingLabel[] {
  if (order.labels) return order.labels;
  if (!order.shippingLabelUrl || !isCarrierTrackingNumber(order.trackingNumber)) return [];
  return [
    {
      carrier: order.shippingCarrier ?? order.carrier ?? "Carrier",
      trackingNumber: order.trackingNumber,
      labelUrl: order.shippingLabelUrl,
      ...(order.shippingTransactionId !== undefined && { transactionId: order.shippingTransactionId }),
      ...(order.shippingRateId !== undefined && { rateId: order.shippingRateId }),
      ...(order.shippingServiceLevel !== undefined && { serviceLevel: order.shippingServiceLevel }),
      ...(order.shippingCost !== undefined && { cost: order.shippingCost }),
      purchasedAt: order.updatedAt ?? order.createdAt ?? 0,
      reship: false,
    },
  ];
}

/** The history after buying `label`, bounded to the most recent MAX_LABELS. */
export function appendLabel(order: LabelSource, label: ShippingLabel): ShippingLabel[] {
  return [...labelHistory(order), label].slice(-MAX_LABELS);
}

/** When the current (latest) label was bought, if the Order has one. */
export function latestLabelPurchasedAt(order: LabelSource): number | undefined {
  const labels = labelHistory(order);
  return labels.length > 0 ? labels[labels.length - 1].purchasedAt : undefined;
}
