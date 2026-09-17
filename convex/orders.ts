import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createOrder = mutation({
  args: {
    orderNumber: v.string(),
    customerEmail: v.optional(v.string()),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
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
    total: v.number(),
    status: v.string(),
    paymentMethod: v.string(),
  },
  handler: async (ctx, args) => {
    const orderId = await ctx.db.insert("orders", {
      ...args,
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

export const getOrders = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("orders").order("desc").collect();
  },
});
