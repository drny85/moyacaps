import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  products: defineTable({
    nameEn: v.string(),
    nameEs: v.string(),
    slug: v.string(),
    collection: v.string(),
    basePriceUsd: v.number(),
    basePriceMxn: v.optional(v.number()),
    featured: v.boolean(),
  }),
  variants: defineTable({
    variantId: v.string(),
    nameEn: v.string(),
    nameEs: v.string(),
    silhouette: v.string(), // "snapback" | "trucker"
    category: v.optional(v.string()), // "headwear" | "hoodies" | "sweaters" | "apparel"
    taxCode: v.optional(v.string()), // e.g. "txcd_30060006" (hats) or "txcd_30011000" (clothing/hoodies)
    primaryHex: v.string(),
    secondaryHex: v.string(),
    image: v.string(),
    storageId: v.optional(v.id("_storage")),
    images: v.optional(v.array(v.string())),
    stock: v.number(),
    priceUsd: v.number(),
    priceMxn: v.optional(v.number()),
    isFeatured: v.boolean(),
    isAvailable: v.optional(v.boolean()),
    isDrop: v.optional(v.boolean()),
    dropDate: v.optional(v.number()), // epoch ms
    dropBadgeTextEn: v.optional(v.string()),
    dropBadgeTextEs: v.optional(v.string()),
    dropStatus: v.optional(v.union(v.literal("scheduled"), v.literal("live"), v.literal("archived"))),
  }).index("by_variantId", ["variantId"]),
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
    tax: v.optional(v.number()),
    taxDetails: v.optional(
      v.object({
        amount: v.number(),
        rate: v.optional(v.number()),
        jurisdiction: v.optional(v.string()),
      })
    ),
    total: v.number(),
    status: v.union(
      v.literal("pending"),
      v.literal("paid"),
      v.literal("dispatched"),
      v.literal("delivered"),
      v.literal("cancelled"),
      v.literal("whatsapp_initiated")
    ),
    paymentMethod: v.union(v.literal("stripe"), v.literal("whatsapp")),
    stripeSessionId: v.optional(v.string()),
    // History of every Stripe Checkout session ever issued for this order (link refreshes).
    stripeSessionIds: v.optional(v.array(v.string())),
    // Stripe Customer id (upserted by email) so identity is reused instead of recreated.
    stripeCustomerId: v.optional(v.string()),
    // Stripe event ids already processed for this order (webhook replay/dedupe guard). Bounded.
    webhookEventIds: v.optional(v.array(v.string())),
    trackingNumber: v.optional(v.string()),
    carrier: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
    paymentUrl: v.optional(v.string()),
    paymentLinkSentAt: v.optional(v.number()),
    reservationExpiresAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_orderNumber", ["orderNumber"])
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_stripeSessionId", ["stripeSessionId"])
    .index("by_status", ["status"])
    .index("by_status_and_customerEmail", ["status", "customerEmail"])
    .index("by_status_and_customerPhone", ["status", "customerPhone"])
    .index("by_customerEmail", ["customerEmail"])
    .index("by_reservationExpiresAt", ["reservationExpiresAt"])
    .index("by_createdAt", ["createdAt"]),
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("customer")),
    imageUrl: v.optional(v.string()),
    phone: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_role", ["role"]),
  payment_events: defineTable({
    orderId: v.id("orders"),
    orderNumber: v.string(),
    // lead_created | link_generated | link_dispatched | stripe_settled | zelle_settled |
    // double_settlement_attempted | session_expired | charge_refunded | dispute_created |
    // cancelled | refunded | webhook_orphan | inventory_released
    type: v.string(),
    stripeEventId: v.optional(v.string()),
    stripeSessionId: v.optional(v.string()),
    actor: v.optional(v.string()),
    details: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_stripeEventId", ["stripeEventId"]),
  drop_alerts: defineTable({
    variantId: v.string(),
    contact: v.string(), // email or WhatsApp number
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    name: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    locale: v.union(v.literal("en"), v.literal("es")),
    createdAt: v.number(),
    notifiedAt: v.optional(v.number()),
  })
    .index("by_variantId", ["variantId"])
    .index("by_variant_contact", ["variantId", "contact"])
    .index("by_createdAt", ["createdAt"]),
});
