/**
 * A refund Stripe accepted and later failed or canceled (plan 0008 "Money back", ADR 0025):
 * Stripe's `refund.failed` and `refund.updated` webhooks. The ledger row turns failed, which
 * frees its lines, and the Order gets a `refund_failed` payment event and an adminNotes line.
 *
 * Stock is never reversed here. A Restock done when the refund was issued stays; the note asks
 * the Administrator to check stock before refunding those units again. Payment Status is never
 * set here either: it still comes only from `charge.refunded`.
 *
 * Pure: no database access; covered by refundFailureModel.test.ts.
 */
import type Stripe from "stripe";
import type { Doc } from "../_generated/dataModel";
import { formatCents } from "./refundModel";

/** The Stripe refund statuses that mean the money did not go back. */
export type StripeRefundFailureStatus = "failed" | "canceled";

/** What the webhook passes on from a failed or canceled Stripe refund. */
export type StripeRefundFailure = {
  stripeRefundId: string;
  /** Ledger row id from the refund's metadata (refunds.ts sets it), when present. */
  ledgerRefundId?: string;
  stripeStatus: StripeRefundFailureStatus;
  failureReason?: string;
};

/**
 * The failure a `refund.failed` / `refund.updated` event reports, or null when the refund did
 * not fail (a `refund.updated` for any other status, or another event type).
 */
export function refundFailureFromEvent(
  type: string,
  refund: Pick<Stripe.Refund, "id" | "status" | "failure_reason" | "metadata">
): StripeRefundFailure | null {
  if (type !== "refund.failed" && type !== "refund.updated") return null;
  const status = type === "refund.failed" ? "failed" : refund.status;
  if (status !== "failed" && status !== "canceled") return null;
  const ledgerRefundId = refund.metadata?.refundId;
  return {
    stripeRefundId: refund.id,
    ...(ledgerRefundId && { ledgerRefundId }),
    stripeStatus: status,
    ...(refund.failure_reason && { failureReason: refund.failure_reason }),
  };
}

export type FailingRefundRow = Pick<
  Doc<"order_refunds">,
  "kind" | "status" | "lines" | "amountCents" | "stripeRefundId"
>;

export type RefundFailureDecision =
  | {
      action: "ignore";
      /** unknown_refund: not in the ledger (e.g. made in the Stripe Dashboard) · replayed: this event was already recorded · already_failed: another event already failed the row. */
      reason: "unknown_refund" | "replayed" | "already_failed";
    }
  | {
      action: "fail";
      /** The row's error. */
      error: string;
      /** Units Restocked when the refund was issued. Never reversed here. */
      restockedUnits: number;
      /** The `refund_failed` payment event's details. */
      details: string;
      /** The line appended to the Order's adminNotes. */
      note: string;
    };

/** Units a refund Restocked when it was issued (0 while it is still pending). */
export function restockedUnits(row: Pick<FailingRefundRow, "status" | "lines">): number {
  if (row.status !== "issued") return 0;
  return row.lines.reduce((sum, line) => sum + (line.restock ? line.quantity : 0), 0);
}

/**
 * What to do when Stripe reports a refund failed or canceled. Replay-safe on the event id
 * (`eventAlreadyRecorded`), and a second event for the same refund (Stripe sends both
 * `refund.updated` and `refund.failed`) does nothing once the row is failed.
 */
export function decideRefundFailure(input: {
  row: FailingRefundRow | null;
  failure: StripeRefundFailure;
  eventAlreadyRecorded: boolean;
}): RefundFailureDecision {
  const { row, failure } = input;
  if (input.eventAlreadyRecorded) return { action: "ignore", reason: "replayed" };
  if (!row) return { action: "ignore", reason: "unknown_refund" };
  if (row.status === "failed") return { action: "ignore", reason: "already_failed" };

  const why = failure.failureReason ?? (failure.stripeStatus === "canceled" ? "canceled" : "no reason given");
  const error = `Stripe ${failure.stripeStatus} the refund after accepting it: ${why}`;
  const units = restockedUnits(row);
  const what = `${row.kind} refund ${formatCents(row.amountCents)} (Stripe ${failure.stripeRefundId})`;
  const stockAdvice =
    units > 0
      ? ` ${units} unit(s) were restocked when it was issued and stay in stock: check stock before refunding them again.`
      : "";
  return {
    action: "fail",
    error,
    restockedUnits: units,
    details: `${what} ${failure.stripeStatus}: ${why}${units > 0 ? `; ${units} restocked unit(s) left in stock` : ""}`,
    note: `⚠️ REFUND ${failure.stripeStatus.toUpperCase()}: ${what} — ${why}. The Customer did not get this money back; refund again or contact them.${stockAdvice}`,
  };
}
