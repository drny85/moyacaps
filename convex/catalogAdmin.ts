/**
 * Administrator catalog editing: product images, stock, price, visibility,
 * the variant editor and per-SKU tee stock (ADR 0008, ADR 0015).
 */
import { query, mutation, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./auth";
import schema from "./schema";
import { successResult, variantWithSubscribers } from "./catalogValidators";
import { getVariant, hasSkus, setSkuStock } from "./inventory";
import { mergeVariantUpdate, newVariantDoc, nextAvailability, TEE_STOCK_EDIT_ERROR } from "./catalogModel";
import {
  countDropAlerts,
  deleteStorageQuietly,
  listCatalogVariants,
  requireVariant,
  resolveVariantWithStorageUrl,
} from "./catalogShared";

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const generateUploadUrlInternal = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const setVariantStorageId = internalMutation({
  args: {
    variantId: v.string(),
    storageId: v.id("_storage"),
  },
  returns: v.object({ success: v.boolean(), variantId: v.string(), storageId: v.id("_storage") }),
  handler: async (ctx, args) => {
    const variant = await requireVariant(ctx, args.variantId);

    if (variant.storageId && variant.storageId !== args.storageId) {
      await deleteStorageQuietly(ctx, variant.storageId);
    }

    await ctx.db.patch(variant._id, {
      storageId: args.storageId,
    });

    return { success: true, variantId: args.variantId, storageId: args.storageId };
  },
});

export const getAllProductsAdmin = query({
  args: {},
  returns: v.object({ products: v.array(schema.doc("products")), variants: v.array(variantWithSubscribers) }),
  handler: async (ctx) => {
    await requireAdmin(ctx);
    // The products table holds the single collection record seeded by seedAll.
    const products = await ctx.db.query("products").take(50);
    const rawVariants = await listCatalogVariants(ctx);
    const variants = await Promise.all(
      rawVariants.map(async (v) => {
        const resolved = await resolveVariantWithStorageUrl(ctx, v);
        return {
          ...resolved,
          subscribersCount: await countDropAlerts(ctx, v.variantId),
        };
      })
    );
    return {
      products,
      variants,
    };
  },
});

export const updateVariantStock = mutation({
  args: {
    variantId: v.string(),
    stock: v.number(),
  },
  returns: v.object({ success: v.boolean(), variantId: v.string(), stock: v.number() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await requireVariant(ctx, args.variantId);
    if (hasSkus(variant)) {
      throw new ConvexError(TEE_STOCK_EDIT_ERROR);
    }

    await ctx.db.patch(variant._id, {
      stock: Math.max(0, args.stock),
    });

    return { success: true, variantId: args.variantId, stock: Math.max(0, args.stock) };
  },
});

export const adjustVariantStock = mutation({
  args: {
    variantId: v.string(),
    delta: v.number(),
  },
  returns: v.object({ success: v.boolean(), variantId: v.string(), stock: v.number() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await requireVariant(ctx, args.variantId);

    if (hasSkus(variant)) {
      throw new ConvexError(TEE_STOCK_EDIT_ERROR);
    }
    const newStock = Math.max(0, variant.stock + args.delta);
    await ctx.db.patch(variant._id, {
      stock: newStock,
    });

    return { success: true, variantId: args.variantId, stock: newStock };
  },
});

export const updateVariantPrice = mutation({
  args: {
    variantId: v.string(),
    priceUsd: v.number(),
  },
  returns: v.object({ success: v.boolean(), variantId: v.string(), priceUsd: v.number() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await requireVariant(ctx, args.variantId);

    await ctx.db.patch(variant._id, {
      priceUsd: Math.max(0, args.priceUsd),
    });

    return { success: true, variantId: args.variantId, priceUsd: args.priceUsd };
  },
});

export const toggleVariantFeatured = mutation({
  args: {
    variantId: v.string(),
  },
  returns: v.object({ success: v.boolean(), isFeatured: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await requireVariant(ctx, args.variantId);

    await ctx.db.patch(variant._id, {
      isFeatured: !variant.isFeatured,
    });

    return { success: true, isFeatured: !variant.isFeatured };
  },
});

export const toggleVariantAvailable = mutation({
  args: {
    variantId: v.string(),
    isAvailable: v.optional(v.boolean()),
  },
  returns: v.object({ success: v.boolean(), variantId: v.string(), isAvailable: v.boolean() }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await requireVariant(ctx, args.variantId);
    const nextAvailable = nextAvailability(variant.isAvailable, args.isAvailable);

    await ctx.db.patch(variant._id, {
      isAvailable: nextAvailable,
    });

    return { success: true, variantId: args.variantId, isAvailable: nextAvailable };
  },
});

export const saveVariant = mutation({
  args: {
    variantId: v.string(),
    nameEn: v.string(),
    nameEs: v.string(),
    silhouette: v.string(),
    primaryHex: v.string(),
    secondaryHex: v.string(),
    image: v.string(),
    storageId: v.optional(v.id("_storage")),
    images: v.optional(v.array(v.string())),
    stock: v.number(),
    priceUsd: v.number(),
    isFeatured: v.boolean(),
    isAvailable: v.optional(v.boolean()),
    isDrop: v.optional(v.boolean()),
    dropDate: v.optional(v.number()),
    dropBadgeTextEn: v.optional(v.string()),
    dropBadgeTextEs: v.optional(v.string()),
    dropStatus: v.optional(v.union(v.literal("scheduled"), v.literal("live"), v.literal("archived"))),
    category: v.optional(v.string()),
    taxCode: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean(), action: v.union(v.literal("updated"), v.literal("created")), id: v.id("variants") }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    let resolvedImage = args.image;
    if (args.storageId && (!resolvedImage || resolvedImage.trim() === "")) {
      const url = await ctx.storage.getUrl(args.storageId);
      if (url) {
        resolvedImage = url;
      }
    }

    const existing = await getVariant(ctx, args.variantId);

    if (existing) {
      if (existing.storageId && args.storageId && existing.storageId !== args.storageId) {
        await deleteStorageQuietly(ctx, existing.storageId);
      }

      await ctx.db.patch(existing._id, mergeVariantUpdate(existing, args, resolvedImage, hasSkus(existing)));
      return { success: true, action: "updated" as const, id: existing._id };
    }

    const id = await ctx.db.insert("variants", newVariantDoc(args, resolvedImage));

    return { success: true, action: "created" as const, id };
  },
});

export const deleteVariant = mutation({
  args: {
    variantId: v.string(),
  },
  returns: successResult,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await requireVariant(ctx, args.variantId);

    if (variant.storageId) {
      await deleteStorageQuietly(ctx, variant.storageId);
    }

    await ctx.db.delete(variant._id);
    return { success: true };
  },
});

/** Admin: set one tee SKU's stock; the tee's aggregate stock follows. */
export const setTeeSkuStock = mutation({
  args: {
    variantId: v.string(),
    colorway: v.string(),
    size: v.string(),
    stock: v.number(),
  },
  returns: successResult,
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const variant = await getVariant(ctx, args.variantId);
    if (!variant) throw new ConvexError(`Variant ${args.variantId} not found`);
    if (!hasSkus(variant)) throw new ConvexError(`${args.variantId} is not a tee with colorways and sizes`);
    if (!variant.colorways!.some((c) => c.id === args.colorway) || !variant.sizes!.includes(args.size)) {
      throw new ConvexError(`${args.colorway} / ${args.size} is not offered for ${args.variantId}`);
    }
    if (!Number.isFinite(args.stock) || args.stock < 0) throw new ConvexError("Stock must be zero or more");
    await setSkuStock(ctx, variant, args.colorway, args.size, args.stock);
    return { success: true };
  },
});
