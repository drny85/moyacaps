/**
 * What a Customer is told about money given back on an Order: any refund (line, Return,
 * Goodwill Refund, cancellation or one made in the Stripe Dashboard) reaches `refundedAmount`
 * through Stripe's `charge.refunded` webhook. The status pill alone says "Refunded" next to an
 * unchanged "Total Paid", so the views also show how much came back and what the Customer
 * paid in the end. Pure; covered by orderRefund.test.ts.
 */

export type RefundSource = { refundedAmount?: number | null; total?: number | null };

/** Amounts in currency units, rounded to the cent. */
export type CustomerRefund = {
  /** Money given back so far. */
  refunded: number;
  /** What the Customer paid after refunds, never below zero. */
  netPaid: number;
};

const toCents = (amount: number | null | undefined): number => Math.round((amount ?? 0) * 100);

/** The refund to show, or null when nothing was refunded. */
export function customerRefund(order: RefundSource): CustomerRefund | null {
  const refundedCents = toCents(order.refundedAmount);
  if (refundedCents <= 0) return null;
  const netCents = Math.max(0, toCents(order.total) - refundedCents);
  return { refunded: refundedCents / 100, netPaid: netCents / 100 };
}
