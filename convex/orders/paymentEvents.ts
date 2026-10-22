/**
 * The append-only `payment_events` log for every money-relevant transition on an Order.
 * Mutations call `insertPaymentEvent` directly, inside their own transaction; actions go
 * through the `orders/functions:recordPaymentEvent` internal mutation that wraps it (L5).
 */
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type PaymentEventInput = {
  orderId: Id<"orders">;
  orderNumber: string;
  type: string;
  stripeEventId?: string;
  stripeSessionId?: string;
  actor?: string;
  details?: string;
};

export async function insertPaymentEvent(ctx: MutationCtx, event: PaymentEventInput) {
  await ctx.db.insert("payment_events", { ...event, createdAt: Date.now() });
}
