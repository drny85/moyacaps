/**
 * Public catalog reads (ADR 0015): storefront grid, product pages and the per-line
 * stock check used by checkout actions.
 */
import { query, internalQuery } from "../_generated/server";
import type { QueryCtx } from "../_generated/server";
import { heldUnits, stockKey } from "../orders/model";
import { v } from "convex/values";
import { isAdmin } from "../lib/auth";
import { cartVariant, lineStockResult, productPage, resolvedVariant } from "./validators";
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
 * can mark a line unavailable. Tees carry their SKU stock so each line clamps to its own SKU.
 * Only the first `MAX_CART_VARIANT_IDS` distinct ids are read.
 */
export const getCartVariants = query({
  args: {
    variantIds: v.array(v.string()),
    // The cart's open Checkout Session (ADR 0024): the units its hold took count as this cart's stock.
    openCheckoutSessionId: v.optional(v.string()),
  },
  returns: v.array(cartVariant),
  handler: async (ctx, args) => {
    const wanted = [...new Set(args.variantIds)].slice(0, MAX_CART_VARIANT_IDS);
    const launches = await getCategoryLaunches(ctx);
    const held = await ownHeldUnits(ctx, args.openCheckoutSessionId);
    const heldFor = (line: { variantId: string; colorway?: string; size?: string }) => held.get(stockKey(line)) ?? 0;
    const out = [];
    for (const variantId of wanted) {
      const variant = await getVariant(ctx, variantId);
      if (!variant || variant.archivedAt !== undefined) continue;
      const skus = hasSkus(variant)
        ? (await listSkus(ctx, variant.variantId)).map((s) => ({
            colorway: s.colorway,
            size: s.size,
            stock: s.stock + heldFor({ variantId, colorway: s.colorway, size: s.size }),
          }))
        : null;
      const product = await resolveProduct(ctx, variant);
      // A tee's stock is the sum of its SKUs; a cap's is its own pool.
      const stock = skus ? skus.reduce((sum, s) => sum + s.stock, 0) : product.stock + heldFor({ variantId });
      // `isAvailable` here is "can a Customer buy it now", so a gated category reads as unavailable.
      out.push({ ...product, stock, isAvailable: isCustomerVisible(variant, launches), skus });
    }
    return out;
  },
});

/** Units the open Checkout Session's hold still takes, by stock pool; empty without one. */
async function ownHeldUnits(ctx: QueryCtx, sessionId: string | undefined): Promise<Map<string, number>> {
  if (!sessionId) return new Map();
  const order = await ctx.db
    .query("orders")
    .withIndex("by_stripeSessionId", (q) => q.eq("stripeSessionId", sessionId))
    .first();
  return order ? heldUnits(order) : new Map();
}

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
