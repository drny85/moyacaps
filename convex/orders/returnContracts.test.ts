/// <reference types="vite/client" />
/**
 * Return-validator contracts: convex-test checks every function's `returns:` validator,
 * so calling each read and admin write once against realistic data catches a projection
 * drifting from its validator. Behaviour is covered elsewhere (orders.test.ts, *Model.test.ts).
 */
import { convexTest } from "convex-test";
import rateLimiterTest from "@convex-dev/rate-limiter/test";
import aggregateTest from "@convex-dev/aggregate/test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";

const modules = import.meta.glob("/convex/**/*.ts");
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

async function seeded() {
  const t = convexTest(schema, modules);
  rateLimiterTest.register(t);
  aggregateTest.register(t, "orderStats");
  await t.run(async (ctx) => {
    await ctx.db.insert("products", {
      nameEn: "0880",
      nameEs: "0880",
      slug: "0880",
      collection: "0880 Mythos",
      basePriceUsd: 120,
      featured: true,
    });
    await ctx.db.insert("variants", {
      variantId: "negro-rojo",
      isAvailable: true,
      nameEn: "Black / Red",
      nameEs: "Negro / Rojo",
      silhouette: "snapback",
      primaryHex: "#000",
      secondaryHex: "#f00",
      image: "/caps/negro-rojo.png",
      stock: 1,
      priceUsd: 120,
      isFeatured: true,
    });
    await ctx.db.insert("variants", {
      variantId: "drop-cap",
      isAvailable: true,
      nameEn: "Drop Cap",
      nameEs: "Gorra Drop",
      silhouette: "trucker",
      category: "headwear",
      primaryHex: "#111",
      secondaryHex: "#222",
      image: "/caps/drop.png",
      stock: 10,
      priceUsd: 150,
      isFeatured: false,
      isDrop: true,
      dropDate: NOW + DAY,
      dropStatus: "scheduled",
      dropBadgeTextEn: "VIP",
    });
    await ctx.db.insert("variants", {
      variantId: "eagle-tee",
      nameEn: "Eagle Tee",
      nameEs: "Playera Águila",
      silhouette: "tee",
      category: "apparel",
      primaryHex: "#000",
      secondaryHex: "#fff",
      image: "/shirts/eagle.jpg",
      stock: 3,
      priceUsd: 80,
      isFeatured: false,
      isAvailable: false,
      colorways: [
        { id: "black", nameEn: "Black", nameEs: "Negro", hex: "#000", borderHex: "#111", lifestyleImage: "/l.jpg", catalogShot: "/c.jpg" },
      ],
      sizes: ["M"],
    });
    await ctx.db.insert("skus", { variantId: "eagle-tee", colorway: "black", size: "M", stock: 3 });
    await ctx.db.insert("drop_alerts", {
      variantId: "drop-cap",
      contact: "fan@example.com",
      channel: "email",
      locale: "en",
      createdAt: NOW,
    });
    await ctx.db.insert("users", { clerkId: "user_cust", email: "ana@example.com", role: "customer", createdAt: NOW });
    await ctx.db.insert("orders", {
      orderNumber: "GL-RC-1",
      customerEmail: "ana@example.com",
      customerName: "Ana Lopez",
      customerPhone: "5551234567",
      clerkUserId: "user_cust",
      shippingAddress: { line1: "1 Main St", city: "New York", state: "NY", postalCode: "10001", country: "US" },
      items: [{ variantId: "negro-rojo", name: "Black / Red", quantity: 1, price: 120, image: "/caps/negro-rojo.png" }],
      currency: "USD",
      subtotal: 120,
      shippingFee: 8,
      total: 128,
      paymentStatus: "paid",
      fulfillmentStatus: "unfulfilled",
      paymentMethod: "stripe",
      stripeSessionId: "cs_test_rc",
      trackingNumber: "GL-TRK-000001",
      createdAt: NOW - 2 * DAY,
    });
    await ctx.db.insert("orders", {
      orderNumber: "GL-WA-RC2",
      customerEmail: "lead@example.com",
      items: [{ variantId: "negro-rojo", name: "Black / Red", quantity: 1, price: 120, image: "/caps/negro-rojo.png" }],
      currency: "USD",
      total: 128,
      // A retired WhatsApp reservation (ADR 0023): cancelled, never paid.
      paymentStatus: "awaiting_payment",
      fulfillmentStatus: "unfulfilled",
      cancelledAt: NOW,
      cancellationReason: "whatsapp_retired",
      paymentMethod: "whatsapp",
      paymentUrl: "https://checkout.stripe.com/pay/cs_test_wa",
      reservationExpiresAt: NOW + DAY,
      createdAt: NOW,
    });
  });
  return t;
}

const asAdmin = (t: Awaited<ReturnType<typeof seeded>>) =>
  t.withIdentity({ subject: "user_admin", email: PRIMARY_ADMIN_EMAIL, emailVerified: true });

describe("catalog and drop reads match their return validators", () => {
  it("storefront catalog", async () => {
    const t = await seeded();
    expect(await t.query(api.catalog.queries.getVariants, {})).toHaveLength(2);
    expect(await t.query(api.catalog.queries.getVariants, { category: "headwear", inStock: true })).toHaveLength(2);
    expect(await t.query(api.catalog.queries.getVariantById, { variantId: "missing" })).toBeNull();
    expect((await asAdmin(t).query(api.catalog.queries.getProductBySlug, { slug: "eagle-tee", allowUnavailable: true }))?.skus).toHaveLength(1);
  });

  it("Drop Radar uses the caller's clock", async () => {
    const t = await seeded();
    expect(await t.query(api.catalog.drops.getUpcomingDrops, { clientTime: NOW })).toMatchObject([{ variantId: "drop-cap", subscribersCount: 1 }]);
    expect(await t.query(api.catalog.drops.getUpcomingDrops, { clientTime: NOW + 2 * DAY })).toEqual([]);
  });

  it("admin catalog and drop desk", async () => {
    const t = await seeded();
    const admin = asAdmin(t);
    const products = await admin.query(api.catalog.admin.getAllProductsAdmin, {});
    expect(products.variants).toHaveLength(3);
    expect(await admin.query(api.catalog.drops.getAllDropsAdmin, { clientTime: NOW })).toMatchObject([{ computedStatus: "scheduled" }]);
    expect(await admin.query(api.catalog.drops.getAllDropsAdmin, { clientTime: NOW + 2 * DAY })).toMatchObject([{ computedStatus: "live" }]);
    expect(await admin.query(api.catalog.drops.getDropSubscribersList, {})).toMatchObject([{ variantNameEn: "Drop Cap" }]);
    expect(await admin.query(api.catalog.drops.getDropSubscribers, { variantId: "drop-cap" })).toHaveLength(1);
  });

  it("admin catalog writes", async () => {
    const t = await seeded();
    const admin = asAdmin(t);
    expect(await admin.mutation(api.catalog.admin.toggleVariantFeatured, { variantId: "negro-rojo" })).toEqual({ success: true, isFeatured: false });
    expect(await admin.mutation(api.catalog.admin.toggleVariantAvailable, { variantId: "negro-rojo" })).toMatchObject({ isAvailable: false });
    expect(await admin.mutation(api.catalog.admin.updateVariantPrice, { variantId: "negro-rojo", priceUsd: 125 })).toMatchObject({ priceUsd: 125 });
    const saved = await admin.mutation(api.catalog.admin.createVariant, {
      variantId: "new-cap",
      nameEn: "New",
      nameEs: "Nueva",
      category: "headwear",
      silhouette: "snapback",
      primaryHex: "#000000",
      secondaryHex: "#ffffff",
      stock: 2,
      priceUsd: 120,
      isFeatured: false,
    });
    expect(saved.variantId).toBe("new-cap");
    expect(await admin.mutation(api.catalog.drops.scheduleDrop, { variantId: "new-cap", dropDate: NOW + DAY })).toMatchObject({ dropStatus: "scheduled" });
    expect(await admin.mutation(api.catalog.drops.releaseDropNow, { variantId: "new-cap" })).toMatchObject({ dropStatus: "live" });
    expect(
      await t.mutation(api.catalog.drops.subscribeToDropAlert, { variantId: "new-cap", contact: "a@b.co", channel: "email", locale: "es" })
    ).toMatchObject({ alreadySubscribed: false });
    expect(await admin.mutation(api.catalog.drops.deleteDrop, { variantId: "drop-cap" })).toEqual({ success: true, variantId: "drop-cap" });
    expect(await admin.query(api.catalog.drops.getDropSubscribers, { variantId: "drop-cap" })).toEqual([]);
    expect(await admin.mutation(api.catalog.admin.archiveVariant, { variantId: "new-cap" })).toEqual({ success: true });
    expect(await admin.mutation(api.catalog.admin.restoreVariant, { variantId: "new-cap" })).toEqual({ success: true });
  });
});

describe("order reads match their return validators", () => {
  it("customer views", async () => {
    const t = await seeded();
    expect(await t.query(api.orders.functions.getOrderBySessionOrNumber, { identifier: "cs_test_rc" })).toMatchObject({ isGuestView: false });
    expect(await t.query(api.orders.functions.getOrderBySessionOrNumber, { identifier: "GL-RC-1" })).toBeNull();
    expect(
      await t.withIdentity({ subject: "user_cust" }).query(api.orders.functions.getOrderBySessionOrNumber, { identifier: "GL-RC-1" })
    ).toMatchObject({ isGuestView: true });
    expect(
      await t.query(api.orders.functions.getOrderByOrderNumberAndEmail, { orderNumber: "rc-1", email: "ana@example.com" })
    ).toMatchObject({ isGuestView: true, shippingAddress: { line1: "***" } });
    expect(
      await t.withIdentity({ subject: "user_cust" }).query(api.orders.functions.getOrderByOrderNumberAndEmail, { orderNumber: "GL-RC-1", email: "ana@example.com" })
    ).toMatchObject({ isGuestView: false, customerEmail: "ana@example.com" });
    const mine = await t.withIdentity({ subject: "user_cust" }).query(api.orders.functions.getOrdersByClerkId, { clerkUserId: "user_cust" });
    expect(mine).toHaveLength(1);
    // The seeded legacy GL-TRK placeholder is never shown as carrier tracking.
    expect(mine[0].trackingNumber).toBeUndefined();
  });

  it("admin order desk and analytics use the caller's clock", async () => {
    const t = await seeded();
    const admin = asAdmin(t);
    // The never-paid WhatsApp reservation is an Expired Checkout: only the cancelled tab lists it.
    expect(await admin.query(api.orders.desk.getAllOrdersAdmin, { clientTime: NOW })).toHaveLength(1);
    expect(await admin.query(api.orders.desk.getAllOrdersAdmin, { clientTime: NOW, status: "overdue" })).toHaveLength(1);
    expect(await admin.query(api.orders.desk.getAllOrdersAdmin, { clientTime: NOW - 3 * DAY, status: "overdue" })).toHaveLength(0);
    expect(await admin.query(api.orders.desk.getAllOrdersAdmin, { clientTime: NOW, status: "cancelled", since: NOW - DAY })).toHaveLength(1);
    expect(await admin.query(api.orders.desk.getAllOrdersAdmin, { clientTime: NOW, since: NOW - 3 * DAY })).toHaveLength(1);
    expect(await admin.query(api.orders.desk.getOrderDetailAdmin, { orderNumber: "#rc-1" })).toMatchObject({ orderNumber: "GL-RC-1" });
    expect(await admin.query(api.orders.desk.getOrdersAttentionStats, { clientTime: NOW })).toMatchObject({ overduePaid: 1 });
    // The seed writes orders straight to the table (no trigger), like orders that predate the aggregate.
    await t.mutation(internal.analytics.migrations.backfillOrderStats, {});
    expect(await admin.query(api.analytics.functions.getAnalyticsAdmin, { clientTime: NOW, tzOffsetMinutes: 0 })).toMatchObject({ totalRevenue: 128 });
    expect(await admin.query(api.users.functions.getAllUsersAdmin, {})).toHaveLength(1);
    expect(await admin.query(api.users.functions.getUserByClerkId, { clerkId: "user_cust" })).toMatchObject({ email: "ana@example.com" });
  });

  it("review reads match their return validators", async () => {
    const t = await seeded();
    const admin = asAdmin(t);
    const reviewId = await t.run(async (ctx) => {
      const now = Date.now();
      const row = { variantId: "negro-rojo", clerkUserId: "user_cust", rating: 5, locale: "en" as const, displayName: "Ana C.", createdAt: now, updatedAt: now };
      const orderId = (await ctx.db.query("orders").first())!._id;
      await ctx.db.insert("product_review_stats", { variantId: "negro-rojo", count: 3, ratingSum: 14 });
      return await ctx.db.insert("product_reviews", { ...row, orderId, status: "pending" });
    });
    await admin.mutation(api.reviews.admin.publishReview, { reviewId });
    const paginationOpts = { numItems: 5, cursor: null };
    expect((await t.query(api.reviews.public.getProductReviews, { variantId: "negro-rojo", paginationOpts })).page).toHaveLength(1);
    expect(await t.query(api.reviews.public.getRatingSummary, { variantId: "negro-rojo" })).toMatchObject({ count: 4 });
    expect(await t.query(api.reviews.public.getCardRatings, {})).toHaveProperty("negro-rojo");
    expect((await admin.query(api.reviews.admin.listReviewsAdmin, { status: "published", paginationOpts })).page).toMatchObject([{ productName: "Black / Red" }]);
    expect(await admin.query(api.reviews.admin.getPendingReviewCount, {})).toBe(0);
  });

  it("internal lookups", async () => {
    const t = await seeded();
    expect(await t.query(internal.orders.functions.getOrderByNumberInternal, { orderNumber: "GL-RC-1" })).toMatchObject({ paymentStatus: "paid" });
    expect(await t.query(internal.orders.functions.getOrderByStripeSessionIdInternal, { stripeSessionId: "nope" })).toBeNull();
    expect(await t.mutation(internal.users.functions.softDeleteUser, { clerkId: "nobody" })).toEqual({ success: false, reason: "User not found" });
  });
});
