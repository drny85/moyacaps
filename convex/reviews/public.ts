/** Storefront review reads (ADR 0028): Published, unhidden reviews only; never author identity. */
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { query } from "../_generated/server";
import { cardRating, roundedAverage } from "./model";
import { publicReviewValidator, ratingSummaryValidator } from "./validators";

/** Most variants whose stats are scanned for product-card ratings. */
const MAX_CARD_RATING_ROWS = 500;

export const getProductReviews = query({
  args: { variantId: v.string(), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(publicReviewValidator),
  handler: async (ctx, args) => {
    const result = await ctx.db
      .query("product_reviews")
      .withIndex("by_variantId_and_status_and_publishedAt", (q) =>
        q.eq("variantId", args.variantId).eq("status", "published")
      )
      .order("desc")
      .paginate(args.paginationOpts);
    // A page may come back short when hidden rows are dropped; the client keeps paging.
    const page = result.page.flatMap((r) =>
      r.hiddenAt !== undefined || r.publishedAt === undefined
        ? []
        : [
            {
              _id: r._id,
              _creationTime: r._creationTime,
              variantId: r.variantId,
              rating: r.rating,
              title: r.title,
              body: r.body,
              locale: r.locale,
              displayName: r.displayName,
              boughtColorway: r.boughtColorway,
              boughtSize: r.boughtSize,
              publishedAt: r.publishedAt,
            },
          ]
    );
    return { ...result, page };
  },
});

export const getRatingSummary = query({
  args: { variantId: v.string() },
  returns: v.union(ratingSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    const stats = await ctx.db
      .query("product_review_stats")
      .withIndex("by_variantId", (q) => q.eq("variantId", args.variantId))
      .unique();
    if (!stats || stats.count <= 0) return null;
    return { average: roundedAverage(stats), count: stats.count };
  },
});

export const getCardRatings = query({
  args: {},
  returns: v.record(v.string(), ratingSummaryValidator),
  handler: async (ctx) => {
    const rows = await ctx.db.query("product_review_stats").take(MAX_CARD_RATING_ROWS);
    const ratings: Record<string, { average: number; count: number }> = {};
    for (const row of rows) {
      const rating = cardRating(row);
      if (rating) ratings[row.variantId] = rating;
    }
    return ratings;
  },
});
