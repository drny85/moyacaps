/** Return validators for the catalog modules (catalog, catalogAdmin, drops, catalogMigrations). */
import { v } from "convex/values";
import schema from "../schema";

export const variantDoc = schema.doc("variants");

/** A stored Apparel Colorway plus every Lifestyle Shot it has (read model only, never stored). */
const resolvedColorway = v.object({
  id: v.string(),
  nameEn: v.string(),
  nameEs: v.string(),
  hex: v.string(),
  borderHex: v.string(),
  lifestyleImage: v.string(),
  lifestyleImages: v.optional(v.array(v.string())),
  catalogShot: v.string(),
});

/** A variant with its uploaded image resolved to a URL and `isAvailable` always set. */
export const resolvedVariant = variantDoc.extend({
  isAvailable: v.boolean(),
  colorways: v.optional(v.array(resolvedColorway)),
  angles: v.optional(v.object({ front: v.string(), left: v.string(), back: v.string(), right: v.string() })),
});

export const variantWithSubscribers = resolvedVariant.extend({ subscribersCount: v.number() });

const skuStock = v.object({ colorway: v.string(), size: v.string(), stock: v.number() });

/** An admin product list row: its SKUs (empty for caps) feed the tee stock totals and the SKU matrix. */
export const adminProductRow = variantWithSubscribers.extend({ skus: v.array(skuStock) });

export const dropStatusValidator = v.union(v.literal("scheduled"), v.literal("live"), v.literal("archived"));

export const adminDropRow = variantWithSubscribers.extend({ computedStatus: dropStatusValidator });

export const productPage = resolvedVariant.extend({
  skus: v.array(skuStock),
});

/** A cart line's product: `skus` holds per-SKU stock for tees and is null for caps, which use `stock`. */
export const cartVariant = resolvedVariant.extend({
  skus: v.union(v.array(skuStock), v.null()),
});

export const lineStockResult = v.union(
  v.object({ ok: v.literal(true), available: v.number() }),
  v.object({
    ok: v.literal(false),
    reason: v.union(v.literal("not_found"), v.literal("unavailable"), v.literal("option_required"), v.literal("invalid_option")),
  })
);

export const dropSubscriberRow = v.object({
  _id: v.id("drop_alerts"),
  variantId: v.string(),
  contact: v.string(),
  channel: v.union(v.literal("whatsapp"), v.literal("email")),
  name: v.optional(v.string()),
  locale: v.union(v.literal("en"), v.literal("es")),
  createdAt: v.number(),
  notifiedAt: v.optional(v.number()),
  variantNameEn: v.string(),
  variantNameEs: v.string(),
  silhouette: v.optional(v.string()),
  dropDate: v.optional(v.number()),
  primaryHex: v.optional(v.string()),
  image: v.optional(v.string()),
});

export const successResult = v.object({ success: v.boolean() });
