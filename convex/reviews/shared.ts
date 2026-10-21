/** Shared Product Review mutation helpers (ADR 0028). */
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { statsDelta } from "./model";

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
