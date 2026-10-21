/// <reference types="vite/client" />
/** Customer review functions (ADR 0028): eligibility by Order ownership, upsert-to-pending, stats upkeep. */
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");
const t = () => convexTest(schema, modules);
type T = Pick<ReturnType<typeof t>, "run" | "mutation" | "query">;

const ANA = "user_ana";
const asAna = (tt: ReturnType<typeof t>) => tt.withIdentity({ subject: ANA });

async function seedOrder(
  tt: T,
  opts: {
    orderNumber?: string;
    clerkUserId?: string | null;
    customerEmail?: string;
    customerName?: string;
    fulfillmentStatus?: "unfulfilled" | "in_transit" | "delivered";
    items?: { variantId: string; quantity: number; colorway?: string; size?: string }[];
    createdAt?: number;
  } = {}
): Promise<Id<"orders">> {
  const items = opts.items ?? [{ variantId: "V1", quantity: 1, colorway: "Black", size: "M" }];
  return await tt.run(async (ctx) =>
    ctx.db.insert("orders", {
      orderNumber: opts.orderNumber ?? "GL-1",
      customerEmail: opts.customerEmail,
      customerName: opts.customerName,
      clerkUserId: opts.clerkUserId === null ? undefined : (opts.clerkUserId ?? ANA),
      items: items.map((i) => ({ name: "Cap", price: 50, image: "/img.png", ...i })),
      currency: "USD",
      subtotal: 50,
      shippingFee: 0,
      total: 50,
      paymentStatus: "paid",
      fulfillmentStatus: opts.fulfillmentStatus ?? "delivered",
      paymentMethod: "stripe",
      createdAt: opts.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    })
  );
}

async function seedFullRefund(tt: T, orderId: Id<"orders">, lineIndex = 0, quantity = 1) {
  await tt.run(async (ctx) =>
    ctx.db.insert("order_refunds", {
      orderId,
      orderNumber: "GL-1",
      kind: "line",
      status: "issued",
      lines: [{ lineIndex, quantity, amountCents: 5000, restock: false }],
      shippingCents: 0,
      amountCents: 5000,
      requestId: `req-${orderId}`,
      idempotencyKey: `idem-${orderId}`,
      actor: "admin",
      createdAt: Date.now(),
    })
  );
}

const stats = (tt: T, variantId = "V1") =>
  tt.run(async (ctx) =>
    ctx.db
      .query("product_review_stats")
      .withIndex("by_variantId", (q) => q.eq("variantId", variantId))
      .unique()
  );

const submit = (tt: T, extra: { rating?: number; title?: string; body?: string } = {}) =>
  tt.mutation(api.reviews.customer.submitReview, { variantId: "V1", rating: 5, locale: "en", ...extra });

describe("submitReview", () => {
  it("rejects a signed-out caller", async () => {
    const tt = t();
    await seedOrder(tt);
    await expect(submit(tt)).rejects.toThrow();
  });

  it("rejects an in_transit Order", async () => {
    const tt = t();
    await seedOrder(tt, { fulfillmentStatus: "in_transit" });
    await expect(submit(asAna(tt))).rejects.toThrow();
  });

  it("rejects an unclaimed guest Order with the same email", async () => {
    const tt = t();
    await seedOrder(tt, { clerkUserId: null, customerEmail: "ana@example.com" });
    await expect(tt.withIdentity({ subject: ANA, email: "ana@example.com" }).mutation(api.reviews.customer.submitReview, { variantId: "V1", rating: 5, locale: "en" })).rejects.toThrow();
  });

  it("rejects a soft-deleted user", async () => {
    const tt = t();
    await seedOrder(tt);
    await tt.run(async (ctx) =>
      ctx.db.insert("users", { clerkId: ANA, email: "a@x.com", role: "customer", deletedAt: 1, createdAt: 1 })
    );
    await expect(submit(asAna(tt))).rejects.toThrow();
  });

  it("accepts when one of two Orders has a fully refunded line and the other is delivered", async () => {
    const tt = t();
    // Insert order matters: the index scans by _creationTime desc, so the refunded Order is newest and must be skipped.
    const good = await seedOrder(tt, {
      orderNumber: "GL-OLD",
      items: [{ variantId: "V1", quantity: 1, colorway: "Red", size: "L" }],
    });
    const refunded = await seedOrder(tt, { orderNumber: "GL-NEW" });
    await seedFullRefund(tt, refunded);
    const id = await submit(asAna(tt));
    const row = await tt.run(async (ctx) => ctx.db.get(id));
    expect(row?.orderId).toBe(good);
    expect(row?.boughtColorway).toBe("Red");
    expect(row?.boughtSize).toBe("L");
    expect(row?.status).toBe("pending");
  });

  it("names the reviewer from the users row, else the Order customerName", async () => {
    const tt = t();
    await seedOrder(tt, { customerName: "Ana Lopez" });
    const id = await submit(asAna(tt));
    expect((await tt.run(async (ctx) => ctx.db.get(id)))?.displayName).toBe("Ana L.");
    await tt.run(async (ctx) =>
      ctx.db.insert("users", { clerkId: ANA, email: "a@x.com", name: "Anita Ruiz", role: "customer", createdAt: 1 })
    );
    const again = await submit(asAna(tt));
    expect(again).toBe(id);
    expect((await tt.run(async (ctx) => ctx.db.get(id)))?.displayName).toBe("Anita R.");
  });

  it("edit of a published review returns it to pending and drops stats", async () => {
    const tt = t();
    await seedOrder(tt);
    const id = await submit(asAna(tt), { rating: 4 });
    await tt.run(async (ctx) => {
      const row = await ctx.db.get(id);
      await ctx.db.patch(id, { status: "published", publishedAt: 5 });
      await ctx.db.insert("product_review_stats", { variantId: "V1", count: 1, ratingSum: row!.rating });
    });
    const edited = await submit(asAna(tt), { rating: 2, title: "  Meh " });
    expect(edited).toBe(id);
    const row = await tt.run(async (ctx) => ctx.db.get(id));
    expect(row).toMatchObject({ status: "pending", rating: 2, title: "Meh" });
    expect(row?.publishedAt).toBeUndefined();
    expect(row?.rejectReason).toBeUndefined();
    expect(await stats(tt)).toMatchObject({ count: 0, ratingSum: 0 });
  });

  it("edit of a rejected review clears the reject reason", async () => {
    const tt = t();
    await seedOrder(tt);
    const id = await submit(asAna(tt));
    await tt.run(async (ctx) => ctx.db.patch(id, { status: "rejected", rejectReason: "spam" }));
    await submit(asAna(tt));
    const row = await tt.run(async (ctx) => ctx.db.get(id));
    expect(row?.status).toBe("pending");
    expect(row?.rejectReason).toBeUndefined();
  });
});

describe("deleteMyReview", () => {
  it("of a published review decrements stats", async () => {
    const tt = t();
    await seedOrder(tt);
    const id = await submit(asAna(tt), { rating: 4 });
    await tt.run(async (ctx) => {
      await ctx.db.patch(id, { status: "published", publishedAt: 5 });
      await ctx.db.insert("product_review_stats", { variantId: "V1", count: 1, ratingSum: 4 });
    });
    expect(await asAna(tt).mutation(api.reviews.customer.deleteMyReview, { variantId: "V1" })).toBeNull();
    expect(await tt.run(async (ctx) => ctx.db.get(id))).toBeNull();
    expect(await stats(tt)).toMatchObject({ count: 0, ratingSum: 0 });
  });

  it("is a no-op without a review", async () => {
    const tt = t();
    expect(await asAna(tt).mutation(api.reviews.customer.deleteMyReview, { variantId: "V1" })).toBeNull();
  });
});

describe("getMyReviewState", () => {
  it("returns canReview false and no review when signed out", async () => {
    const tt = t();
    await seedOrder(tt);
    expect(await tt.query(api.reviews.customer.getMyReviewState, { variantId: "V1" })).toEqual({
      canReview: false,
      review: null,
    });
  });

  it("canReview stays true after reviewing, and returns the review", async () => {
    const tt = t();
    await seedOrder(tt);
    expect(await asAna(tt).query(api.reviews.customer.getMyReviewState, { variantId: "V1" })).toMatchObject({
      canReview: true,
      review: null,
    });
    await submit(asAna(tt));
    const state = await asAna(tt).query(api.reviews.customer.getMyReviewState, { variantId: "V1" });
    expect(state.canReview).toBe(true);
    expect(state.review?.status).toBe("pending");
  });

  it("canReview false for a variant not bought", async () => {
    const tt = t();
    await seedOrder(tt);
    expect((await asAna(tt).query(api.reviews.customer.getMyReviewState, { variantId: "V9" })).canReview).toBe(false);
  });
});

describe("getMyReviewableItems", () => {
  it("marks reviewed lines", async () => {
    const tt = t();
    const orderId = await seedOrder(tt, {
      items: [
        { variantId: "V1", quantity: 1 },
        { variantId: "V2", quantity: 1 },
      ],
    });
    await submit(asAna(tt));
    const items = await asAna(tt).query(api.reviews.customer.getMyReviewableItems, { orderId });
    expect(items).toEqual([
      { variantId: "V1", lineIndex: 0, reviewed: true },
      { variantId: "V2", lineIndex: 1, reviewed: false },
    ]);
  });

  it("omits fully refunded lines", async () => {
    const tt = t();
    const orderId = await seedOrder(tt);
    await seedFullRefund(tt, orderId);
    expect(await asAna(tt).query(api.reviews.customer.getMyReviewableItems, { orderId })).toEqual([]);
  });

  it("throws for another customer's Order and when signed out", async () => {
    const tt = t();
    const orderId = await seedOrder(tt, { clerkUserId: "user_other" });
    await expect(asAna(tt).query(api.reviews.customer.getMyReviewableItems, { orderId })).rejects.toThrow();
    await expect(tt.query(api.reviews.customer.getMyReviewableItems, { orderId })).rejects.toThrow();
  });
});
