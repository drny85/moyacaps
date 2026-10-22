/**
 * Order counts and revenue by status, kept in `@convex-dev/aggregate` so the dashboard reads
 * all-time totals in O(log n) instead of re-reading orders. Every order write updates it
 * through the trigger in lib/functions.ts; analytics/migrations.ts fills it for existing orders.
 */
import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { FULFILLMENT_STATUSES, PAYMENT_STATUSES } from "../orders/status";
import { orderStatsKey, type OrderStatsKey, type StatusCell } from "./model";

export const orderStats = new TableAggregate<{ Key: OrderStatsKey; DataModel: DataModel; TableName: "orders" }>(
  components.orderStats,
  { sortKey: orderStatsKey, sumValue: (order) => order.total }
);

const CELL_KEYS: OrderStatsKey[] = [0, 1].flatMap((cancelled) =>
  PAYMENT_STATUSES.flatMap((paymentStatus) =>
    FULFILLMENT_STATUSES.map((fulfillmentStatus): OrderStatsKey => [cancelled, paymentStatus, fulfillmentStatus])
  )
);

/** Count and revenue of every (cancelled, Payment Status, Fulfillment Status) cell: two batched reads. */
export async function readStatusCells(ctx: QueryCtx): Promise<StatusCell[]> {
  const queries = CELL_KEYS.map((prefix) => ({ bounds: { prefix } }));
  const [counts, sums] = await Promise.all([orderStats.countBatch(ctx, queries), orderStats.sumBatch(ctx, queries)]);
  return CELL_KEYS.map(([cancelled, paymentStatus, fulfillmentStatus], i) => ({
    cancelled: cancelled === 1,
    paymentStatus,
    fulfillmentStatus,
    count: counts[i],
    revenue: sums[i],
  }));
}
