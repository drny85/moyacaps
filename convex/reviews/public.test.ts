/// <reference types="vite/client" />
/** Public review reads (ADR 0028): published and unhidden only, no author identity, card threshold. */
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");
const t = () => convexTest(schema, modules);
type TT = ReturnType<typeof t>;
const asAdmin = (tt: TT) => tt.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL });

let n = 0;
async function publishedReview(tt: TT, variantId: string, rating: number, subject = `u${++n}`) {
  await tt.run(async (ctx) =>
    ctx.db.insert("orders", {
      orderNumber: `GL-${++n}`,
      clerkUserId: subject,
      items: [{ variantId, quantity: 1, name: "Cap", price: 50, image: "/img.png" }],
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
  const id = await tt
    .withIdentity({ subject })
    .mutation(api.reviews.customer.submitReview, { variantId, rating, locale: "en", body: "Nice" });
  await asAdmin(tt).mutation(api.reviews.admin.publishReview, { reviewId: id });
  return id;
}

const PAGE = { numItems: 10, cursor: null };

describe("getProductReviews", () => {
  it("never returns clerkUserId, orderId or moderation fields", async () => {
    const tt = t();
    await publishedReview(tt, "V1", 5, "secret_user");
    const { page } = await tt.query(api.reviews.public.getProductReviews, { variantId: "V1", paginationOpts: PAGE });
    expect(page).toHaveLength(1);
    const json = JSON.stringify(page);
    expect(json).not.toContain("secret_user");
    for (const key of ["clerkUserId", "orderId", "hiddenAt", "status", "rejectReason", "updatedAt"]) {
      expect(page[0]).not.toHaveProperty(key);
    }
    expect(page[0]).toMatchObject({ rating: 5, body: "Nice", displayName: "Verified Buyer" });
  });

  it("returns newest published first and skips pending and hidden", async () => {
    const tt = t();
    const first = await publishedReview(tt, "V1", 5);
    await new Promise((r) => setTimeout(r, 5));
    const second = await publishedReview(tt, "V1", 4);
    const hidden = await publishedReview(tt, "V1", 1);
    await tt.run(async (ctx) => ctx.db.patch(hidden, { hiddenAt: Date.now() }));
    const { page } = await tt.query(api.reviews.public.getProductReviews, { variantId: "V1", paginationOpts: PAGE });
    expect(page.map((r) => r._id)).toEqual([second, first]);
  });
});

describe("getRatingSummary / getCardRatings", () => {
  it("summary is null with no reviews", async () => {
    expect(await t().query(api.reviews.public.getRatingSummary, { variantId: "V1" })).toBeNull();
  });

  it("summary rounds to one decimal", async () => {
    const tt = t();
    await publishedReview(tt, "V1", 5);
    await publishedReview(tt, "V1", 4);
    await publishedReview(tt, "V1", 4);
    expect(await tt.query(api.reviews.public.getRatingSummary, { variantId: "V1" })).toEqual({ average: 4.3, count: 3 });
  });

  it("getCardRatings omits a Product with 2 reviews and includes one with 3", async () => {
    const tt = t();
    await publishedReview(tt, "TWO", 5);
    await publishedReview(tt, "TWO", 5);
    for (const r of [5, 4, 4]) await publishedReview(tt, "THREE", r);
    expect(await tt.query(api.reviews.public.getCardRatings, {})).toEqual({ THREE: { average: 4.3, count: 3 } });
  });
});
