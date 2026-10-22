/** Signed-in Customer review functions (ADR 0028): submit/edit, delete, and read own review state. */
import { ConvexError, v } from "convex/values";
import { query } from "../_generated/server";
import { mutation } from "../lib/functions";
import { normalizeReviewInput, REVIEW_ERRORS, reviewableLines, reviewerDisplayName } from "./model";
import { applyStatsChange, findReviewableLine, loadRefunds } from "./shared";
import { myReviewValidator, reviewLocaleValidator } from "./validators";

export const getMyReviewState = query({
  args: { variantId: v.string() },
  returns: v.object({ canReview: v.boolean(), review: v.union(myReviewValidator, v.null()) }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { canReview: false, review: null };
    const [eligible, review] = await Promise.all([
      findReviewableLine(ctx, identity.subject, args.variantId),
      ctx.db
        .query("product_reviews")
        .withIndex("by_clerkUserId_and_variantId", (q) =>
          q.eq("clerkUserId", identity.subject).eq("variantId", args.variantId)
        )
        .unique(),
    ]);
    if (!review) return { canReview: eligible !== null, review: null };
    // Strip the author identity and Order link: the author only sees what myReviewValidator lists.
    const { clerkUserId: _clerkUserId, orderId: _orderId, hiddenAt: _hiddenAt, ...mine } = review;
    return { canReview: eligible !== null, review: mine };
  },
});

export const getMyReviewableItems = query({
  args: { orderId: v.id("orders") },
  returns: v.array(v.object({ variantId: v.string(), lineIndex: v.number(), reviewed: v.boolean() })),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError(REVIEW_ERRORS.signIn);
    const order = await ctx.db.get(args.orderId);
    if (!order || order.clerkUserId !== identity.subject) throw new ConvexError("Order not found.");

    const refunds = await loadRefunds(ctx, order._id);
    const variantIds = [...new Set(order.items.map((item) => item.variantId))];
    const items: { variantId: string; lineIndex: number; reviewed: boolean }[] = [];
    for (const variantId of variantIds) {
      if (!variantId) continue;
      const lines = reviewableLines(order, refunds, variantId);
      if (lines.length === 0) continue;
      const existing = await ctx.db
        .query("product_reviews")
        .withIndex("by_clerkUserId_and_variantId", (q) =>
          q.eq("clerkUserId", identity.subject).eq("variantId", variantId)
        )
        .unique();
      for (const line of lines) items.push({ variantId, lineIndex: line.lineIndex, reviewed: existing !== null });
    }
    return items.sort((a, b) => a.lineIndex - b.lineIndex);
  },
});

export const submitReview = mutation({
  args: {
    variantId: v.string(),
    rating: v.number(),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    locale: reviewLocaleValidator,
  },
  returns: v.id("product_reviews"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError(REVIEW_ERRORS.signIn);
    const clerkUserId = identity.subject;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkUserId))
      .unique();
    if (user?.deletedAt) throw new ConvexError(REVIEW_ERRORS.accountDeleted);

    const input = normalizeReviewInput(args);
    const eligible = await findReviewableLine(ctx, clerkUserId, args.variantId);
    if (!eligible) throw new ConvexError(REVIEW_ERRORS.notEligible);

    const now = Date.now();
    const fields = {
      orderId: eligible.order._id,
      rating: input.rating,
      title: input.title,
      body: input.body,
      locale: args.locale,
      displayName: reviewerDisplayName(user?.name?.trim() || eligible.order.customerName),
      boughtColorway: eligible.line.colorway,
      boughtSize: eligible.line.size,
      status: "pending" as const,
      rejectReason: undefined,
      publishedAt: undefined,
      updatedAt: now,
    };

    const prev = await ctx.db
      .query("product_reviews")
      .withIndex("by_clerkUserId_and_variantId", (q) =>
        q.eq("clerkUserId", clerkUserId).eq("variantId", args.variantId)
      )
      .unique();

    let id;
    if (prev) {
      // patch with undefined removes the field, clearing rejectReason and publishedAt.
      await ctx.db.patch(prev._id, fields);
      id = prev._id;
    } else {
      id = await ctx.db.insert("product_reviews", {
        ...fields,
        variantId: args.variantId,
        clerkUserId,
        createdAt: now,
      });
    }
    const next = await ctx.db.get(id);
    await applyStatsChange(ctx, args.variantId, prev, next);
    return id;
  },
});

export const deleteMyReview = mutation({
  args: { variantId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError(REVIEW_ERRORS.signInToManage);
    const prev = await ctx.db
      .query("product_reviews")
      .withIndex("by_clerkUserId_and_variantId", (q) =>
        q.eq("clerkUserId", identity.subject).eq("variantId", args.variantId)
      )
      .unique();
    if (!prev) return null;
    await ctx.db.delete(prev._id);
    await applyStatsChange(ctx, args.variantId, prev, null);
    return null;
  },
});
