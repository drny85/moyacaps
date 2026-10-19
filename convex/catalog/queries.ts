/**
 * Public catalog reads (ADR 0015): storefront grid, product pages and the per-line
 * stock check used by checkout actions.
 */
import { query, internalQuery } from "../_generated/server";
import { v } from "convex/values";
import { isAdmin } from "../lib/auth";
import { lineStockResult, productPage, resolvedVariant } from "./validators";
import { checkStock, getVariant, hasSkus, listSkus } from "./inventory";
import { filterCatalogVariants, isCustomerVisible } from "./model";
import { getCategoryLaunches } from "../settings/launch";
import { listCatalogVariants, resolveProduct } from "./shared";

export const getVariants = query({
  args: {
    silhouette: v.optional(v.string()),
    // "headwear" | "apparel"; caps seeded before categories existed count as headwear
    category: v.optional(v.string()),
    inStock: v.optional(v.boolean()),
    includeUnavailable: v.optional(v.boolean()),
  },
  returns: v.array(resolvedVariant),
  handler: async (ctx, args) => {
    // Hidden drafts (copy, storage URLs) are for Administrators only; everyone else gets the listed catalog.
    const includeUnavailable = args.includeUnavailable === true && (await isAdmin(ctx));
    const launches = await getCategoryLaunches(ctx);
    const variants = filterCatalogVariants(await listCatalogVariants(ctx), { ...args, includeUnavailable, launches });
    return await Promise.all(
      variants.map((v) => resolveProduct(ctx, v))
    );
  },
});

/** Upper bound of distinct products one cart lookup reads. */
export const MAX_CART_VARIANT_IDS = 50;

/**
 * The cart's products by id, hidden-but-not-archived ones included so the cart and checkout
 * can mark a line unavailable. Only the first `MAX_CART_VARIANT_IDS` distinct ids are read.
 */
export const getCartVariants = query({
  args: { variantIds: v.array(v.string()) },
  returns: v.array(resolvedVariant),
  handler: async (ctx, args) => {
    const wanted = [...new Set(args.variantIds)].slice(0, MAX_CART_VARIANT_IDS);
    const launches = await getCategoryLaunches(ctx);
    const out = [];
    for (const variantId of wanted) {
      const variant = await getVariant(ctx, variantId);
      if (!variant || variant.archivedAt !== undefined) continue;
      // `isAvailable` here is "can a Customer buy it now", so a gated category reads as unavailable.
      out.push({ ...(await resolveProduct(ctx, variant)), isAvailable: isCustomerVisible(variant, launches) });
    }
    return out;
  },
});

export const getVariantById = query({
  args: {
    variantId: v.string(),
    allowUnavailable: v.optional(v.boolean()),
  },
  returns: v.union(resolvedVariant, v.null()),
  handler: async (ctx, args) => {
    const variant = await getVariant(ctx, args.variantId);
    if (!variant || variant.archivedAt !== undefined) return null;
    // Hidden products and non-live categories are visible to Administrators only; the flag is ignored for everyone else.
    if (!isCustomerVisible(variant, await getCategoryLaunches(ctx)) && !(args.allowUnavailable && (await isAdmin(ctx)))) {
      return null;
    }
    return await resolveProduct(ctx, variant);
  },
});

/** One Product for its page: the variant (storage image resolved) plus SKU stock for tees. */
export const getProductBySlug = query({
  args: { slug: v.string(), allowUnavailable: v.optional(v.boolean()) },
  returns: v.union(productPage, v.null()),
  handler: async (ctx, args) => {
    const variant = await getVariant(ctx, args.slug);
    if (!variant || variant.archivedAt !== undefined) return null;
    // Hidden products and non-live categories (and their SKU stock) are visible to Administrators only.
    if (!isCustomerVisible(variant, await getCategoryLaunches(ctx)) && !(args.allowUnavailable && (await isAdmin(ctx)))) return null;
    const resolved = await resolveProduct(ctx, variant);
    const skus = hasSkus(variant)
      ? (await listSkus(ctx, variant.variantId)).map((s) => ({ colorway: s.colorway, size: s.size, stock: s.stock }))
      : [];
    return { ...resolved, skus };
  },
});

/** Per-line stock check for checkout actions: SKU stock for tees, variant stock for caps. */
export const getLineStock = internalQuery({
  args: {
    variantId: v.string(),
    colorway: v.optional(v.string()),
    size: v.optional(v.string()),
  },
  returns: lineStockResult,
  handler: async (ctx, args) => {
    const check = await checkStock(ctx, { ...args, quantity: 1 });
    return check.ok
      ? { ok: true as const, available: check.available }
      : { ok: false as const, reason: check.reason };
  },
});
