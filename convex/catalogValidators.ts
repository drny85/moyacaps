/** Return validators for the catalog modules (catalog, catalogAdmin, drops, catalogMigrations). */
import { v } from "convex/values";
import schema from "./schema";

export const variantDoc = schema.doc("variants");

/** A variant with its uploaded image resolved to a URL and `isAvailable` always set. */
export const resolvedVariant = variantDoc.extend({ isAvailable: v.boolean() });

export const variantWithSubscribers = resolvedVariant.extend({ subscribersCount: v.number() });

export const dropStatusValidator = v.union(v.literal("scheduled"), v.literal("live"), v.literal("archived"));

export const adminDropRow = variantWithSubscribers.extend({ computedStatus: dropStatusValidator });

export const productPage = resolvedVariant.extend({
  skus: v.array(v.object({ colorway: v.string(), size: v.string(), stock: v.number() })),
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
