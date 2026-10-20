/**
 * Money back (plan 0008 "Money back", CONTEXT.md Restock / Return / Goodwill Refund / Customer
 * Cancellation): what each kind of refund may refund, how much it costs, and what it may
 * Restock. Every refund is recorded in the `order_refunds` ledger first (status pending), so a
 * line is never refunded beyond its quantity even while a Stripe call is in flight.
 *
 * Amounts are integer cents. A line's refund is its unit price × quantity plus that line's share
 * of the Order's tax; shipping (and its share of tax) is refunded at most once. Tax is shared in
 * proportion to each line's (and shipping's) pre-tax amount, computed cumulatively so partial
 * refunds of one line never add up to more than the line's whole share.
 *
 * Payment Status is never set here: Stripe's `charge.refunded` webhook records it.
 * Pure: no database access; covered by refundModel.test.ts.
 */
import { v, type Infer } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { latestLabelPurchasedAt, type LabelSource } from "../orders/labels";
import { statusAxes, type StatusSource, type Transition } from "../orders/status";

// ── Ledger shapes ────────────────────────────────────────────────────────────

export const REFUND_KINDS = ["line", "return", "goodwill", "cancellation"] as const;
export type RefundKind = (typeof REFUND_KINDS)[number];

export const refundKindValidator = v.union(
  v.literal("line"),
  v.literal("return"),
  v.literal("goodwill"),
  v.literal("cancellation")
);

/** pending: reserved, Stripe not confirmed yet · issued: Stripe accepted it · failed: Stripe refused it. */
export const refundStatusValidator = v.union(v.literal("pending"), v.literal("issued"), v.literal("failed"));
export type RefundStatus = Infer<typeof refundStatusValidator>;

/** Why a Customer returned items. Only "unwanted" makes the Customer pay return shipping. */
export const RETURN_REASONS = ["unwanted", "defective", "wrong_item"] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];
export const returnReasonValidator = v.union(v.literal("unwanted"), v.literal("defective"), v.literal("wrong_item"));

export const refundLineValidator = v.object({
  lineIndex: v.number(),
  quantity: v.number(),
  amountCents: v.number(),
  restock: v.boolean(),
});
export type RefundLine = Infer<typeof refundLineValidator>;

/** What the action needs to call Stripe for a reserved refund. */
export const reservationValidator = v.object({
  refundId: v.id("order_refunds"),
  orderNumber: v.string(),
  kind: refundKindValidator,
  stripeSessionId: v.string(),
  amountCents: v.number(),
  idempotencyKey: v.string(),
  status: v.union(v.literal("pending"), v.literal("issued")),
});
export type Reservation = Infer<typeof reservationValidator>;

const lineRequestValidator = v.object({ lineIndex: v.number(), quantity: v.number(), restock: v.boolean() });

/** The three refunds an Administrator starts from the order page. */
export const adminRefundRequestValidator = v.union(
  v.object({ kind: v.literal("line"), lines: v.array(lineRequestValidator), includeShipping: v.boolean() }),
  v.object({
    kind: v.literal("return"),
    lines: v.array(lineRequestValidator),
    reason: returnReasonValidator,
    unwornWithTags: v.boolean(),
  }),
  v.object({ kind: v.literal("goodwill"), amountCents: v.number(), reason: v.string() })
);

/** The ledger fields the rules read. */
export type LedgerEntry = {
  kind: RefundKind;
  status: RefundStatus;
  lines: RefundLine[];
  shippingCents: number;
  amountCents: number;
};

/** What an Administrator asks for one line: how many units, and whether to Restock them. */
export type LineRequest = { lineIndex: number; quantity: number; restock: boolean };

/** A refund the rules accepted, ready to reserve in the ledger. */
export type RefundPlan = {
  kind: RefundKind;
  lines: RefundLine[];
  shippingCents: number;
  amountCents: number;
};

export type RefundableOrder = StatusSource &
  Pick<Doc<"orders">, "items" | "total"> &
  Partial<Pick<Doc<"orders">, "subtotal" | "shippingFee" | "tax" | "refundedAmount" | "stripeSessionId" | "trackingDeliveredAt">> &
  LabelSource;

// ── Money ────────────────────────────────────────────────────────────────────

export const toCents = (amount: number | undefined): number => Math.round((amount ?? 0) * 100);

/** "$12.34" for cents. */
export const formatCents = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

/** The Order's figures in cents. Subtotal falls back to the sum of its lines (older Orders). */
export function orderCents(order: RefundableOrder) {
  const unitCents = order.items.map((item) => toCents(item.price));
  const linesCents = order.items.reduce((sum, item, i) => sum + unitCents[i] * item.quantity, 0);
  const subtotalCents = order.subtotal !== undefined ? toCents(order.subtotal) : linesCents;
  const shippingCents = toCents(order.shippingFee);
  return {
    unitCents,
    subtotalCents,
    shippingCents,
    taxCents: toCents(order.tax),
    totalCents: toCents(order.total),
    /** Pre-tax amount the tax is shared across: lines plus shipping. */
    taxBaseCents: subtotalCents + shippingCents,
  };
}

/** Tax share of a pre-tax amount, rounded to the cent. */
function taxShare(order: RefundableOrder, preTaxCents: number): number {
  const { taxCents, taxBaseCents } = orderCents(order);
  if (taxCents <= 0 || taxBaseCents <= 0) return 0;
  return Math.round((taxCents * preTaxCents) / taxBaseCents);
}

/**
 * Refund for `quantity` more units of a line when `alreadyRefunded` units of it were refunded
 * before: price × quantity plus the tax share of those units. Cumulative, so the parts of a
 * line refunded one by one add up exactly to the whole line.
 */
export function lineRefundCents(
  order: RefundableOrder,
  lineIndex: number,
  quantity: number,
  alreadyRefunded = 0
): number {
  const unit = orderCents(order).unitCents[lineIndex];
  const taxUpTo = (units: number) => taxShare(order, unit * units);
  return unit * quantity + taxUpTo(alreadyRefunded + quantity) - taxUpTo(alreadyRefunded);
}

/** Shipping refund: the fee plus its share of tax. */
export function shippingRefundCents(order: RefundableOrder): number {
  const { shippingCents } = orderCents(order);
  return shippingCents + taxShare(order, shippingCents);
}

// ── Reading the ledger ───────────────────────────────────────────────────────

/** Entries that count: issued, and pending ones still in flight. A failed refund frees what it reserved. */
export function activeEntries(ledger: LedgerEntry[]): LedgerEntry[] {
  return ledger.filter((entry) => entry.status !== "failed");
}

/** Units already refunded (or being refunded) per line index. */
export function refundedQuantities(order: RefundableOrder, ledger: LedgerEntry[]): number[] {
  const refunded = order.items.map(() => 0);
  for (const entry of activeEntries(ledger)) {
    for (const line of entry.lines) {
      if (line.lineIndex >= 0 && line.lineIndex < refunded.length) refunded[line.lineIndex] += line.quantity;
    }
  }
  return refunded;
}

/**
 * The Order's lines with only the units a cancellation still has to give back: units a refund
 * already Restocked (issued) are back in stock. A refund still pending is never restocked once
 * the Order is cancelled (refundLedger.ts commitRefund), so its units go back with the cancellation.
 */
export function cancellationReleaseLines<T extends { quantity: number }>(
  order: { items: T[] },
  ledger: LedgerEntry[]
): T[] {
  const restocked = order.items.map(() => 0);
  for (const entry of ledger) {
    if (entry.status !== "issued") continue;
    for (const line of entry.lines) {
      if (line.restock && line.lineIndex >= 0 && line.lineIndex < restocked.length) restocked[line.lineIndex] += line.quantity;
    }
  }
  return order.items.flatMap((item, i) => {
    const quantity = item.quantity - restocked[i];
    return quantity > 0 ? [{ ...item, quantity }] : [];
  });
}

export function shippingRefunded(ledger: LedgerEntry[]): boolean {
  return activeEntries(ledger).some((entry) => entry.shippingCents > 0);
}

/**
 * Cents still refundable. Refunds made in the Stripe Dashboard reach `refundedAmount` through
 * the webhook but not the ledger; ledger refunds reach `refundedAmount` only once the webhook
 * lands. The larger of the two is what is certainly gone; Stripe refuses anything beyond the charge.
 */
export function remainingRefundableCents(order: RefundableOrder, ledger: LedgerEntry[]): number {
  const ledgerCents = activeEntries(ledger).reduce((sum, entry) => sum + entry.amountCents, 0);
  const refunded = Math.max(ledgerCents, toCents(order.refundedAmount));
  return Math.max(0, toCents(order.total) - refunded);
}

// ── Gates ────────────────────────────────────────────────────────────────────

/** Money can go back only on a settled card payment that is not disputed or already fully refunded. */
export function refundBlock(order: RefundableOrder): string | undefined {
  const { paymentStatus } = statusAxes(order);
  if (paymentStatus === "awaiting_payment") return "Order is not paid: there is nothing to refund.";
  if (paymentStatus === "refunded") return "Order is already fully refunded.";
  if (paymentStatus === "disputed") return "Payment is disputed: Stripe does not allow refunds until the dispute closes.";
  if (!order.stripeSessionId) return "Order has no Stripe payment to refund.";
  return undefined;
}

/**
 * Units may be Restocked unless the Order was cancelled: a cancellation already gave back the
 * units of an Order that had not shipped, so restocking again would count them twice.
 */
export function restockBlock(order: RefundableOrder): string | undefined {
  return statusAxes(order).cancelledAt !== undefined
    ? "Order is cancelled: its units were already handled when it was cancelled."
    : undefined;
}

// ── Planners ─────────────────────────────────────────────────────────────────

type LinePlanOptions = { kind: "line" | "return"; includeShipping: boolean; restockForbidden?: string };

function planLines(
  order: RefundableOrder,
  ledger: LedgerEntry[],
  requests: LineRequest[],
  options: LinePlanOptions
): Transition<{ plan: RefundPlan }> {
  const block = refundBlock(order);
  if (block) return { ok: false, error: block };
  if (requests.length === 0 && !options.includeShipping) return { ok: false, error: "Choose at least one line to refund." };

  const refunded = refundedQuantities(order, ledger);
  const seen = new Set<number>();
  const lines: RefundLine[] = [];
  for (const request of requests) {
    const item = order.items[request.lineIndex];
    if (!Number.isInteger(request.lineIndex) || !item) return { ok: false, error: `Line ${request.lineIndex + 1} does not exist.` };
    if (seen.has(request.lineIndex)) return { ok: false, error: `Line ${request.lineIndex + 1} is listed twice.` };
    seen.add(request.lineIndex);
    if (!Number.isInteger(request.quantity) || request.quantity < 1) {
      return { ok: false, error: `Quantity for ${item.name} must be a whole number of at least 1.` };
    }
    const left = item.quantity - refunded[request.lineIndex];
    if (request.quantity > left) {
      return { ok: false, error: `Only ${left} of ${item.name} left to refund (${item.quantity} bought).` };
    }
    if (request.restock) {
      const noRestock = options.restockForbidden ?? restockBlock(order);
      if (noRestock) return { ok: false, error: noRestock };
    }
    lines.push({
      lineIndex: request.lineIndex,
      quantity: request.quantity,
      amountCents: lineRefundCents(order, request.lineIndex, request.quantity, refunded[request.lineIndex]),
      restock: request.restock,
    });
  }

  let shippingCents = 0;
  if (options.includeShipping) {
    if (orderCents(order).shippingCents <= 0) return { ok: false, error: "Order had no shipping fee to refund." };
    if (shippingRefunded(ledger)) return { ok: false, error: "Shipping was already refunded." };
    shippingCents = shippingRefundCents(order);
  }

  const requested = lines.reduce((sum, line) => sum + line.amountCents, 0) + shippingCents;
  const remaining = remainingRefundableCents(order, ledger);
  if (remaining <= 0) return { ok: false, error: "Nothing is left to refund on this order." };
  // Rounding can put a whole-order refund a cent over what was charged; never ask Stripe for more.
  const amountCents = Math.min(requested, remaining);
  return { ok: true, plan: { kind: options.kind, lines, shippingCents, amountCents } };
}

/** An Administrator refunds chosen lines and quantities, optionally with shipping, choosing Restock per line. */
export function planLineRefund(
  order: RefundableOrder,
  ledger: LedgerEntry[],
  request: { lines: LineRequest[]; includeShipping: boolean }
): Transition<{ plan: RefundPlan }> {
  return planLines(order, ledger, request.lines, { kind: "line", includeShipping: request.includeShipping });
}

/** A Goodwill Refund: a free amount outside any line. It never Restocks and never counts against a line. */
export function planGoodwillRefund(
  order: RefundableOrder,
  ledger: LedgerEntry[],
  request: { amountCents: number; reason: string }
): Transition<{ plan: RefundPlan }> {
  const block = refundBlock(order);
  if (block) return { ok: false, error: block };
  if (!request.reason.trim()) return { ok: false, error: "Say why the Goodwill Refund is given." };
  if (!Number.isInteger(request.amountCents) || request.amountCents < 1) {
    return { ok: false, error: "Goodwill amount must be at least $0.01." };
  }
  const remaining = remainingRefundableCents(order, ledger);
  if (request.amountCents > remaining) {
    return { ok: false, error: `Goodwill amount exceeds the ${formatCents(remaining)} left to refund.` };
  }
  return { ok: true, plan: { kind: "goodwill", lines: [], shippingCents: 0, amountCents: request.amountCents } };
}

/**
 * Full refund of whatever is left, for a cancellation: every unrefunded unit, shipping if not
 * refunded yet, and exactly the remaining amount. Lines never Restock here: the cancellation
 * itself gives back the units of an Order that had not shipped.
 */
export function planFullRefund(order: RefundableOrder, ledger: LedgerEntry[]): Transition<{ plan: RefundPlan }> {
  const block = refundBlock(order);
  if (block) return { ok: false, error: block };
  const remaining = remainingRefundableCents(order, ledger);
  if (remaining <= 0) return { ok: false, error: "Nothing is left to refund on this order." };
  const refunded = refundedQuantities(order, ledger);
  const lines = order.items.flatMap((item, lineIndex): RefundLine[] => {
    const quantity = item.quantity - refunded[lineIndex];
    if (quantity <= 0) return [];
    return [{ lineIndex, quantity, amountCents: lineRefundCents(order, lineIndex, quantity, refunded[lineIndex]), restock: false }];
  });
  const shippingCents = orderCents(order).shippingCents > 0 && !shippingRefunded(ledger) ? shippingRefundCents(order) : 0;
  return { ok: true, plan: { kind: "cancellation", lines, shippingCents, amountCents: remaining } };
}

// ── Returns ──────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;
export const RETURN_WINDOW_DAYS = 30;
/** With no delivered scan, delivery is assumed this many days after the label was bought. */
export const ASSUMED_TRANSIT_DAYS = 7;

/**
 * When the Return window closes: 30 days from the delivered date, or, with no delivered scan,
 * from the latest label's date + 7 days. Undefined when the Order never shipped.
 */
export function returnWindowClosesAt(
  order: RefundableOrder
): number | undefined {
  const labelAt = latestLabelPurchasedAt(order);
  const deliveredAt = order.trackingDeliveredAt ?? (labelAt !== undefined ? labelAt + ASSUMED_TRANSIT_DAYS * DAY_MS : undefined);
  return deliveredAt !== undefined ? deliveredAt + RETURN_WINDOW_DAYS * DAY_MS : undefined;
}

/** The Customer pays return shipping unless the item is defective or wrong. */
export function customerPaysReturnShipping(reason: ReturnReason): boolean {
  return reason === "unwanted";
}

export type ReturnRequest = {
  lines: LineRequest[];
  reason: ReturnReason;
  /** The Administrator inspected the items: unworn, tags on. */
  unwornWithTags: boolean;
};

/**
 * A Return (CONTEXT.md): the Customer sends back unworn items with tags within the window and
 * the Administrator refunds those lines, choosing Restock per line. The original shipping fee
 * is never refunded. A defective item is unsellable, so it is never Restocked; a change of mind
 * needs the items unworn with tags. A package the carrier returned to sender is not a Return:
 * refund or Reship it instead.
 */
export function planReturn(
  order: RefundableOrder,
  ledger: LedgerEntry[],
  request: ReturnRequest,
  nowMs: number
): Transition<{ plan: RefundPlan }> {
  const { fulfillmentStatus } = statusAxes(order);
  if (fulfillmentStatus === "unfulfilled") return { ok: false, error: "Order never shipped: refund or cancel it instead." };
  if (fulfillmentStatus === "returned" || fulfillmentStatus === "delivery_exception") {
    return { ok: false, error: "The carrier could not deliver this order: Reship or refund it instead of recording a Return." };
  }
  const closesAt = returnWindowClosesAt(order);
  if (closesAt === undefined) return { ok: false, error: "Order has no label or delivery date to start the Return window." };
  if (nowMs > closesAt) {
    return { ok: false, error: `The ${RETURN_WINDOW_DAYS}-day Return window closed on ${new Date(closesAt).toISOString().slice(0, 10)}.` };
  }
  if (request.reason === "unwanted" && !request.unwornWithTags) {
    return { ok: false, error: "A Return needs the items unworn with tags." };
  }
  if (request.lines.length === 0) return { ok: false, error: "Choose at least one returned line." };
  return planLines(order, ledger, request.lines, {
    kind: "return",
    includeShipping: false,
    restockForbidden: request.reason === "defective" ? "A defective item is unsellable: it is never restocked." : undefined,
  });
}

// ── Stripe ───────────────────────────────────────────────────────────────────

/**
 * Stripe idempotency key for a ledger entry, from its Order and request id: a retried or
 * double-submitted request sends the same key, so Stripe never refunds it twice.
 */
export function refundIdempotencyKey(orderId: string, requestId: string): string {
  return `goodluck-refund-${orderId}-${requestId}`;
}

/** Request id of an Order's cancellation refund: an Order is cancelled once, so it is fixed. */
export function cancellationRequestId(orderId: string): string {
  return `cancel-${orderId}`;
}

/**
 * What a Stripe error means for a pending refund. Errors Stripe raises before doing anything
 * (bad request, auth, card) are final: the entry fails and frees its lines. Anything else
 * (network, Stripe outage, rate limit) may or may not have refunded: the entry stays pending
 * and is retried with the same idempotency key.
 */
export function refundErrorOutcome(stripeErrorType: string | undefined): "failed" | "retry" {
  switch (stripeErrorType) {
    case "StripeCardError":
    case "StripeInvalidRequestError":
    case "StripeAuthenticationError":
    case "StripePermissionError":
    case "StripeIdempotencyError":
      return "failed";
    default:
      return "retry";
  }
}

/** One line of audit text for a ledger entry. */
export function describeRefund(
  order: Pick<Doc<"orders">, "items">,
  plan: Pick<RefundPlan, "kind" | "lines" | "shippingCents" | "amountCents">
): string {
  const parts = plan.lines.map(
    (line) => `${line.quantity}× ${order.items[line.lineIndex]?.name ?? `line ${line.lineIndex + 1}`}${line.restock ? " (restock)" : ""}`
  );
  if (plan.shippingCents > 0) parts.push("shipping");
  const what = parts.length > 0 ? `: ${parts.join(", ")}` : "";
  return `${plan.kind} refund ${formatCents(plan.amountCents)}${what}`;
}
