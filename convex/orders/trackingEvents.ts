/**
 * Stored carrier scans (CONTEXT.md "Order Timeline"): every Shippo tracking update for an Order,
 * deduped against the latest one and capped per Order. Rules live in ./timeline.ts.
 */
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { MAX_TRACKING_EVENTS, isDuplicateScan, type TrackingScan } from "./timeline";

/** The Order's stored scans, oldest first, at most MAX_TRACKING_EVENTS. */
export async function listTrackingScans(ctx: QueryCtx, orderId: Id<"orders">): Promise<TrackingScan[]> {
  const rows = await ctx.db
    .query("tracking_events")
    .withIndex("by_orderId_and_receivedAt", (q) => q.eq("orderId", orderId))
    .order("desc")
    .take(MAX_TRACKING_EVENTS);
  return rows.reverse().map(({ _id, _creationTime, orderId: _order, ...scan }) => scan);
}

/** Stores a scan unless it repeats the latest one, then drops the oldest beyond the cap. */
export async function recordTrackingScan(
  ctx: MutationCtx,
  orderId: Id<"orders">,
  scan: Omit<TrackingScan, "receivedAt">
): Promise<void> {
  const recent = await ctx.db
    .query("tracking_events")
    .withIndex("by_orderId_and_receivedAt", (q) => q.eq("orderId", orderId))
    .order("desc")
    .take(MAX_TRACKING_EVENTS);
  if (isDuplicateScan(recent[0], scan)) return;
  await ctx.db.insert("tracking_events", { orderId, ...scan, receivedAt: Date.now() });
  // One insert at a time keeps the table at most one over the cap: drop the oldest.
  if (recent.length >= MAX_TRACKING_EVENTS) await ctx.db.delete(recent[recent.length - 1]._id);
}
