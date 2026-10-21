/// <reference types="vite/client" />
/** Admin moderation + public reads (ADR 0028): publish/reject keep stats in step, secrets never leak. */
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");
const t = () => convexTest(schema, modules);
type TT = ReturnType<typeof t>;

const asAdmin = (tt: TT) => tt.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });
const asUser = (tt: TT, subject: string) => tt.withIdentity({ subject });

/** One delivered Order for `subject` containing `variantId`. */
async function seedOrder(tt: TT, subject: string, variantId: string, n: number): Promise<Id<"orders">> {
  return await tt.run(async (ctx) =>
    ctx.db.insert("orders", {
      orderNumber: `GL-${n}`,
      clerkUserId: subject,
      items: [{ variantId, quantity: 1, name: "Cap", price: 50, image: "/img.png", colorway: "Black", size: "M" }],
      currency: "USD",
      subtotal: 50,
      shippingFee: 0,
      total: 50,
      paymentStatus: "paid",
      fulfillmentStatus: "delivered",
      paymentMethod: "stripe",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
  );
}

async function review(tt: TT, subject: string, variantId: string, rating = 5, n = 1) {
  await seedOrder(tt, subject, variantId, n);
  return await asUser(tt, subject).mutation(api.reviews.customer.submitReview, {
    variantId,
    rating,
    locale: "en",
    title: "Great",
  });
}

const ADMIN_PAGE = { numItems: 20, cursor: null };

describe("moderation", () => {
  it("non-admin cannot publish", async () => {
    const tt = t();
    const id = await review(tt, "u1", "V1");
    await expect(asUser(tt, "u1").mutation(api.reviews.admin.publishReview, { reviewId: id })).rejects.toThrow();
    await expect(tt.mutation(api.reviews.admin.publishReview, { reviewId: id })).rejects.toThrow();
  });

  it("publish -> getRatingSummary average 5 count 1", async () => {
    const tt = t();
    const id = await review(tt, "u1", "V1");
    await asAdmin(tt).mutation(api.reviews.admin.publishReview, { reviewId: id });
    expect(await tt.query(api.reviews.public.getRatingSummary, { variantId: "V1" })).toEqual({ average: 5, count: 1 });
  });

  it("rejects publishing an already published or hidden review", async () => {
    const tt = t();
    const id = await review(tt, "u1", "V1");
    const admin = asAdmin(tt);
    await admin.mutation(api.reviews.admin.publishReview, { reviewId: id });
    await expect(admin.mutation(api.reviews.admin.publishReview, { reviewId: id })).rejects.toThrow();
    await admin.mutation(api.reviews.admin.rejectReview, { reviewId: id });
    await tt.run(async (ctx) => ctx.db.patch(id, { hiddenAt: Date.now() }));
    await expect(admin.mutation(api.reviews.admin.publishReview, { reviewId: id })).rejects.toThrow(/hidden/i);
  });

  it("reject published with reason -> summary null and reason visible to the author", async () => {
    const tt = t();
    const id = await review(tt, "u1", "V1");
    const admin = asAdmin(tt);
    await admin.mutation(api.reviews.admin.publishReview, { reviewId: id });
    await admin.mutation(api.reviews.admin.rejectReview, { reviewId: id, reason: "  Off topic  " });
    expect(await tt.query(api.reviews.public.getRatingSummary, { variantId: "V1" })).toBeNull();
    const state = await asUser(tt, "u1").query(api.reviews.customer.getMyReviewState, { variantId: "V1" });
    expect(state.review).toMatchObject({ status: "rejected", rejectReason: "Off topic" });
    expect(state.review?.publishedAt).toBeUndefined();
  });

  it("blank reason is dropped and an over-long reason is refused", async () => {
    const tt = t();
    const id = await review(tt, "u1", "V1");
    const admin = asAdmin(tt);
    await expect(
      admin.mutation(api.reviews.admin.rejectReview, { reviewId: id, reason: "x".repeat(301) })
    ).rejects.toThrow();
    await admin.mutation(api.reviews.admin.rejectReview, { reviewId: id, reason: "   " });
    const state = await asUser(tt, "u1").query(api.reviews.customer.getMyReviewState, { variantId: "V1" });
    expect(state.review?.rejectReason).toBeUndefined();
  });

  it("a rejected review can be published again", async () => {
    const tt = t();
    const id = await review(tt, "u1", "V1", 4);
    const admin = asAdmin(tt);
    await admin.mutation(api.reviews.admin.rejectReview, { reviewId: id, reason: "no" });
    await admin.mutation(api.reviews.admin.publishReview, { reviewId: id });
    expect(await tt.query(api.reviews.public.getRatingSummary, { variantId: "V1" })).toEqual({ average: 4, count: 1 });
    const state = await asUser(tt, "u1").query(api.reviews.customer.getMyReviewState, { variantId: "V1" });
    expect(state.review?.rejectReason).toBeUndefined();
  });

  it("edit after publish is not counted twice", async () => {
    const tt = t();
    const id = await review(tt, "u1", "V1", 5);
    await asAdmin(tt).mutation(api.reviews.admin.publishReview, { reviewId: id });
    await asUser(tt, "u1").mutation(api.reviews.customer.submitReview, { variantId: "V1", rating: 3, locale: "en" });
    expect(await tt.query(api.reviews.public.getRatingSummary, { variantId: "V1" })).toBeNull();
    await asAdmin(tt).mutation(api.reviews.admin.publishReview, { reviewId: id });
    const stats = await tt.run(async (ctx) => ctx.db.query("product_review_stats").collect());
    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({ count: 1, ratingSum: 3 });
  });
});

describe("admin queue", () => {
  it("lists by status with product name joined and counts pending", async () => {
    const tt = t();
    await tt.run(async (ctx) => {
      await ctx.db.insert("variants", {
        variantId: "V1",
        isAvailable: true,
        nameEn: "Black Snapback",
        nameEs: "Gorra Negra",
        silhouette: "snapback",
        primaryHex: "#000",
        secondaryHex: "#000",
        image: "/a.png",
        stock: 1,
        priceUsd: 50,
        isFeatured: false,
      });
    });
    await review(tt, "u1", "V1", 5, 1);
    await review(tt, "u2", "NO_VARIANT", 4, 2);
    const admin = asAdmin(tt);
    const page = await admin.query(api.reviews.admin.listReviewsAdmin, { status: "pending", paginationOpts: ADMIN_PAGE });
    expect(page.page.map((r) => r.productName).sort()).toEqual(["Black Snapback", "NO_VARIANT"]);
    expect(await admin.query(api.reviews.admin.getPendingReviewCount, {})).toBe(2);
    expect(
      (await admin.query(api.reviews.admin.listReviewsAdmin, { status: "published", paginationOpts: ADMIN_PAGE })).page
    ).toHaveLength(0);
    await expect(tt.query(api.reviews.admin.getPendingReviewCount, {})).rejects.toThrow();
    await expect(
      asUser(tt, "u1").query(api.reviews.admin.listReviewsAdmin, { status: "pending", paginationOpts: ADMIN_PAGE })
    ).rejects.toThrow();
  });
});
