/**
 * Validators for Product Reviews (ADR 0028). Standalone (no schema import) because the schema
 * itself reuses `reviewStatusValidator`; the three row shapes mirror who may see which fields.
 */
import { v, type Infer } from "convex/values";

/** Must match `ReviewStatus` in ./model. */
export const reviewStatusValidator = v.union(v.literal("pending"), v.literal("published"), v.literal("rejected"));

export const reviewLocaleValidator = v.union(v.literal("en"), v.literal("es"));

/** What a storefront visitor sees: no author identity, Order link, or moderation fields. */
export const publicReviewValidator = v.object({
  _id: v.id("product_reviews"),
  _creationTime: v.number(),
  variantId: v.string(),
  rating: v.number(),
  title: v.optional(v.string()),
  body: v.optional(v.string()),
  locale: reviewLocaleValidator,
  displayName: v.string(),
  boughtColorway: v.optional(v.string()),
  boughtSize: v.optional(v.string()),
  publishedAt: v.number(),
});

export type PublicReview = Infer<typeof publicReviewValidator>;

/** What an author sees about their own review. */
export const myReviewValidator = v.object({
  _id: v.id("product_reviews"),
  _creationTime: v.number(),
  variantId: v.string(),
  rating: v.number(),
  title: v.optional(v.string()),
  body: v.optional(v.string()),
  locale: reviewLocaleValidator,
  displayName: v.string(),
  boughtColorway: v.optional(v.string()),
  boughtSize: v.optional(v.string()),
  publishedAt: v.optional(v.number()),
  status: reviewStatusValidator,
  rejectReason: v.optional(v.string()),
  createdAt: v.number(),
  updatedAt: v.number(),
});

/** Full row for the admin moderation queue, plus the joined Product name. */
export const adminReviewValidator = v.object({
  _id: v.id("product_reviews"),
  _creationTime: v.number(),
  variantId: v.string(),
  clerkUserId: v.string(),
  orderId: v.id("orders"),
  rating: v.number(),
  title: v.optional(v.string()),
  body: v.optional(v.string()),
  locale: reviewLocaleValidator,
  displayName: v.string(),
  boughtColorway: v.optional(v.string()),
  boughtSize: v.optional(v.string()),
  status: reviewStatusValidator,
  rejectReason: v.optional(v.string()),
  hiddenAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  publishedAt: v.optional(v.number()),
  productName: v.string(),
});

export const ratingSummaryValidator = v.object({ average: v.number(), count: v.number() });
