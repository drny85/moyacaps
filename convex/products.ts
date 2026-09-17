import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getVariants = query({
  args: {
    silhouette: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let variants = await ctx.db.query("variants").collect();
    if (args.silhouette && args.silhouette !== "all") {
      variants = variants.filter((v) => v.silhouette === args.silhouette);
    }
    return variants;
  },
});

export const getVariantById = query({
  args: {
    variantId: v.string(),
  },
  handler: async (ctx, args) => {
    const variant = await ctx.db
      .query("variants")
      .filter((q) => q.eq(q.field("variantId"), args.variantId))
      .first();
    return variant;
  },
});

export const seedVariants = mutation({
  args: {
    variants: v.array(
      v.object({
        variantId: v.string(),
        nameEn: v.string(),
        nameEs: v.string(),
        silhouette: v.string(),
        primaryHex: v.string(),
        secondaryHex: v.string(),
        image: v.string(),
        stock: v.number(),
        priceUsd: v.number(),
        priceMxn: v.number(),
        isFeatured: v.boolean(),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Clear existing
    const existing = await ctx.db.query("variants").collect();
    for (const item of existing) {
      await ctx.db.delete(item._id);
    }

    // Insert seeds
    for (const v of args.variants) {
      await ctx.db.insert("variants", v);
    }
    return { success: true, count: args.variants.length };
  },
});
