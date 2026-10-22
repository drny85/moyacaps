/**
 * Active drop-alert sign-ups per product, kept in `@convex-dev/aggregate` (security review L6).
 * The public Drop Radar showed each upcoming drop's subscriber count by reading up to 1000
 * `drop_alerts` rows per product, on every view and again on every new sign-up. Every
 * drop_alerts write updates this through the trigger in lib/functions.ts; catalog/migrations.ts
 * fills it for existing rows.
 */
import { TableAggregate } from "@convex-dev/aggregate";
import { components } from "../_generated/api";
import type { DataModel, Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

/** 1 while the sign-up still wants the alert, 0 once unsubscribed. */
export type DropAlertKey = 0 | 1;

export function dropAlertKey(alert: Pick<Doc<"drop_alerts">, "unsubscribedAt">): DropAlertKey {
  return alert.unsubscribedAt === undefined ? 1 : 0;
}

/** Category waitlist rows have no product; they share the "" namespace, which no product reads. */
export function dropAlertNamespace(alert: Pick<Doc<"drop_alerts">, "variantId">): string {
  return alert.variantId ?? "";
}

export const dropAlertStats = new TableAggregate<{
  Namespace: string;
  Key: DropAlertKey;
  DataModel: DataModel;
  TableName: "drop_alerts";
}>(components.dropAlertStats, { namespace: dropAlertNamespace, sortKey: dropAlertKey });

/** Active sign-ups for one product, in O(log n). */
export async function countActiveDropAlerts(ctx: QueryCtx, variantId: string): Promise<number> {
  return await dropAlertStats.count(ctx, {
    namespace: variantId,
    bounds: { lower: { key: 1, inclusive: true }, upper: { key: 1, inclusive: true } },
  });
}
