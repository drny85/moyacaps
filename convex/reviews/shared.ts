/** Shared Product Review mutation helpers (ADR 0028). */
import type { Doc } from "../_generated/dataModel";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { reviewableLines, statsDelta } from "./model";

/** Most recent Orders scanned when looking for something a Customer may review. */
export const MAX_REVIEW_ORDER_SCAN = 200;

export type ReviewDoc = Doc<"product_reviews">;

function counted(doc: ReviewDoc | null) {
  return doc ? { status: doc.status, rating: doc.rating, hidden: doc.hiddenAt !== undefined } : null;
}

/** Applies the change from `prev` to `next` to the variant's stats row, creating it on first use. */
export async function applyStatsChange(
  ctx: MutationCtx,
  variantId: string,
  prev: ReviewDoc | null,
  next: ReviewDoc | null
): Promise<void> {
  const delta = statsDelta(counted(prev), counted(next));
  if (delta.count === 0 && delta.ratingSum === 0) return;
  const row = await ctx.db
    .query("product_review_stats")
    .withIndex("by_variantId", (q) => q.eq("variantId", variantId))
    .unique();
  if (row) {
    await ctx.db.patch(row._id, { count: row.count + delta.count, ratingSum: row.ratingSum + delta.ratingSum });
  } else {
    await ctx.db.insert("product_review_stats", { variantId, ...delta });
  }
}

/**
 * The newest (by creation time) of the Customer's Orders with a reviewable line for `variantId`, or null.
 * Ownership is the Order's `clerkUserId` only; an unclaimed guest Order never qualifies.
 */
export async function findReviewableLine(
  ctx: QueryCtx,
  clerkUserId: string,
  variantId: string
): Promise<{ order: Doc<"orders">; line: { lineIndex: number; colorway?: string; size?: string } } | null> {
  const orders = await ctx.db
    .query("orders")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
    .order("desc")
    .take(MAX_REVIEW_ORDER_SCAN);
  for (const order of orders) {
    if (order.fulfillmentStatus !== "delivered" || order.cancelledAt) continue;
    if (!order.items.some((item) => item.variantId === variantId)) continue;
    const refunds = await loadRefunds(ctx, order._id);
    const [line] = reviewableLines(order, refunds, variantId);
    if (line) return { order, line };
  }
  return null;
}

export async function loadRefunds(ctx: QueryCtx, orderId: Id<"orders">): Promise<Doc<"order_refunds">[]> {
  return await ctx.db
    .query("order_refunds")
    .withIndex("by_orderId", (q) => q.eq("orderId", orderId))
    .take(100);
}

/** Most reviews read per user: a Customer has at most one per Product and the catalog is capped at 500. */
const MAX_REVIEWS_PER_USER = 500;

/**
 * Hides every not-yet-hidden review by a deleted account and takes them out of the stats.
 * One-way: a deleted Clerk user does not come back. Returns how many rows were hidden.
 */
export async function hideReviewsForUser(ctx: MutationCtx, clerkUserId: string, now: number): Promise<number> {
  const reviews = await ctx.db
    .query("product_reviews")
    .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
    .take(MAX_REVIEWS_PER_USER);
  let hidden = 0;
  for (const prev of reviews) {
    if (prev.hiddenAt !== undefined) continue;
    await ctx.db.patch(prev._id, { hiddenAt: now });
    await applyStatsChange(ctx, prev.variantId, prev, { ...prev, hiddenAt: now });
    hidden++;
  }
  return hidden;
}
