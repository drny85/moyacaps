import { defineSchema, defineTable } from "convex/server";
import { capAngleValidator, imageRoleValidator } from "./catalog/images/validators";
import { storedCategoryLaunchValidator } from "./settings/launch";
import { cancellationReasonValidator, fulfillmentStatusValidator, paymentStatusValidator } from "./orders/status";
import { shippingLabelValidator } from "./orders/labels";
import { pickupLocationValidator } from "./shipping/pickupPlan";
import {
  refundKindValidator,
  refundLineValidator,
  refundStatusValidator,
  returnReasonValidator,
} from "./payments/refundModel";
import { reviewLocaleValidator, reviewStatusValidator } from "./reviews/validators";
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
    // Legacy: written only when the row is created. Available Inventory lives in `variant_stock`
    // (caps) and `skus` (tees); read it through catalog/inventory.ts, which falls back to this
    // field only for a cap whose `variant_stock` row does not exist yet.
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
    // The scheduled function that releases this drop at `dropDate` (catalog/drops.ts); set while `dropStatus` is "scheduled".
    dropReleaseJobId: v.optional(v.id("_scheduled_functions")),
    // 4:5 Catalog Shot for grids and cards (ADR 0016). Tees carry one per colorway instead.
    catalogShot: v.optional(v.string()),
    // ── Heavyweight Tee fields (ADR 0015). A tee's stock is the sum of its SKUs. ──
    graphicImage: v.optional(v.string()),
    printPosition: v.optional(v.union(v.literal("front"), v.literal("back"))),
    fabricEn: v.optional(v.string()),
    fabricEs: v.optional(v.string()),
    fitEn: v.optional(v.string()),
    fitEs: v.optional(v.string()),
    defaultColorway: v.optional(v.string()),
    colorways: v.optional(
      v.array(
        v.object({
          id: v.string(),
          nameEn: v.string(),
          nameEs: v.string(),
          hex: v.string(),
          borderHex: v.string(),
          lifestyleImage: v.string(),
          catalogShot: v.string(),
        })
      )
    ),
    sizes: v.optional(v.array(v.string())),
    // Admin catalog (plan 0004)
    archivedAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    descriptionEn: v.optional(v.string()),
    descriptionEs: v.optional(v.string()),
    badgeTextEn: v.optional(v.string()),
    badgeTextEs: v.optional(v.string()),
  }).index("by_variantId", ["variantId"]),
  // Available Inventory of a product without SKUs (a Cap), kept off the variant row so a
  // checkout's stock write never rewrites, or conflicts on, the catalog document.
  variant_stock: defineTable({
    variantId: v.string(),
    stock: v.number(),
  }).index("by_variantId", ["variantId"]),
  // One purchasable Heavyweight Tee combination: Graphic Design × Apparel Colorway × size (CONTEXT.md "SKU").
  skus: defineTable({
    variantId: v.string(),
    colorway: v.string(),
    size: v.string(),
    stock: v.number(),
  }).index("by_variantId_and_colorway_and_size", ["variantId", "colorway", "size"]),
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
        // Set for Heavyweight Tees: identifies the SKU whose stock this line holds.
        colorway: v.optional(v.string()),
        size: v.optional(v.string()),
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
    // ADR 0024: where the money stands and where the package stands, independently.
    paymentStatus: paymentStatusValidator,
    fulfillmentStatus: fulfillmentStatusValidator,
    // Cancelled marker: set once, never cleared. Payment Status keeps recording refunds after it.
    cancelledAt: v.optional(v.number()),
    cancellationReason: v.optional(cancellationReasonValidator),
    paymentMethod: v.union(v.literal("stripe"), v.literal("whatsapp")),
    stripeSessionId: v.optional(v.string()),
    // History of every Stripe Checkout session ever issued for this order (link refreshes).
    stripeSessionIds: v.optional(v.array(v.string())),
    // Stripe Customer id (upserted by email) so identity is reused instead of recreated.
    stripeCustomerId: v.optional(v.string()),
    stripeInvoiceId: v.optional(v.string()),
    invoicePdfUrl: v.optional(v.string()),
    hostedInvoiceUrl: v.optional(v.string()),
    // Stripe event ids already processed for this order (webhook replay/dedupe guard). Bounded.
    webhookEventIds: v.optional(v.array(v.string())),
    refundedAmount: v.optional(v.number()),
    disputed: v.optional(v.boolean()),
    disputeDetails: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    carrier: v.optional(v.string()),
    shippingLabelUrl: v.optional(v.string()),
    shippingCarrier: v.optional(v.string()),
    shippingRateId: v.optional(v.string()),
    shippingTransactionId: v.optional(v.string()),
    shippingServiceLevel: v.optional(v.string()),
    shippingCost: v.optional(v.number()),
    shippingEstimatedDays: v.optional(v.number()),
    shippingLabelFileType: v.optional(v.string()),
    // Every label bought for the Order, oldest first (a Reship adds one). The flat shipping
    // fields above mirror the latest. Absent on Orders labelled before the history existed.
    labels: v.optional(v.array(shippingLabelValidator)),
    parcelDimensions: v.optional(
      v.object({
        length: v.number(),
        width: v.number(),
        height: v.number(),
        weight: v.number(),
        unit: v.string(),
      })
    ),
    trackingStatus: v.optional(v.string()),
    trackingStatusDetails: v.optional(v.string()),
    trackingStatusDate: v.optional(v.string()),
    trackingLocation: v.optional(v.string()),
    trackingDeliveredAt: v.optional(v.number()),
    trackingFailedAt: v.optional(v.number()),
    manualStatusOverride: v.optional(v.boolean()),
    adminNotes: v.optional(v.string()),
    paymentUrl: v.optional(v.string()),
    paymentLinkSentAt: v.optional(v.number()),
    reservationExpiresAt: v.optional(v.number()),
    // Checkout Hold (ADR 0024): when the hold placed at Pay ends (its Checkout Session's
    // expires_at, ms). Set only on card-checkout Orders created at Pay.
    checkoutHoldExpiresAt: v.optional(v.number()),
    // Set when the hold was released unpaid (Stripe reported the session expired).
    checkoutHoldReleasedAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_orderNumber", ["orderNumber"])
    .index("by_trackingNumber", ["trackingNumber"])
    .index("by_clerkUserId", ["clerkUserId"])
    .index("by_stripeSessionId", ["stripeSessionId"])
    .index("by_stripeInvoiceId", ["stripeInvoiceId"])
    .index("by_customerEmail", ["customerEmail"])
    .index("by_reservationExpiresAt", ["reservationExpiresAt"])
    .index("by_paymentStatus_and_fulfillmentStatus_and_cancelledAt", ["paymentStatus", "fulfillmentStatus", "cancelledAt"])
    .index("by_fulfillmentStatus", ["fulfillmentStatus"])
    .index("by_cancelledAt", ["cancelledAt"])
    .index("by_paymentStatus_and_cancelledAt_and_checkoutHoldExpiresAt", [
      "paymentStatus",
      "cancelledAt",
      "checkoutHoldExpiresAt",
    ])
    .index("by_createdAt", ["createdAt"]),
  // Refund ledger (plan 0008 "Money back"): one row per refund an Administrator or a Customer
  // Cancellation asked Stripe for. Reserved as pending before the Stripe call so a line is never
  // refunded beyond its quantity; Payment Status itself still comes from the charge.refunded webhook.
  order_refunds: defineTable({
    orderId: v.id("orders"),
    orderNumber: v.string(),
    kind: refundKindValidator,
    status: refundStatusValidator,
    lines: v.array(refundLineValidator),
    // Shipping fee plus its tax share, when this refund included shipping.
    shippingCents: v.number(),
    amountCents: v.number(),
    reason: v.optional(v.string()),
    returnReason: v.optional(returnReasonValidator),
    // Caller-chosen id: a double-submitted request resolves to the same row (and Stripe key).
    requestId: v.string(),
    idempotencyKey: v.string(),
    stripeRefundId: v.optional(v.string()),
    error: v.optional(v.string()),
    actor: v.string(),
    createdAt: v.number(),
    settledAt: v.optional(v.number()),
  })
    .index("by_orderId", ["orderId"])
    .index("by_requestId", ["requestId"])
    // Stripe's refund.failed / refund.updated webhooks find the row by its Stripe refund id.
    .index("by_stripeRefundId", ["stripeRefundId"]),
  // Every carrier scan Shippo reports for an Order (CONTEXT.md "Order Timeline"), newest kept,
  // at most MAX_TRACKING_EVENTS per Order (orders/timeline.ts). City and state only.
  tracking_events: defineTable({
    orderId: v.id("orders"),
    trackingNumber: v.string(),
    status: v.string(),
    statusDetails: v.optional(v.string()),
    statusDate: v.optional(v.string()),
    location: v.optional(v.string()),
    receivedAt: v.number(),
  }).index("by_orderId_and_receivedAt", ["orderId", "receivedAt"]),
  // USPS Package Pickups scheduled through Shippo (shipping/pickupPlan.ts). USPS takes one
  // request per address per day; a pickup cannot be changed in Shippo, only by calling USPS
  // with its confirmation code.
  pickups: defineTable({
    // The Administrator's local day (YYYY-MM-DD).
    pickupDate: v.string(),
    requestedStartTime: v.number(),
    requestedEndTime: v.number(),
    location: pickupLocationValidator,
    instructions: v.optional(v.string()),
    // The Priority/international packages sent to Shippo (bounded by the waiting queue).
    orderIds: v.array(v.id("orders")),
    transactionIds: v.array(v.string()),
    // Shippo's status: PENDING, CONFIRMED, ERROR or CANCELLED.
    status: v.string(),
    confirmationCode: v.optional(v.string()),
    confirmedStartTime: v.optional(v.string()),
    confirmedEndTime: v.optional(v.string()),
    cancelByTime: v.optional(v.string()),
    timezone: v.optional(v.string()),
    shippoPickupId: v.optional(v.string()),
    simulated: v.boolean(),
    actor: v.string(),
    createdAt: v.number(),
  }).index("by_pickupDate", ["pickupDate"]),
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.union(v.literal("admin"), v.literal("customer")),
    imageUrl: v.optional(v.string()),
    phone: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    deletedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.optional(v.number()),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"])
    .index("by_stripeCustomerId", ["stripeCustomerId"])
    .index("by_role", ["role"]),
  payment_events: defineTable({
    orderId: v.id("orders"),
    orderNumber: v.string(),
    // lead_created | link_generated | link_dispatched | stripe_settled | zelle_settled |
    // double_settlement_attempted | session_expired | charge_refunded | dispute_created |
    // cancelled | refunded | webhook_orphan | inventory_released | out_of_territory
    type: v.string(),
    stripeEventId: v.optional(v.string()),
    stripeSessionId: v.optional(v.string()),
    actor: v.optional(v.string()),
    details: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_order", ["orderId"])
    .index("by_stripeEventId", ["stripeEventId"]),
  // Waitlist sign-ups: a product drop (`variantId`) or a Coming Soon category (`category`, ADR 0022); exactly one is set.
  drop_alerts: defineTable({
    variantId: v.optional(v.string()),
    category: v.optional(v.union(v.literal("headwear"), v.literal("apparel"))),
    contact: v.string(), // email or WhatsApp number
    channel: v.union(v.literal("whatsapp"), v.literal("email")),
    name: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    locale: v.union(v.literal("en"), v.literal("es")),
    createdAt: v.number(),
    notifiedAt: v.optional(v.number()),
    // One-click unsubscribe (notifications/unsubscribe.ts). Optional only until
    // notifications/launchAlerts:backfillUnsubscribeTokens has run; new rows always get one.
    unsubscribeToken: v.optional(v.string()),
    unsubscribedAt: v.optional(v.number()),
  })
    .index("by_variantId", ["variantId"])
    .index("by_variant_contact", ["variantId", "contact"])
    .index("by_createdAt", ["createdAt"])
    .index("by_contact", ["contact"])
    .index("by_unsubscribeToken", ["unsubscribeToken"])
    .index("by_category_and_contact", ["category", "contact"])
    .index("by_category_and_channel_and_notifiedAt_and_unsubscribedAt", ["category", "channel", "notifiedAt", "unsubscribedAt"]),
  // Append-only audit trail of admin catalog writes. `changes` is a JSON string of FieldChange[].
  catalog_events: defineTable({
    variantId: v.optional(v.string()),
    type: v.string(),
    actor: v.string(),
    changes: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_variantId_and_createdAt", ["variantId", "createdAt"])
    .index("by_createdAt", ["createdAt"]),
  // Single-row (key "default") store-wide shipping rules; absent row means the built-in defaults.
  store_settings: defineTable({
    key: v.literal("default"),
    flatShippingFeeUsd: v.number(),
    freeShippingThresholdUnits: v.number(),
    // Category Status per category (ADR 0022); absent means every category is Live.
    categoryLaunch: v.optional(
      v.object({ headwear: storedCategoryLaunchValidator, apparel: storedCategoryLaunchValidator })
    ),
    // The Product each homepage category tile shows (variantId); absent means the built-in pick.
    homeTiles: v.optional(v.object({ headwear: v.optional(v.string()), apparel: v.optional(v.string()) })),
    updatedAt: v.number(),
  }).index("by_key", ["key"]),
  // Admin-managed product photos in Convex storage (ADR 0021). Reads fall back to legacy string fields.
  productImages: defineTable({
    variantId: v.string(),
    colorway: v.optional(v.string()),
    role: imageRoleValidator,
    angle: v.optional(capAngleValidator),
    order: v.number(),
    storageId: v.id("_storage"),
    sha256: v.string(),
    width: v.number(),
    height: v.number(),
    createdAt: v.number(),
  })
    .index("by_variantId_and_role_and_order", ["variantId", "role", "order"])
    .index("by_storageId", ["storageId"])
    .index("by_sha256", ["sha256"]),
  // Product Reviews (ADR 0028): one per Customer per variant; only published, unhidden ones count in stats.
  product_reviews: defineTable({
    variantId: v.string(),
    clerkUserId: v.string(),
    orderId: v.id("orders"),
    rating: v.number(),
    title: v.optional(v.string()),
    body: v.optional(v.string()),
    locale: reviewLocaleValidator,
    displayName: v.string(),
    boughtColorway: v.optional(v.string()),
    boughtSize: v.optional(v.string()),
    status: reviewStatusValidator,
    rejectReason: v.optional(v.string()),
    hiddenAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
  })
    .index("by_clerkUserId_and_variantId", ["clerkUserId", "variantId"])
    .index("by_variantId_and_status_and_publishedAt", ["variantId", "status", "publishedAt"])
    .index("by_status_and_updatedAt", ["status", "updatedAt"])
    .index("by_clerkUserId", ["clerkUserId"]),
  // Running totals per variant so the average never needs a scan.
  product_review_stats: defineTable({
    variantId: v.string(),
    count: v.number(),
    ratingSum: v.number(),
  }).index("by_variantId", ["variantId"]),
  // One scheduled review-invite email per Order.
  review_invites: defineTable({
    orderId: v.id("orders"),
    email: v.string(),
    sendAt: v.number(),
    sentAt: v.optional(v.number()),
    skippedReason: v.optional(v.string()),
    unsubscribeToken: v.string(),
    jobId: v.optional(v.id("_scheduled_functions")),
  })
    .index("by_orderId", ["orderId"])
    .index("by_unsubscribeToken", ["unsubscribeToken"]),
  // Emails that opted out of a kind of marketing-style email; email is normalized.
  email_optouts: defineTable({
    email: v.string(),
    kind: v.literal("review_invite"),
    createdAt: v.number(),
  }).index("by_email_and_kind", ["email", "kind"]),
});
