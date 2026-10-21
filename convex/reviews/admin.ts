/** Administrator review moderation (ADR 0028): publish, reject, and the moderation queue. */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireAdmin } from "../lib/auth";
import { REJECT_REASON_MAX } from "./model";
import { applyStatsChange } from "./shared";
import { adminReviewValidator, reviewStatusValidator } from "./validators";

/** The pending badge never needs an exact count above this. */
const PENDING_COUNT_CAP = 100;

export const listReviewsAdmin = query({
  args: { status: reviewStatusValidator, paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(adminReviewValidator),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const result = await ctx.db
      .query("product_reviews")
      .withIndex("by_status_and_updatedAt", (q) => q.eq("status", args.status))
      .order("desc")
      .paginate(args.paginationOpts);
    const names = new Map<string, string>();
    for (const variantId of new Set(result.page.map((r) => r.variantId))) {
      const variant = await ctx.db
        .query("variants")
        .withIndex("by_variantId", (q) => q.eq("variantId", variantId))
        .unique();
      names.set(variantId, variant?.nameEn ?? variantId);
    }
    return { ...result, page: result.page.map((r) => ({ ...r, productName: names.get(r.variantId) ?? r.variantId })) };
  },
});

export const getPendingReviewCount = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("product_reviews")
      .withIndex("by_status_and_updatedAt", (q) => q.eq("status", "pending"))
      .take(PENDING_COUNT_CAP);
    return rows.length;
  },
});

export const publishReview = mutation({
  args: { reviewId: v.id("product_reviews") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const prev = await ctx.db.get(args.reviewId);
    if (!prev) throw new ConvexError("Review not found.");
    if (prev.hiddenAt !== undefined) throw new ConvexError("This review is hidden and cannot be published.");
    if (prev.status === "published") throw new ConvexError("This review is already published.");
    await ctx.db.patch(prev._id, {
      status: "published",
      publishedAt: Date.now(),
      rejectReason: undefined,
      updatedAt: Date.now(),
    });
    await applyStatsChange(ctx, prev.variantId, prev, await ctx.db.get(prev._id));
    return null;
  },
});

export const rejectReview = mutation({
  args: { reviewId: v.id("product_reviews"), reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const reason = args.reason?.trim() || undefined;
    if (reason && reason.length > REJECT_REASON_MAX) {
      throw new ConvexError(`Reason must be at most ${REJECT_REASON_MAX} characters.`);
    }
    const prev = await ctx.db.get(args.reviewId);
    if (!prev) throw new ConvexError("Review not found.");
    if (prev.status === "rejected") throw new ConvexError("This review is already rejected.");
    await ctx.db.patch(prev._id, {
      status: "rejected",
      rejectReason: reason,
      publishedAt: undefined,
      updatedAt: Date.now(),
    });
    await applyStatsChange(ctx, prev.variantId, prev, await ctx.db.get(prev._id));
    return null;
  },
});
