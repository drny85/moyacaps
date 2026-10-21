/**
 * Administrator catalog editing: product images, stock, price, visibility,
 * the variant editor and per-SKU tee stock (ADR 0008, ADR 0015).
 */
import { query, mutation, internalMutation } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { v, ConvexError } from "convex/values";
import { internal } from "../_generated/api";
import { requireAdmin } from "../lib/auth";
import schema from "../schema";
import { adminProductRow, dropStatusValidator, successResult } from "./validators";
import { getSku, getVariant, hasSkus, listSkus, setSkuStock, syncTeeAggregate } from "./inventory";
import { deleteAlertBatch } from "./drops";
import { deleteAllProductImages, deleteColorwayImages, scheduleFileDelete } from "./images/functions";
import {
  buildNewVariant,
  blankImageWhileVisible,
  buildVariantPatch,
  distributeStock,
  fillColorwayShots,
  nextAvailability,
  nextUpdatedAt,
  TEE_STOCK_EDIT_ERROR,
  validateMerged,
  variantCategory,
  versionOf,
} from "./model";
import { throwIfInvalid, validateProductFields, validateTeeOptions } from "./rules";
import type { FieldError } from "./rules";
import { planSkuChanges } from "./skuPlan";
import { actorEmail, diffFields, recordCatalogEvent } from "./audit";
import {
  countDropAlerts,
  listCatalogVariants,
  patchVariantAudited,
  requireActiveVariant,
  requireVariant,
  requireVersion,
  hasCatalogImageRow,
  resolveProduct,
} from "./shared";

const teeColorwayValidator = v.object({
  id: v.string(),
  nameEn: v.string(),
  nameEs: v.string(),
  hex: v.string(),
  borderHex: v.string(),
});

/** Tee-only fields; a headwear product that sends any of them is rejected. */
const TEE_FIELD_KEYS = ["colorways", "sizes", "defaultColorway", "fabricEn", "fabricEs", "fitEn", "fitEs"] as const;

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

export const getAllProductsAdmin = query({
  args: { includeArchived: v.optional(v.boolean()) },
  returns: v.object({ products: v.array(schema.doc("products")), variants: v.array(adminProductRow) }),
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    // The products table holds the single collection record seeded by seedAll.
    const products = await ctx.db.query("products").take(50);
    const rawVariants = (await listCatalogVariants(ctx)).filter((row) => args.includeArchived || row.archivedAt === undefined);
    const variants = await Promise.all(
      rawVariants.map(async (v) => {
        const resolved = await resolveProduct(ctx, v);
        return {
          ...resolved,
          subscribersCount: await countDropAlerts(ctx, v.variantId),
          skus: (await listSkus(ctx, v.variantId)).map(({ colorway, size, stock }) => ({ colorway, size, stock })),
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
    const variant = await requireActiveVariant(ctx, args.variantId);
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
    const variant = await requireActiveVariant(ctx, args.variantId);

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
    const variant = await requireActiveVariant(ctx, args.variantId);
    const nextAvailable = nextAvailability(variant.isAvailable, args.isAvailable);
    if (nextAvailable && blankImageWhileVisible(variant, { isAvailable: true }, await hasCatalogImageRow(ctx, variant.variantId, variant.defaultColorway))) {
      throw new ConvexError({ kind: "needs_image" });
    }

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
  colorways: v.array(teeColorwayValidator),
  sizes: v.array(v.string()),
  defaultColorway: v.string(),
  fabricEn: v.string(),
  fabricEs: v.string(),
  fitEn: v.string(),
  fitEs: v.string(),
};

/** Tee fields supplied on a headwear product are `mismatch` errors. */
function teeFieldMismatches(input: Partial<Record<(typeof TEE_FIELD_KEYS)[number], unknown>>): FieldError[] {
  return TEE_FIELD_KEYS.filter((key) => input[key] !== undefined).map((field) => ({ field, code: "mismatch" as const }));
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
    colorways: v.optional(editableFields.colorways),
    sizes: v.optional(editableFields.sizes),
    defaultColorway: v.optional(editableFields.defaultColorway),
    fabricEn: v.optional(editableFields.fabricEn),
    fabricEs: v.optional(editableFields.fabricEs),
    fitEn: v.optional(editableFields.fitEn),
    fitEs: v.optional(editableFields.fitEs),
  },
  returns: v.object({ id: v.id("variants"), variantId: v.string() }),
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const errors = validateProductFields(args);
    if (await getVariant(ctx, args.variantId)) errors.push({ field: "variantId", code: "taken" });
    const isTee = args.category === "apparel";
    if (isTee) {
      errors.push(...validateTeeOptions({ ...args, colorways: args.colorways ?? [], sizes: args.sizes ?? [] }));
    } else {
      errors.push(...teeFieldMismatches(args));
    }
    throwIfInvalid(errors);

    const { colorways: _colorwayInput, ...rest } = args;
    const colorways = isTee ? fillColorwayShots(args.colorways!, undefined) : undefined;
    // A tee's stock lives on its SKUs, all created at zero.
    const input = isTee
      ? { ...rest, colorways, defaultColorway: args.defaultColorway ?? colorways![0].id, stock: 0 }
      : rest;
    const id = await ctx.db.insert("variants", buildNewVariant(input, Date.now()));
    if (isTee) {
      for (const colorway of colorways!) {
        for (const size of args.sizes!) {
          await ctx.db.insert("skus", { variantId: args.variantId, colorway: colorway.id, size, stock: 0 });
        }
      }
    }
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
      colorways: v.optional(editableFields.colorways),
      sizes: v.optional(editableFields.sizes),
      defaultColorway: v.optional(editableFields.defaultColorway),
      fabricEn: v.optional(editableFields.fabricEn),
      fabricEs: v.optional(editableFields.fabricEs),
      fitEn: v.optional(editableFields.fitEn),
      fitEs: v.optional(editableFields.fitEs),
      }),
    /**
     * Remove a colorway or size even when its SKUs still hold stock: those units are
     * dropped from Available Inventory (each audited as `stock:<colorway>/<size>` → 0).
     */
    discardStock: v.optional(v.boolean()),
  },
  returns: v.object({ updatedAt: v.number() }),
  handler: async (ctx, args) => {
    const actor = actorEmail(await requireAdmin(ctx));
    const existing = await requireActiveVariant(ctx, args.variantId);
    requireVersion(existing, args.expectedUpdatedAt);
    if (args.patch.stock !== undefined && hasSkus(existing)) {
      throw new ConvexError(TEE_STOCK_EDIT_ERROR);
    }
    const { colorways: colorwayInput, ...patchRest } = args.patch;
    const teeTouched = TEE_FIELD_KEYS.some((key) => args.patch[key] !== undefined);
    const errors = validateMerged(existing, patchRest);
    let teePatch: { colorways?: Doc<"variants">["colorways"]; defaultColorway?: string } = {};
    let skuPlan: ReturnType<typeof planSkuChanges> | undefined;
    let removedColorways: string[] = [];
    let legacySeed: ReturnType<typeof distributeStock> | undefined;
    const category = args.patch.category ?? variantCategory(existing);
    const toApparel = category === "apparel" && variantCategory(existing) !== "apparel";
    if (category !== "apparel" && variantCategory(existing) === "apparel") {
      // Converting a tee back to a cap is not supported while it carries tee data.
      if (hasSkus(existing) || existing.colorways?.length || existing.sizes?.length || (await listSkus(ctx, existing.variantId)).length > 0) {
        errors.push({ field: "category", code: "mismatch" });
      }
    }
    if (teeTouched || toApparel) {
      if (category !== "apparel") {
        errors.push(...teeFieldMismatches(args.patch));
      } else {
        const colorways = colorwayInput ? fillColorwayShots(colorwayInput, existing.colorways) : (existing.colorways ?? []);
        const sizes = args.patch.sizes ?? existing.sizes ?? [];
        const defaultColorway = args.patch.defaultColorway ?? existing.defaultColorway ?? colorways[0]?.id;
        errors.push(...validateTeeOptions({ ...existing, ...args.patch, colorways, sizes, defaultColorway }));
        if (colorwayInput) teePatch = { colorways };
        if (defaultColorway !== existing.defaultColorway) teePatch.defaultColorway = defaultColorway;
        if (colorwayInput || args.patch.sizes) {
          const before = { colorways: (existing.colorways ?? []).map((c) => c.id), sizes: existing.sizes ?? [] };
          const after = { colorways: colorways.map((c) => c.id), sizes };
          const rows = await listSkus(ctx, existing.variantId);
          skuPlan = planSkuChanges(before, after, rows);
          // Legacy apparel stock (no SKUs yet) moves onto the new cells so no units are lost.
          if (rows.length === 0 && existing.stock > 0 && defaultColorway) {
            legacySeed = distributeStock(existing.stock, after.colorways, defaultColorway, sizes);
          }
          removedColorways = before.colorways.filter((id) => !after.colorways.includes(id));
        }
      }
    }
    throwIfInvalid(errors);
    if (skuPlan && skuPlan.blocked.length > 0 && !args.discardStock) {
      throw new ConvexError({ kind: "sku_in_stock", cells: skuPlan.blocked });
    }
    const discarded = skuPlan?.blocked ?? [];
    // Rows of removed colorways are deleted below, so they no longer count as the product's image.
    const keepsCatalogRow = await hasCatalogImageRow(
      ctx,
      existing.variantId,
      teePatch.defaultColorway ?? existing.defaultColorway,
      (r) => r.colorway === undefined || !removedColorways.includes(r.colorway)
    );
    if (blankImageWhileVisible(existing, patchRest, keepsCatalogRow)) {
      throw new ConvexError({ kind: "needs_image" });
    }

    const input = { ...patchRest, ...teePatch };
    const { updatedAt, ...fields } = buildVariantPatch(existing, input, nextUpdatedAt(existing, Date.now()));
    const before: Record<string, unknown> = {};
    for (const key of Object.keys(fields)) before[key] = (existing as Record<string, unknown>)[key];
    const changes = [
      ...diffFields(before, { ...before, ...fields }),
      ...discarded.map((c) => ({ field: `stock:${c.colorway}/${c.size}`, from: c.stock, to: 0 })),
    ];
    if (changes.length === 0) return { updatedAt: versionOf(existing) };

    await ctx.db.patch("variants", existing._id, { ...fields, updatedAt });
    if (skuPlan) {
      for (const cell of skuPlan.insert) {
        const seeded = legacySeed?.find((c) => c.colorway === cell.colorway && c.size === cell.size);
        await ctx.db.insert("skus", { variantId: existing.variantId, ...cell, stock: seeded?.stock ?? 0 });
      }
      for (const cell of [...skuPlan.remove, ...discarded]) {
        const sku = await getSku(ctx, existing.variantId, cell.colorway, cell.size);
        if (sku) await ctx.db.delete("skus", sku._id);
      }
      await deleteColorwayImages(ctx, existing.variantId, removedColorways);
      const fresh = await ctx.db.get("variants", existing._id);
      if (fresh) await syncTeeAggregate(ctx, fresh);
    }
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

    await deleteAllProductImages(ctx, variant.variantId);

    // A pending release job would find no row and do nothing; cancel it anyway.
    if (variant.dropReleaseJobId !== undefined) await ctx.scheduler.cancel(variant.dropReleaseJobId);
    await ctx.db.delete("variants", variant._id);
    // The legacy upload may also back a productImages row (the image migration reuses files), so it is reference-checked.
    if (variant.storageId) await scheduleFileDelete(ctx, variant.storageId);
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
