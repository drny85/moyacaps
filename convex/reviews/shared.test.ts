/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { applyStatsChange, type ReviewDoc } from "./shared";

const modules = import.meta.glob("/convex/**/*.ts");

describe("applyStatsChange", () => {
  it("keeps count and ratingSum in step", async () => {
    const t = convexTest(schema, modules);
    await t.run(async (ctx) => {
      const orderId: Id<"orders"> = await ctx.db.insert("orders", {
        orderNumber: "GL-1",
        items: [{ variantId: "V1", name: "Cap", quantity: 1, price: 50, image: "/img.png" }],
        currency: "USD",
        subtotal: 50,
        shippingFee: 0,
        total: 50,
        paymentStatus: "paid",
        fulfillmentStatus: "delivered",
        paymentMethod: "stripe",
        createdAt: 1,
        updatedAt: 1,
      });
      const base = {
        variantId: "V1",
        orderId,
        locale: "en" as const,
        displayName: "Ana",
        createdAt: 1,
        updatedAt: 1,
      };
      const insert = async (user: string, rating: number): Promise<ReviewDoc> => {
        const id = await ctx.db.insert("product_reviews", {
          ...base,
          clerkUserId: user,
          rating,
          status: "pending",
        });
        return (await ctx.db.get(id))!;
      };
      const publish = async (doc: ReviewDoc): Promise<ReviewDoc> => {
        await ctx.db.patch(doc._id, { status: "published", publishedAt: 2 });
        const next = (await ctx.db.get(doc._id))!;
        await applyStatsChange(ctx, "V1", doc, next);
        return next;
      };

      const five = await publish(await insert("u1", 5));
      await publish(await insert("u2", 3));
      const stats = () =>
        ctx.db
          .query("product_review_stats")
          .withIndex("by_variantId", (q) => q.eq("variantId", "V1"))
          .unique();
      expect(await stats()).toMatchObject({ count: 2, ratingSum: 8 });

      await ctx.db.patch(five._id, { status: "rejected" });
      const rejected = (await ctx.db.get(five._id))!;
      await applyStatsChange(ctx, "V1", five, rejected);
      expect(await stats()).toMatchObject({ count: 1, ratingSum: 3 });
    });
  });
});
