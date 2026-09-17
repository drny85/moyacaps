import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  products: defineTable({
    nameEn: v.string(),
    nameEs: v.string(),
    slug: v.string(),
    collection: v.string(),
    basePriceUsd: v.number(),
    basePriceMxn: v.number(),
    featured: v.boolean(),
  }),
  variants: defineTable({
    variantId: v.string(),
    nameEn: v.string(),
    nameEs: v.string(),
    silhouette: v.string(), // "snapback" | "trucker"
    primaryHex: v.string(),
    secondaryHex: v.string(),
    image: v.string(),
    stock: v.number(),
    priceUsd: v.number(),
    priceMxn: v.number(),
    isFeatured: v.boolean(),
  }),
  orders: defineTable({
    orderNumber: v.string(),
    customerEmail: v.optional(v.string()),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    shippingAddress: v.optional(
      v.object({
        line1: v.string(),
        line2: v.optional(v.string()),
        city: v.string(),
        state: v.string(),
        postalCode: v.string(),
        country: v.string(),
      })
    ),
    items: v.array(
      v.object({
        variantId: v.string(),
        name: v.string(),
        quantity: v.number(),
        price: v.number(),
        image: v.string(),
      })
    ),
    currency: v.string(),
    subtotal: v.optional(v.number()),
    shippingFee: v.optional(v.number()),
    total: v.number(),
    status: v.string(), // "pending" | "paid" | "dispatched" | "delivered" | "cancelled" | "whatsapp_initiated"
    paymentMethod: v.string(), // "stripe" | "whatsapp"
    stripeSessionId: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_orderNumber", ["orderNumber"])
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_stripeSessionId", ["stripeSessionId"]),
});
