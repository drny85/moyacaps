/**
 * Administrator catalog editing: product images, stock, price, visibility,
 * the variant editor and per-SKU tee stock (ADR 0008, ADR 0015).
 */
import { query, mutation, internalMutation } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import schema from "../schema";
import { dropStatusValidator, successResult, variantWithSubscribers } from "./validators";
import { getVariant, hasSkus, listSkus, setSkuStock } from "./inventory";
import { deleteAlertBatch } from "./drops";
import {
  buildNewVariant,
  blankImageWhileVisible,
  buildVariantPatch,
  nextAvailability,
  nextUpdatedAt,
  TEE_STOCK_EDIT_ERROR,
  validateMerged,
  versionOf,
} from "./model";
import { throwIfInvalid, validateProductFields } from "./rules";
import { actorEmail, diffFields, recordCatalogEvent } from "./audit";
import {
  countDropAlerts,
  deleteStorageQuietly,
  listCatalogVariants,
  patchVariantAudited,
  requireVariant,
  resolveVariantWithStorageUrl,
} from "./shared";

const categoryValidator = v.union(v.literal("headwear"), v.literal("apparel"));

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

    return {
      success: true,
      variantId: args.variantId,
      storageId: args.storageId,
    };
  },
});

export const getAllProductsAdmin = query({
  args: { includeArchived: v.optional(v.boolean()) },
  returns: v.object({ products: v.array(schema.doc("products")), variants: v.array(variantWithSubscribers) }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // The products table holds the single collection record seeded by seedAll.
    const products = await ctx.db.query("products").take(50);
    const rawVariants = (await listCatalogVariants(ctx)).filter((v) => args.includeArchived || v.archivedAt === undefined);
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
    const actor = actorEmail(await requireAdmin(ctx));
    const variant = await requireVariant(ctx, args.variantId);
    if (hasSkus(variant)) {
      throw new ConvexError(TEE_STOCK_EDIT_ERROR);
    }
    throwIfInvalid(validateMerged(variant, { stock: args.stock }, ["stock"]));

    await patchVariantAudited(ctx, variant, { stock: args.stock }, "stock_adjusted", actor);

    return { success: true, variantId: args.variantId, stock: args.stock };
  },
});

export const adjustVariantStock = mutation({
  args: {
    variantId: v.string(),
    delta: v.number(),
  },
  returns: v.object({ success: v.boolean(), variantId: v.string(), stock: v.number() }),
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const variant = await requireVariant(ctx, args.variantId);

    if (hasSkus(variant)) {
      throw new ConvexError(TEE_STOCK_EDIT_ERROR);
    }
    const newStock = Math.max(0, variant.stock + args.delta);
    throwIfInvalid(validateMerged(variant, { stock: newStock }, ["stock"]));

    await patchVariantAudited(ctx, variant, { stock: newStock }, "stock_adjusted", actor);

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
    const actor = actorEmail(await requireAdmin(ctx));
    const variant = await requireVariant(ctx, args.variantId);
    throwIfInvalid(validateMerged(variant, { priceUsd: args.priceUsd }, ["priceUsd"]));

    await patchVariantAudited(ctx, variant, { priceUsd: args.priceUsd }, "price_set", actor);

    return {
      success: true,
      variantId: args.variantId,
      priceUsd: args.priceUsd,
    };
  },
});

export const toggleVariantFeatured = mutation({
  args: {
    variantId: v.string(),
  },
  returns: v.object({ success: v.boolean(), isFeatured: v.boolean() }),
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const variant = await requireVariant(ctx, args.variantId);

    await patchVariantAudited(ctx, variant, { isFeatured: !variant.isFeatured }, "featured_toggled", actor);

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
    const actor = actorEmail(await requireAdmin(ctx));
    const variant = await requireVariant(ctx, args.variantId);
    const nextAvailable = nextAvailability(variant.isAvailable, args.isAvailable);

    await patchVariantAudited(ctx, variant, { isAvailable: nextAvailable }, "visibility_set", actor);

    return {
      success: true,
      variantId: args.variantId,
      isAvailable: nextAvailable,
    };
  },
});

/** The fields shared by `createVariant` and the optional part of `updateVariant`'s patch. */
const editableFields = {
  nameEn: v.string(),
  nameEs: v.string(),
  category: categoryValidator,
  silhouette: v.string(),
  primaryHex: v.string(),
  secondaryHex: v.string(),
  image: v.string(),
  storageId: v.id("_storage"),
  images: v.array(v.string()),
  stock: v.number(),
  priceUsd: v.number(),
  taxCode: v.string(),
  isFeatured: v.boolean(),
  isAvailable: v.boolean(),
  isDrop: v.boolean(),
  dropDate: v.number(),
  dropBadgeTextEn: v.string(),
  dropBadgeTextEs: v.string(),
  dropStatus: dropStatusValidator,
  descriptionEn: v.string(),
  descriptionEs: v.string(),
  badgeTextEn: v.string(),
  badgeTextEs: v.string(),
};

/** Uploaded Catalog Shots arrive as a storage id; the row keeps their URL as `image`. */
async function withUploadedImage<T extends { storageId?: Id<"_storage">; image?: string }>(ctx: MutationCtx, input: T): Promise<T> {
  if (!input.storageId || input.image?.trim()) return input;
  const url = await ctx.storage.getUrl(input.storageId);
  return url ? { ...input, image: url } : input;
}

export const createVariant = mutation({
  args: {
    variantId: v.string(),
    nameEn: editableFields.nameEn,
    nameEs: editableFields.nameEs,
    category: editableFields.category,
    silhouette: editableFields.silhouette,
    primaryHex: editableFields.primaryHex,
    secondaryHex: editableFields.secondaryHex,
    priceUsd: editableFields.priceUsd,
    isFeatured: editableFields.isFeatured,
    stock: v.optional(editableFields.stock),
    taxCode: v.optional(editableFields.taxCode),
    image: v.optional(editableFields.image),
    storageId: v.optional(editableFields.storageId),
    images: v.optional(editableFields.images),
    isAvailable: v.optional(editableFields.isAvailable),
    isDrop: v.optional(editableFields.isDrop),
    dropDate: v.optional(editableFields.dropDate),
    dropBadgeTextEn: v.optional(editableFields.dropBadgeTextEn),
    dropBadgeTextEs: v.optional(editableFields.dropBadgeTextEs),
    dropStatus: v.optional(editableFields.dropStatus),
    descriptionEn: v.optional(editableFields.descriptionEn),
    descriptionEs: v.optional(editableFields.descriptionEs),
    badgeTextEn: v.optional(editableFields.badgeTextEn),
    badgeTextEs: v.optional(editableFields.badgeTextEs),
  },
  returns: v.object({ id: v.id("variants"), variantId: v.string() }),
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const errors = validateProductFields(args);
    if (await getVariant(ctx, args.variantId)) errors.push({ field: "variantId", code: "taken" });
    throwIfInvalid(errors);

    const input = await withUploadedImage(ctx, args);
    const id = await ctx.db.insert("variants", buildNewVariant(input, Date.now()));
    await recordCatalogEvent(ctx, {
      variantId: args.variantId,
      type: "created",
      actor,
    });
    return { id, variantId: args.variantId };
  },
});

export const updateVariant = mutation({
  args: {
    variantId: v.string(),
    expectedUpdatedAt: v.number(),
    patch: v.object({
      nameEn: v.optional(editableFields.nameEn),
      nameEs: v.optional(editableFields.nameEs),
      category: v.optional(editableFields.category),
      silhouette: v.optional(editableFields.silhouette),
      primaryHex: v.optional(editableFields.primaryHex),
      secondaryHex: v.optional(editableFields.secondaryHex),
      image: v.optional(editableFields.image),
      storageId: v.optional(editableFields.storageId),
      images: v.optional(editableFields.images),
      stock: v.optional(editableFields.stock),
      priceUsd: v.optional(editableFields.priceUsd),
      taxCode: v.optional(editableFields.taxCode),
      isFeatured: v.optional(editableFields.isFeatured),
      isAvailable: v.optional(editableFields.isAvailable),
      isDrop: v.optional(editableFields.isDrop),
      dropDate: v.optional(editableFields.dropDate),
      dropBadgeTextEn: v.optional(editableFields.dropBadgeTextEn),
      dropBadgeTextEs: v.optional(editableFields.dropBadgeTextEs),
      dropStatus: v.optional(editableFields.dropStatus),
      descriptionEn: v.optional(editableFields.descriptionEn),
      descriptionEs: v.optional(editableFields.descriptionEs),
      badgeTextEn: v.optional(editableFields.badgeTextEn),
      badgeTextEs: v.optional(editableFields.badgeTextEs),
    }),
  },
  returns: v.object({ updatedAt: v.number() }),
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const existing = await requireVariant(ctx, args.variantId);
    if (versionOf(existing) !== args.expectedUpdatedAt) {
      throw new ConvexError({ kind: "stale" });
    }
    if (args.patch.stock !== undefined && hasSkus(existing)) {
      throw new ConvexError(TEE_STOCK_EDIT_ERROR);
    }
    throwIfInvalid(validateMerged(existing, args.patch));
    if (blankImageWhileVisible(existing, args.patch)) {
      throw new ConvexError({ kind: "needs_image" });
    }

    const input = await withUploadedImage(ctx, args.patch);
    const { updatedAt, ...fields } = buildVariantPatch(existing, input, nextUpdatedAt(existing, Date.now()));
    const before: Record<string, unknown> = {};
    for (const key of Object.keys(fields)) before[key] = (existing as Record<string, unknown>)[key];
    const changes = diffFields(before, { ...before, ...fields });
    if (changes.length === 0) return { updatedAt: versionOf(existing) };

    if (existing.storageId && fields.storageId && existing.storageId !== fields.storageId) {
      await deleteStorageQuietly(ctx, existing.storageId);
    }
    await ctx.db.patch("variants", existing._id, { ...fields, updatedAt });
    await recordCatalogEvent(ctx, {
      variantId: existing.variantId,
      type: "updated",
      actor,
      changes,
    });
    return { updatedAt };
  },
});

/**
 * Archive replaces delete: the product leaves the storefront, checkout and the default
 * admin list, but its slug stays reserved and its history stays intact.
 */
export const archiveVariant = mutation({
  args: { variantId: v.string() },
  returns: successResult,
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const variant = await requireVariant(ctx, args.variantId);
    if (variant.archivedAt !== undefined) return { success: true };
    await patchVariantAudited(ctx, variant, { archivedAt: Date.now(), isAvailable: false }, "archived", actor);
    return { success: true };
  },
});

/** Un-archive a product. It stays hidden (`isAvailable: false`) until an Administrator shows it. */
export const restoreVariant = mutation({
  args: { variantId: v.string() },
  returns: successResult,
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const variant = await requireVariant(ctx, args.variantId);
    await patchVariantAudited(ctx, variant, { archivedAt: undefined }, "restored", actor);
    return { success: true };
  },
});

/** Drop-alert batches one purge deletes inline before it hands the rest to the scheduler. */
const PURGE_ALERT_BATCHES = 10;

/**
 * INTERNAL, never exposed in the UI: permanently delete a product with its SKUs, drop
 * alerts and uploaded image. The audit event outlives the row.
 */
export const purgeVariant = internalMutation({
  args: { variantId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const variant = await requireVariant(ctx, args.variantId);

    for (const sku of await listSkus(ctx, variant.variantId)) {
      await ctx.db.delete("skus", sku._id);
    }

    let moreAlerts = true;
    for (let i = 0; i < PURGE_ALERT_BATCHES && moreAlerts; i++) {
      moreAlerts = await deleteAlertBatch(ctx, variant.variantId);
    }
    if (moreAlerts) {
      await ctx.scheduler.runAfter(0, internal.catalog.drops.deleteDropAlertsBatch, { variantId: variant.variantId });
    }

    // PR 3: delete productImages rows and schedule their files

    if (variant.storageId) {
      await deleteStorageQuietly(ctx, variant.storageId);
    }

    await ctx.db.delete("variants", variant._id);
    await recordCatalogEvent(ctx, { variantId: variant.variantId, type: "purged", actor: "system" });
    return null;
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
    const actor = actorEmail(await requireAdmin(ctx));
    const variant = await requireVariant(ctx, args.variantId);
    if (!hasSkus(variant)) throw new ConvexError(`${args.variantId} is not a tee with colorways and sizes`);
    if (!variant.colorways!.some((c) => c.id === args.colorway) || !variant.sizes!.includes(args.size)) {
      throw new ConvexError(`${args.colorway} / ${args.size} is not offered for ${args.variantId}`);
    }
    throwIfInvalid(validateMerged(variant, { stock: args.stock }, ["stock"]));
    const { previous, next } = await setSkuStock(ctx, variant, args.colorway, args.size, args.stock);
    if (previous !== next) {
      // The tee row's aggregate changed too; stamp it so an open full edit goes stale.
      await ctx.db.patch("variants", variant._id, { updatedAt: nextUpdatedAt(variant, Date.now()) });
      await recordCatalogEvent(ctx, {
        variantId: variant.variantId,
        type: "sku_stock_set",
        actor,
        changes: [{ field: `stock:${args.colorway}/${args.size}`, from: previous, to: next }],
      });
    }
    return { success: true };
  },
});
