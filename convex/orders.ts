import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const shippingAddressValidator = v.object({
  line1: v.string(),
  line2: v.optional(v.string()),
  city: v.string(),
  state: v.string(),
  postalCode: v.string(),
  country: v.string(),
});

const orderItemValidator = v.object({
  variantId: v.string(),
  name: v.string(),
  quantity: v.number(),
  price: v.number(),
  image: v.string(),
});

export const createOrder = mutation({
  args: {
    orderNumber: v.string(),
    customerEmail: v.optional(v.string()),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    shippingAddress: v.optional(shippingAddressValidator),
    items: v.array(orderItemValidator),
    currency: v.string(),
    subtotal: v.optional(v.number()),
    shippingFee: v.optional(v.number()),
    total: v.number(),
    status: v.string(),
    paymentMethod: v.string(),
    stripeSessionId: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const orderId = await ctx.db.insert("orders", {
      ...args,
      createdAt: Date.now(),
    });

    // Decrement stock if paid
    if (args.status === "paid") {
      for (const item of args.items) {
        const variant = await ctx.db
          .query("variants")
          .filter((q) => q.eq(q.field("variantId"), item.variantId))
          .first();

        if (variant && variant.stock >= item.quantity) {
          await ctx.db.patch(variant._id, {
            stock: variant.stock - item.quantity,
          });
        }
      }
    }

    return orderId;
  },
});

export const createOrUpdateStripeOrder = mutation({
  args: {
    stripeSessionId: v.string(),
    orderNumber: v.string(),
    customerEmail: v.optional(v.string()),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
    shippingAddress: v.optional(shippingAddressValidator),
    items: v.array(orderItemValidator),
    currency: v.string(),
    subtotal: v.optional(v.number()),
    shippingFee: v.optional(v.number()),
    total: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if order exists by stripeSessionId
    const existing = await ctx.db
      .query("orders")
      .withIndex("by_stripeSessionId", (q) => q.eq("stripeSessionId", args.stripeSessionId))
      .first();

    if (existing) {
      // Update with latest details and ensure paid
      await ctx.db.patch(existing._id, {
        customerEmail: args.customerEmail ?? existing.customerEmail,
        customerName: args.customerName ?? existing.customerName,
        customerPhone: args.customerPhone ?? existing.customerPhone,
        shippingAddress: args.shippingAddress ?? existing.shippingAddress,
        status: "paid",
        trackingNumber: existing.trackingNumber ?? `MC-TRK-${Math.floor(100000 + Math.random() * 900000)}`,
      });
      return existing._id;
    }

    // Insert new paid order
    const orderId = await ctx.db.insert("orders", {
      orderNumber: args.orderNumber,
      customerEmail: args.customerEmail,
      customerName: args.customerName,
      customerPhone: args.customerPhone,
      clerkUserId: args.clerkUserId,
      shippingAddress: args.shippingAddress,
      items: args.items,
      currency: args.currency,
      subtotal: args.subtotal,
      shippingFee: args.shippingFee,
      total: args.total,
      status: "paid",
      paymentMethod: "stripe",
      stripeSessionId: args.stripeSessionId,
      trackingNumber: `MC-TRK-${Math.floor(100000 + Math.random() * 900000)}`,
      createdAt: Date.now(),
    });

    // Decrement stock
    for (const item of args.items) {
      const variant = await ctx.db
        .query("variants")
        .filter((q) => q.eq(q.field("variantId"), item.variantId))
        .first();

      if (variant && variant.stock >= item.quantity) {
        await ctx.db.patch(variant._id, {
          stock: variant.stock - item.quantity,
        });
      }
    }

    return orderId;
  },
});

export const getOrderBySessionOrNumber = query({
  args: {
    identifier: v.string(),
  },
  handler: async (ctx, args) => {
    // Try by orderNumber first
    const byNumber = await ctx.db
      .query("orders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", args.identifier))
      .first();

    if (byNumber) return byNumber;

    // Try by stripeSessionId
    const bySession = await ctx.db
      .query("orders")
      .withIndex("by_stripeSessionId", (q) => q.eq("stripeSessionId", args.identifier))
      .first();

    return bySession;
  },
});

export const getOrdersByClerkId = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orders")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .order("desc")
      .collect();
  },
});

export const getOrders = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("orders").order("desc").collect();
  },
});
