/// <reference types="vite/client" />
/** Soft-deleting a user hides their reviews and removes them from stats (ADR 0028). */
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");
const t = () => convexTest(schema, modules);
type TT = ReturnType<typeof t>;

const asAdmin = (tt: TT) => tt.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL, emailVerified: true });
const asUser = (tt: TT, subject: string) => tt.withIdentity({ subject });

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

async function review(tt: TT, subject: string, variantId: string, rating: number, n: number) {
  await seedOrder(tt, subject, variantId, n);
  return await asUser(tt, subject).mutation(api.reviews.customer.submitReview, {
    variantId,
    rating,
    locale: "en",
    title: "Great",
  });
}

async function seedUser(tt: TT, clerkId: string) {
  await tt.run(async (ctx) => {
    await ctx.db.insert("users", { clerkId, email: `${clerkId}@x.com`, role: "customer", createdAt: Date.now() });
  });
}

describe("softDeleteUser", () => {
  it("removes the user's published review from summary and list but keeps the row", async () => {
    const tt = t();
    await seedUser(tt, "u1");
    const id = await review(tt, "u1", "V1", 5, 1);
    await asAdmin(tt).mutation(api.reviews.admin.publishReview, { reviewId: id });
    expect(await tt.query(api.reviews.public.getRatingSummary, { variantId: "V1" })).toEqual({ average: 5, count: 1 });

    await tt.mutation(internal.users.functions.softDeleteUser, { clerkId: "u1" });

    expect(await tt.query(api.reviews.public.getRatingSummary, { variantId: "V1" })).toBeNull();
    const page = await tt.query(api.reviews.public.getProductReviews, {
      variantId: "V1",
      paginationOpts: { numItems: 10, cursor: null },
    });
    expect(page.page).toHaveLength(0);
    const row = await tt.run(async (ctx) => ctx.db.get(id));
    expect(row?.hiddenAt).toBeTypeOf("number");
  });

  it("hides a pending review too and leaves stats unchanged by it", async () => {
    const tt = t();
    await seedUser(tt, "u1");
    await seedUser(tt, "u2");
    const other = await review(tt, "u2", "V1", 4, 1);
    await asAdmin(tt).mutation(api.reviews.admin.publishReview, { reviewId: other });
    const pending = await review(tt, "u1", "V1", 1, 2);

    await tt.mutation(internal.users.functions.softDeleteUser, { clerkId: "u1" });

    const row = await tt.run(async (ctx) => ctx.db.get(pending));
    expect(row?.hiddenAt).toBeTypeOf("number");
    // Rejected so it leaves the moderation queue and the pending badge; no reason to show anyone.
    expect(row?.status).toBe("rejected");
    expect(row?.rejectReason).toBeUndefined();
    expect(await asAdmin(tt).query(api.reviews.admin.getPendingReviewCount, {})).toBe(0);
    expect(await tt.query(api.reviews.public.getRatingSummary, { variantId: "V1" })).toEqual({ average: 4, count: 1 });
  });

  it("hides the reviews of an account that never had a users row", async () => {
    const tt = t();
    const id = await review(tt, "u_norow", "V1", 5, 1);
    await asAdmin(tt).mutation(api.reviews.admin.publishReview, { reviewId: id });
    expect(await tt.query(api.reviews.public.getRatingSummary, { variantId: "V1" })).toEqual({ average: 5, count: 1 });

    const result = await tt.mutation(internal.users.functions.softDeleteUser, { clerkId: "u_norow" });

    expect(result).toEqual({ success: false, reason: "User not found" });
    expect(await tt.query(api.reviews.public.getRatingSummary, { variantId: "V1" })).toBeNull();
    expect((await tt.run(async (ctx) => ctx.db.get(id)))?.hiddenAt).toBeTypeOf("number");
  });
});
