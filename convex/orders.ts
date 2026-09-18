import { mutation, query, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { requireAdmin } from "./auth";

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
    // Only administrators or verified system processes can create orders directly
    await requireAdmin(ctx);

    const orderId = await ctx.db.insert("orders", {
      ...args,
      createdAt: Date.now(),
    });

    // Decrement stock if paid
    if (args.status === "paid") {
      for (const item of args.items) {
        const variant = await ctx.db
          .query("variants")
          .withIndex("by_variantId", (q) => q.eq("variantId", item.variantId))
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

export const createOrUpdateStripeOrder = internalMutation({
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
        .withIndex("by_variantId", (q) => q.eq("variantId", item.variantId))
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

    const sanitizeOrder = (order: any) => {
      if (!order) return null;
      const { adminNotes, ...publicFields } = order;
      return publicFields;
    };

    if (byNumber) return sanitizeOrder(byNumber);

    // Try by stripeSessionId
    const bySession = await ctx.db
      .query("orders")
      .withIndex("by_stripeSessionId", (q) => q.eq("stripeSessionId", args.identifier))
      .first();

    return sanitizeOrder(bySession);
  },
});

export const getOrdersByClerkId = query({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const isSelf = identity.subject === args.clerkUserId;
    if (!isSelf) {
      await requireAdmin(ctx);
    }

    const orders = await ctx.db
      .query("orders")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", args.clerkUserId))
      .order("desc")
      .collect();

    // Customers only see confirmed purchases (never abandoned checkout drafts)
    return orders.filter((o) => o.status !== "pending");
  },
});

export const getOrders = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const orders = await ctx.db.query("orders").order("desc").collect();
    return orders.filter((o) => o.status !== "pending");
  },
});

export const cleanupPendingOrders = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const pending = await ctx.db
      .query("orders")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    for (const order of pending) {
      await ctx.db.delete(order._id);
    }
    return { deletedCount: pending.length };
  },
});

export const updateShippingAddress = mutation({
  args: {
    orderId: v.id("orders"),
    clerkUserId: v.string(),
    shippingAddress: shippingAddressValidator,
    customerPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized: Authentication required.");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError("Order not found");
    }

    const isOwner = identity.subject === args.clerkUserId && order.clerkUserId === identity.subject;
    if (!isOwner) {
      await requireAdmin(ctx);
    }

    if (order.status === "dispatched" || order.status === "delivered" || order.status === "cancelled") {
      throw new ConvexError(`Cannot modify address when order status is ${order.status}`);
    }

    await ctx.db.patch(args.orderId, {
      shippingAddress: args.shippingAddress,
      customerPhone: args.customerPhone ?? order.customerPhone,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const updateShippingAddressAdmin = mutation({
  args: {
    orderId: v.id("orders"),
    shippingAddress: shippingAddressValidator,
    customerPhone: v.optional(v.string()),
    customerName: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    await ctx.db.patch(args.orderId, {
      shippingAddress: args.shippingAddress,
      ...(args.customerPhone !== undefined && { customerPhone: args.customerPhone }),
      ...(args.customerName !== undefined && { customerName: args.customerName }),
      ...(args.customerEmail !== undefined && { customerEmail: args.customerEmail }),
      ...(args.adminNotes !== undefined && { adminNotes: args.adminNotes }),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const cancelOrder = mutation({
  args: {
    orderId: v.id("orders"),
    clerkUserId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized: Authentication required.");
    }

    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new ConvexError("Order not found");
    }

    const isOwner = identity.subject === args.clerkUserId && order.clerkUserId === identity.subject;
    if (!isOwner) {
      await requireAdmin(ctx);
    }

    if (order.status === "dispatched" || order.status === "delivered") {
      throw new ConvexError("Cannot cancel an order that has already been dispatched. Please request a return via concierge.");
    }

    if (order.status === "cancelled") {
      throw new ConvexError("Order is already cancelled");
    }

    // Restore stock in variants
    for (const item of order.items) {
      const variant = await ctx.db
        .query("variants")
        .withIndex("by_variantId", (q) => q.eq("variantId", item.variantId))
        .first();

      if (variant) {
        await ctx.db.patch(variant._id, {
          stock: variant.stock + item.quantity,
        });
      }
    }

    await ctx.db.patch(args.orderId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });

    return {
      success: true,
      stripeSessionId: order.stripeSessionId,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
    };
  },
});

export const cancelOrderAdmin = mutation({
  args: {
    orderId: v.id("orders"),
    reason: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status === "cancelled") {
      throw new Error("Order is already cancelled");
    }

    const wasPaidLike = ["paid", "dispatched", "delivered"].includes(order.status);

    // Restore stock if it was previously deducted
    if (wasPaidLike) {
      for (const item of order.items) {
        const variant = await ctx.db
          .query("variants")
          .withIndex("by_variantId", (q) => q.eq("variantId", item.variantId))
          .first();

        if (variant) {
          await ctx.db.patch(variant._id, {
            stock: variant.stock + item.quantity,
          });
        }
      }
    }

    const updatedNotes = args.adminNotes
      ? order.adminNotes
        ? `${order.adminNotes} | ${args.adminNotes}`
        : args.adminNotes
      : order.adminNotes;

    await ctx.db.patch(args.orderId, {
      status: "cancelled",
      ...(updatedNotes && { adminNotes: updatedNotes }),
      updatedAt: Date.now(),
    });

    return {
      success: true,
      stripeSessionId: order.stripeSessionId,
      orderNumber: order.orderNumber,
      total: order.total,
      currency: order.currency,
      paymentMethod: order.paymentMethod,
    };
  },
});

export const getOrderByOrderNumberAndEmail = query({
  args: {
    orderNumber: v.string(),
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const cleanNumber = args.orderNumber.trim().toUpperCase().replace(/^#/, "");
    const cleanEmail = args.email.trim().toLowerCase();

    if (!cleanNumber || !cleanEmail) {
      return null;
    }

    // Try direct uppercase match
    let order = await ctx.db
      .query("orders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", cleanNumber))
      .first();

    // If not found and input lacked "MC-" prefix, try with prefix
    if (!order && !cleanNumber.startsWith("MC-")) {
      order = await ctx.db
        .query("orders")
        .withIndex("by_orderNumber", (q) => q.eq("orderNumber", `MC-${cleanNumber}`))
        .first();
    }

    if (!order) {
      return null;
    }

    // Verify email case-insensitively
    const orderEmail = (order.customerEmail || "").trim().toLowerCase();
    if (orderEmail !== cleanEmail) {
      return null;
    }

    // Return sanitized order data (do not leak internal adminNotes to guest customer)
    return {
      _id: order._id,
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      shippingAddress: order.shippingAddress,
      items: order.items,
      currency: order.currency,
      subtotal: order.subtotal,
      shippingFee: order.shippingFee,
      total: order.total,
      status: order.status,
      paymentMethod: order.paymentMethod,
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  },
});

export const getAllOrdersAdmin = query({
  args: {
    status: v.optional(v.string()),
    paymentMethod: v.optional(v.string()),
    search: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const maxItems = Math.min(args.limit ?? 250, 500);

    let orders;
    if (args.status && args.status !== "all") {
      orders = await ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", args.status!))
        .order("desc")
        .take(maxItems);
    } else {
      orders = await ctx.db
        .query("orders")
        .order("desc")
        .take(maxItems);
    }

    if (args.paymentMethod && args.paymentMethod !== "all") {
      orders = orders.filter((o) => o.paymentMethod === args.paymentMethod);
    }

    if (args.search && args.search.trim() !== "") {
      const q = args.search.trim().toLowerCase();
      orders = orders.filter((o) => {
        return (
          o.orderNumber.toLowerCase().includes(q) ||
          (o.customerEmail && o.customerEmail.toLowerCase().includes(q)) ||
          (o.customerName && o.customerName.toLowerCase().includes(q)) ||
          (o.customerPhone && o.customerPhone.toLowerCase().includes(q)) ||
          (o.trackingNumber && o.trackingNumber.toLowerCase().includes(q)) ||
          o.items.some((item) => item.name.toLowerCase().includes(q) || item.variantId.toLowerCase().includes(q))
        );
      });
    }

    return orders;
  },
});

export const updateOrderStatusAdmin = mutation({
  args: {
    orderId: v.id("orders"),
    newStatus: v.string(), // "pending" | "paid" | "dispatched" | "delivered" | "cancelled" | "whatsapp_initiated"
    carrier: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const previousStatus = order.status;
    const isNowPaidLike = ["paid", "dispatched", "delivered"].includes(args.newStatus);
    const wasPaidLike = ["paid", "dispatched", "delivered"].includes(previousStatus);

    // 1. If transitioning to paid from an unpaid state (like whatsapp_initiated or pending), decrement stock
    if (!wasPaidLike && isNowPaidLike) {
      for (const item of order.items) {
        const variant = await ctx.db
          .query("variants")
          .withIndex("by_variantId", (q) => q.eq("variantId", item.variantId))
          .first();

        if (variant) {
          await ctx.db.patch(variant._id, {
            stock: Math.max(0, variant.stock - item.quantity),
          });
        }
      }
    }

    // 2. If cancelling an order that was previously paid-like, restore stock
    if (wasPaidLike && args.newStatus === "cancelled") {
      for (const item of order.items) {
        const variant = await ctx.db
          .query("variants")
          .withIndex("by_variantId", (q) => q.eq("variantId", item.variantId))
          .first();

        if (variant) {
          await ctx.db.patch(variant._id, {
            stock: variant.stock + item.quantity,
          });
        }
      }
    }

    // 3. Update the order document
    const updatePayload: Record<string, any> = {
      status: args.newStatus,
      updatedAt: Date.now(),
    };

    if (args.carrier !== undefined) updatePayload.carrier = args.carrier;
    if (args.trackingNumber !== undefined) updatePayload.trackingNumber = args.trackingNumber;
    if (args.adminNotes !== undefined) updatePayload.adminNotes = args.adminNotes;

    // Auto-generate tracking number if transitioning to dispatched without one
    if (args.newStatus === "dispatched" && !order.trackingNumber && !args.trackingNumber) {
      updatePayload.trackingNumber = `MC-TRK-${Math.floor(100000 + Math.random() * 900000)}`;
    }

    await ctx.db.patch(args.orderId, updatePayload);

    return { success: true, orderId: args.orderId, status: args.newStatus };
  },
});

export const updateOrderFulfillmentAdmin = mutation({
  args: {
    orderId: v.id("orders"),
    carrier: v.optional(v.string()),
    trackingNumber: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    await ctx.db.patch(args.orderId, {
      ...(args.carrier !== undefined && { carrier: args.carrier }),
      ...(args.trackingNumber !== undefined && { trackingNumber: args.trackingNumber }),
      ...(args.adminNotes !== undefined && { adminNotes: args.adminNotes }),
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const getAnalyticsAdmin = query({
  args: {
    clientTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const orders = await ctx.db.query("orders").order("desc").take(2000);
    const variants = await ctx.db.query("variants").collect();

    let totalRevenue = 0;
    let completedOrdersCount = 0;
    let stripeRevenue = 0;
    let stripeOrdersCount = 0;
    let whatsappRevenue = 0;
    let whatsappPaidCount = 0;
    let whatsappPipelineValue = 0;
    let whatsappPipelineCount = 0;

    const statusCounts: Record<string, number> = {
      pending: 0,
      paid: 0,
      dispatched: 0,
      delivered: 0,
      cancelled: 0,
      whatsapp_initiated: 0,
    };

    const variantSalesMap: Record<string, { name: string; units: number; revenue: number; image: string }> = {};

    // Grouping by last 7 days using deterministic or passed client time
    const now = args.clientTime ?? Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const dailyMap: Record<string, { date: string; revenue: number; orders: number }> = {};

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * oneDayMs);
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = { date: key, revenue: 0, orders: 0 };
    }

    for (const o of orders) {
      statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;

      const isCompleted = ["paid", "dispatched", "delivered"].includes(o.status);

      if (isCompleted) {
        totalRevenue += o.total;
        completedOrdersCount += 1;

        if (o.paymentMethod === "stripe") {
          stripeRevenue += o.total;
          stripeOrdersCount += 1;
        } else if (o.paymentMethod === "whatsapp") {
          whatsappRevenue += o.total;
          whatsappPaidCount += 1;
        }

        // Tally variant sales
        for (const item of o.items) {
          if (!variantSalesMap[item.variantId]) {
            variantSalesMap[item.variantId] = {
              name: item.name,
              units: 0,
              revenue: 0,
              image: item.image,
            };
          }
          variantSalesMap[item.variantId].units += item.quantity;
          variantSalesMap[item.variantId].revenue += item.price * item.quantity;
        }

        // Daily chart tally
        const orderDate = new Date(o.createdAt).toISOString().split("T")[0];
        if (dailyMap[orderDate]) {
          dailyMap[orderDate].revenue += o.total;
          dailyMap[orderDate].orders += 1;
        }
      } else if (o.status === "whatsapp_initiated") {
        whatsappPipelineValue += o.total;
        whatsappPipelineCount += 1;
      }
    }

    const aov = completedOrdersCount > 0 ? Math.round(totalRevenue / completedOrdersCount) : 0;

    // Sort top selling variants
    const topVariants = Object.entries(variantSalesMap)
      .map(([variantId, stats]) => ({ variantId, ...stats }))
      .sort((a, b) => b.units - a.units)
      .slice(0, 5);

    // Identify low stock and out of stock variants
    const lowStockVariants = variants
      .filter((v) => v.stock <= 5)
      .map((v) => ({
        _id: v._id,
        variantId: v.variantId,
        nameEn: v.nameEn,
        nameEs: v.nameEs,
        stock: v.stock,
        silhouette: v.silhouette,
        priceUsd: v.priceUsd,
        image: v.image,
        primaryHex: v.primaryHex,
      }))
      .sort((a, b) => a.stock - b.stock);

    const totalVariantsCount = variants.length;
    const totalInventoryUnits = variants.reduce((sum, v) => sum + v.stock, 0);

    return {
      totalRevenue,
      completedOrdersCount,
      totalOrdersCount: orders.length,
      aov,
      whatsappPipeline: {
        value: whatsappPipelineValue,
        count: whatsappPipelineCount,
      },
      paymentBreakdown: {
        stripe: { revenue: stripeRevenue, orders: stripeOrdersCount },
        whatsapp: { revenue: whatsappRevenue, orders: whatsappPaidCount },
      },
      statusCounts,
      topVariants,
      lowStockVariants,
      inventorySummary: {
        totalVariantsCount,
        totalInventoryUnits,
        outOfStockCount: variants.filter((v) => v.stock === 0).length,
      },
      dailySales: Object.values(dailyMap),
    };
  },
});

