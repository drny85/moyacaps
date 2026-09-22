import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
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

        if (variant) {
          await ctx.db.patch(variant._id, {
            stock: Math.max(0, variant.stock - item.quantity),
          });
        }
      }
    }

    // Schedule admin order alert if paid or whatsapp
    if (args.status === "paid" || args.paymentMethod === "whatsapp" || args.status === "whatsapp_initiated") {
      await ctx.scheduler.runAfter(0, internal.emails.sendAdminOrderAlert, {
        orderNumber: args.orderNumber,
        total: args.total,
        currency: args.currency,
        paymentMethod: args.paymentMethod,
        isWhatsAppPending: args.status === "whatsapp_initiated" || args.paymentMethod === "whatsapp",
        customerName: args.customerName,
        customerEmail: args.customerEmail,
        customerPhone: args.customerPhone,
        shippingAddress: args.shippingAddress,
        items: args.items,
        subtotal: args.subtotal,
        shippingFee: args.shippingFee,
        createdAt: Date.now(),
      });
    }

    return orderId;
  },
});

export const getOrderByIdInternal = internalQuery({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.orderId);
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
    tax: v.optional(v.number()),
    taxDetails: v.optional(
      v.object({
        amount: v.number(),
        rate: v.optional(v.number()),
        jurisdiction: v.optional(v.string()),
      })
    ),
    total: v.number(),
  },
  handler: async (ctx, args) => {
    // Check if order exists by stripeSessionId or orderNumber (e.g. GL-WA-XXXXXX)
    let existing = await ctx.db
      .query("orders")
      .withIndex("by_stripeSessionId", (q) => q.eq("stripeSessionId", args.stripeSessionId))
      .first();

    if (!existing && args.orderNumber) {
      existing = await ctx.db
        .query("orders")
        .withIndex("by_orderNumber", (q) => q.eq("orderNumber", args.orderNumber))
        .first();
    }

    if (existing) {
      // Update with latest details and ensure paid
      await ctx.db.patch(existing._id, {
        customerEmail: args.customerEmail ?? existing.customerEmail,
        customerName: args.customerName ?? existing.customerName,
        customerPhone: args.customerPhone ?? existing.customerPhone,
        shippingAddress: args.shippingAddress ?? existing.shippingAddress,
        tax: args.tax ?? existing.tax,
        taxDetails: args.taxDetails ?? existing.taxDetails,
        total: args.total ?? existing.total,
        status: "paid",
        paymentMethod: "stripe",
        stripeSessionId: args.stripeSessionId,
        trackingNumber: existing.trackingNumber ?? `GL-TRK-${Math.floor(100000 + Math.random() * 900000)}`,
        updatedAt: Date.now(),
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
      tax: args.tax,
      taxDetails: args.taxDetails,
      total: args.total,
      status: "paid",
      paymentMethod: "stripe",
      stripeSessionId: args.stripeSessionId,
      trackingNumber: `GL-TRK-${Math.floor(100000 + Math.random() * 900000)}`,
      createdAt: Date.now(),
    });

    // Decrement stock
    for (const item of args.items) {
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

    // Schedule Admin Order Alert for new paid Stripe order
    await ctx.scheduler.runAfter(0, internal.emails.sendAdminOrderAlert, {
      orderNumber: args.orderNumber,
      total: args.total,
      currency: args.currency,
      paymentMethod: "stripe",
      isWhatsAppPending: false,
      customerName: args.customerName,
      customerEmail: args.customerEmail,
      customerPhone: args.customerPhone,
      shippingAddress: args.shippingAddress,
      items: args.items,
      subtotal: args.subtotal,
      shippingFee: args.shippingFee,
      tax: args.tax,
      createdAt: Date.now(),
    });

    // Schedule Customer Order Confirmation receipt if email provided
    if (args.customerEmail && args.customerEmail.includes("@")) {
      await ctx.scheduler.runAfter(0, internal.emails.sendCustomerReceipt, {
        orderNumber: args.orderNumber,
        total: args.total,
        currency: args.currency,
        customerName: args.customerName,
        customerEmail: args.customerEmail,
        shippingAddress: args.shippingAddress,
        items: args.items,
        subtotal: args.subtotal,
        shippingFee: args.shippingFee,
        tax: args.tax,
      });
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

/**
 * Admin query to retrieve complete order details for dedicated fulfillment inspection.
 */
export const getOrderDetailAdmin = query({
  args: {
    orderNumber: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    await requireAdmin(ctx);

    const cleanNumber = args.orderNumber.trim().toUpperCase().replace(/^#/, "");
    if (!cleanNumber) return null;

    let order = await ctx.db
      .query("orders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", cleanNumber))
      .first();

    if (!order && !cleanNumber.startsWith("GL-") && !cleanNumber.startsWith("MC-")) {
      order = await ctx.db
        .query("orders")
        .withIndex("by_orderNumber", (q) => q.eq("orderNumber", `GL-${cleanNumber}`))
        .first();

      if (!order) {
        order = await ctx.db
          .query("orders")
          .withIndex("by_orderNumber", (q) => q.eq("orderNumber", `MC-${cleanNumber}`))
          .first();
      }
    }

    return order;
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

    const hadStockReserved = ["paid", "dispatched", "delivered", "whatsapp_initiated"].includes(order.status);

    // Restore stock in variants only if stock was actually reserved or deducted
    if (hadStockReserved) {
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

    const hadStockReserved = ["paid", "dispatched", "delivered", "whatsapp_initiated"].includes(order.status);

    // Restore stock if it was previously deducted or reserved
    if (hadStockReserved) {
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
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const cleanNumber = args.orderNumber.trim().toUpperCase().replace(/^#/, "");
    const cleanEmail = args.email?.trim().toLowerCase();

    if (!cleanNumber) {
      return null;
    }

    // Try direct uppercase match
    let order = await ctx.db
      .query("orders")
      .withIndex("by_orderNumber", (q) => q.eq("orderNumber", cleanNumber))
      .first();

    // If not found and input lacked prefix, try with "GL-" first, then fallback to legacy "MC-"
    if (!order && !cleanNumber.startsWith("GL-") && !cleanNumber.startsWith("MC-")) {
      order = await ctx.db
        .query("orders")
        .withIndex("by_orderNumber", (q) => q.eq("orderNumber", `GL-${cleanNumber}`))
        .first();

      if (!order) {
        order = await ctx.db
          .query("orders")
          .withIndex("by_orderNumber", (q) => q.eq("orderNumber", `MC-${cleanNumber}`))
          .first();
      }
    }

    if (!order) {
      return null;
    }

    const orderEmail = (order.customerEmail || "").trim().toLowerCase();

    // If email was provided in lookup and order has email, verify match
    if (cleanEmail && orderEmail && orderEmail !== cleanEmail) {
      return null;
    }

    // Verify authentication to gate sensitive PII (exact street address line, phone)
    const identity = await ctx.auth.getUserIdentity();
    let isOwnerOrAdmin = false;

    if (identity) {
      if (order.clerkUserId && identity.subject === order.clerkUserId) {
        isOwnerOrAdmin = true;
      } else if (identity.email && orderEmail && identity.email.toLowerCase() === orderEmail) {
        isOwnerOrAdmin = true;
      } else {
        const user = await ctx.db
          .query("users")
          .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
          .first();
        if (user) {
          if (user.role === "admin") {
            isOwnerOrAdmin = true;
          } else if (user.email && orderEmail && user.email.toLowerCase() === orderEmail) {
            isOwnerOrAdmin = true;
          }
        }
      }
    }

    // Return sanitized data: if unauthenticated, redact sensitive PII and pricing
    if (!isOwnerOrAdmin) {
      return {
        _id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        carrier: order.carrier,
        trackingNumber: order.trackingNumber,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        currency: order.currency,
        items: order.items.map((item) => ({
          variantId: item.variantId,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          image: item.image,
        })),
        shippingAddress: order.shippingAddress
          ? {
              line1: order.shippingAddress.line1 ? "***" : "",
              line2: undefined as string | undefined,
              city: order.shippingAddress.city,
              state: order.shippingAddress.state,
              postalCode: order.shippingAddress.postalCode ? "***" : "",
              country: order.shippingAddress.country,
            }
          : undefined,
        customerName: order.customerName ? order.customerName.split(" ")[0] : undefined,
        customerEmail: undefined,
        customerPhone: undefined,
        subtotal: order.subtotal,
        shippingFee: order.shippingFee,
        tax: order.tax,
        taxDetails: order.taxDetails,
        total: order.total,
        paymentMethod: order.paymentMethod,
        paymentUrl: order.paymentUrl,
        paymentLinkSentAt: order.paymentLinkSentAt,
        isGuestView: true,
      };
    }

    // Return sanitized order data for authenticated owner or admin
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
      tax: order.tax,
      taxDetails: order.taxDetails,
      total: order.total,
      status: order.status,
      paymentMethod: order.paymentMethod,
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      paymentUrl: order.paymentUrl,
      paymentLinkSentAt: order.paymentLinkSentAt,
      isGuestView: false,
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
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }
    await requireAdmin(ctx);
    const maxItems = Math.min(args.limit ?? 250, 500);

    let orders;
    if (args.status === "needs_attention") {
      const [paid, whatsapp] = await Promise.all([
        ctx.db
          .query("orders")
          .withIndex("by_status", (q) => q.eq("status", "paid"))
          .order("desc")
          .take(maxItems),
        ctx.db
          .query("orders")
          .withIndex("by_status", (q) => q.eq("status", "whatsapp_initiated"))
          .order("desc")
          .take(maxItems),
      ]);
      orders = [...paid, ...whatsapp]
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, maxItems);
    } else if (args.status === "overdue") {
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      const paid = await ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", "paid"))
        .order("desc")
        .take(maxItems);
      orders = paid.filter((o) => (o.createdAt || 0) < twentyFourHoursAgo);
    } else if (args.status && args.status !== "all") {
      orders = await ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", args.status as any))
        .order("desc")
        .take(maxItems);
    } else {
      orders = await ctx.db
        .query("orders")
        .withIndex("by_createdAt")
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

/**
 * Returns real-time counts and metrics of orders and items requiring operational attention.
 */
export const getOrdersAttentionStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    await requireAdmin(ctx);

    const now = Date.now();
    const twentyFourHoursAgo = now - 24 * 60 * 60 * 1000;

    // Utilize by_status index for targeted O(k) queries instead of scanning table
    const [paidOrders, whatsappOrders, latestOrder] = await Promise.all([
      ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", "paid"))
        .collect(),
      ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", "whatsapp_initiated"))
        .collect(),
      ctx.db
        .query("orders")
        .withIndex("by_createdAt")
        .order("desc")
        .first(),
    ]);

    const unfulfilledPaid = paidOrders.length;
    const pendingWhatsApp = whatsappOrders.length;
    const overduePaid = paidOrders.filter(
      (o) => (o.createdAt || 0) < twentyFourHoursAgo
    ).length;
    const latestOrderTimestamp = latestOrder?.createdAt || 0;

    // Low stock inventory warnings (<= 2 units remaining)
    const variants = await ctx.db.query("variants").collect();
    const lowStockVariants = variants
      .filter((v) => v.stock <= 2)
      .map((v) => ({
        variantId: v.variantId,
        nameEn: v.nameEn,
        nameEs: v.nameEs,
        stock: v.stock,
      }));

    const totalActionRequired = unfulfilledPaid + pendingWhatsApp;

    return {
      totalActionRequired,
      unfulfilledPaid,
      overduePaid,
      pendingWhatsApp,
      lowStockCount: lowStockVariants.length,
      lowStockVariants,
      latestOrderTimestamp,
    };
  },
});

/**
 * Records a customer WhatsApp checkout lead order, reserves inventory immediately,
 * and schedules a 24-hour auto-cancellation if payment is not confirmed.
 */
export const createWhatsAppOrderLead = mutation({
  args: {
    items: v.array(orderItemValidator),
    currency: v.string(),
    subtotal: v.number(),
    shippingFee: v.number(),
    total: v.number(),
    customerName: v.optional(v.string()),
    customerPhone: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    shippingAddress: v.optional(shippingAddressValidator),
    clerkUserId: v.optional(v.string()),
    paymentUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const timestamp = Date.now();

    // 1. Validate bag constraints
    if (!args.items || args.items.length === 0) {
      throw new Error("Cannot create an order with an empty bag.");
    }
    if (args.items.length > 20) {
      throw new Error("Order exceeds maximum items limit.");
    }

    const cleanPhone = args.customerPhone?.trim().slice(0, 30);
    const cleanName = args.customerName?.trim().slice(0, 100);
    const cleanEmail = args.customerEmail?.trim().toLowerCase().slice(0, 100);

    // 2. Prevent inventory hoarding: max 3 active unconfirmed leads per phone number
    if (cleanPhone) {
      const activeLeads = await ctx.db
        .query("orders")
        .withIndex("by_status", (q) => q.eq("status", "whatsapp_initiated"))
        .filter((q) => q.eq(q.field("customerPhone"), cleanPhone))
        .take(4);

      if (activeLeads.length >= 3) {
        throw new Error(
          "You already have 3 active reservations awaiting confirmation on WhatsApp. Please complete payment or wait for holds to clear."
        );
      }
    }

    // 3. Validate real-time stock, compute canonical DB prices, and decrement immediately
    let verifiedSubtotal = 0;
    let totalCaps = 0;
    const verifiedItems = [];

    for (const item of args.items) {
      if (!Number.isInteger(item.quantity) || item.quantity <= 0 || item.quantity > 10) {
        throw new Error(`Invalid quantity for ${item.name}. Must be an integer between 1 and 10.`);
      }

      const variant = await ctx.db
        .query("variants")
        .withIndex("by_variantId", (q) => q.eq("variantId", item.variantId))
        .first();

      if (!variant) {
        throw new Error(`Item ${item.name} is no longer available.`);
      }
      if (variant.isAvailable === false || variant.stock <= 0) {
        throw new Error(`"${variant.nameEn}" is currently sold out.`);
      }
      if (variant.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${variant.nameEn}. Only ${variant.stock} available.`);
      }

      await ctx.db.patch(variant._id, {
        stock: Math.max(0, variant.stock - item.quantity),
      });

      const unitPrice = variant.priceUsd;
      verifiedSubtotal += unitPrice * item.quantity;
      totalCaps += item.quantity;

      verifiedItems.push({
        variantId: variant.variantId,
        name: variant.nameEn,
        quantity: item.quantity,
        price: unitPrice,
        image: variant.image,
      });
    }

    // Domestic US Free Express Shipping threshold: 2+ caps ($0), otherwise $8
    const verifiedShippingFee = totalCaps >= 2 ? 0 : 8;
    const verifiedTotal = verifiedSubtotal + verifiedShippingFee;

    const cleanAddress = args.shippingAddress
      ? {
          line1: args.shippingAddress.line1.trim().slice(0, 150),
          line2: args.shippingAddress.line2?.trim().slice(0, 100) || undefined,
          city: args.shippingAddress.city.trim().slice(0, 100),
          state: args.shippingAddress.state.trim().toUpperCase().slice(0, 2),
          postalCode: args.shippingAddress.postalCode.trim().slice(0, 10),
          country: "US",
        }
      : undefined;

    const orderNumber = `GL-WA-${Math.floor(100000 + Math.random() * 900000)}`;
    const reservationHoldMs = 24 * 60 * 60 * 1000; // 24 hours reservation hold
    const reservationExpiresAt = timestamp + reservationHoldMs;

    const orderId = await ctx.db.insert("orders", {
      orderNumber,
      customerName: cleanName,
      customerPhone: cleanPhone,
      customerEmail: cleanEmail,
      clerkUserId: args.clerkUserId,
      shippingAddress: cleanAddress,
      items: verifiedItems,
      currency: "USD",
      subtotal: verifiedSubtotal,
      shippingFee: verifiedShippingFee,
      total: verifiedTotal,
      status: "whatsapp_initiated",
      paymentMethod: "whatsapp",
      paymentUrl: args.paymentUrl,
      reservationExpiresAt,
      createdAt: timestamp,
    });

    // Schedule 24h auto-cancellation of WhatsApp reservation if unpaid
    await ctx.scheduler.runAfter(reservationHoldMs, internal.orders.expireWhatsAppOrderLead, {
      orderId,
    });

    // Schedule Admin Order Alert for WhatsApp order
    await ctx.scheduler.runAfter(0, internal.emails.sendAdminOrderAlert, {
      orderNumber,
      total: verifiedTotal,
      currency: "USD",
      paymentMethod: "whatsapp",
      isWhatsAppPending: true,
      customerName: cleanName,
      customerEmail: cleanEmail,
      customerPhone: cleanPhone,
      shippingAddress: cleanAddress,
      items: verifiedItems,
      subtotal: verifiedSubtotal,
      shippingFee: verifiedShippingFee,
      createdAt: timestamp,
    });

    return { orderId, orderNumber, reservationExpiresAt, paymentUrl: args.paymentUrl };
  },
});

export const updateOrderPaymentUrl = mutation({
  args: {
    orderId: v.id("orders"),
    paymentUrl: v.string(),
    stripeSessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.orderId, {
      paymentUrl: args.paymentUrl,
      ...(args.stripeSessionId && { stripeSessionId: args.stripeSessionId }),
      updatedAt: Date.now(),
    });
    return { success: true };
  },
});

export const dispatchWhatsAppPaymentLinkAdmin = mutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    const now = Date.now();
    const newExpiresAt = now + 24 * 60 * 60 * 1000;

    await ctx.db.patch(args.orderId, {
      paymentLinkSentAt: now,
      reservationExpiresAt: newExpiresAt,
      updatedAt: now,
      adminNotes: `${order.adminNotes ? order.adminNotes + "\n" : ""}Payment link dispatched via WhatsApp at ${new Date(now).toISOString()}. 24h stock hold extended.`.trim(),
    });

    // Reschedule 24h expiration from link dispatch moment
    await ctx.scheduler.runAfter(24 * 60 * 60 * 1000, internal.orders.expireWhatsAppOrderLead, {
      orderId: args.orderId,
    });

    return {
      success: true,
      paymentLinkSentAt: now,
      reservationExpiresAt: newExpiresAt,
    };
  },
});

export const markWhatsAppOrderPaidAdmin = mutation({
  args: {
    orderId: v.id("orders"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const order = await ctx.db.get(args.orderId);
    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status === "paid" || order.status === "dispatched" || order.status === "delivered") {
      return { success: true, message: "Order is already marked as paid." };
    }

    const trackingNumber = order.trackingNumber || `GL-TRK-${Math.floor(100000 + Math.random() * 900000)}`;

    await ctx.db.patch(args.orderId, {
      status: "paid",
      trackingNumber,
      adminNotes: `${order.adminNotes ? order.adminNotes + "\n" : ""}Confirmed paid via WhatsApp (Zelle / Transfer). ${args.notes || ""}`.trim(),
      updatedAt: Date.now(),
    });

    // Schedule Customer Order Confirmation receipt
    if (order.customerEmail && order.customerEmail.includes("@")) {
      await ctx.scheduler.runAfter(0, internal.emails.sendCustomerReceipt, {
        orderNumber: order.orderNumber,
        total: order.total,
        currency: order.currency,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        shippingAddress: order.shippingAddress,
        items: order.items,
        subtotal: order.subtotal,
        shippingFee: order.shippingFee,
        tax: order.tax,
      });
    }

    return { success: true, orderNumber: order.orderNumber, trackingNumber };
  },
});

/**
 * Automatically releases reserved stock if a WhatsApp order lead is not confirmed within 24 hours.
 */
export const expireWhatsAppOrderLead = internalMutation({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order) return;

    // Only auto-cancel if it's still awaiting WhatsApp payment confirmation
    if (order.status === "whatsapp_initiated") {
      // Restore reserved inventory
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

      await ctx.db.patch(order._id, {
        status: "cancelled",
        adminNotes: `${order.adminNotes ? order.adminNotes + "\n" : ""}Auto-cancelled: 24-hour WhatsApp reservation hold expired without payment.`,
        updatedAt: Date.now(),
      });
    }
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

    // 1. If transitioning to paid from an unpaid state (where stock was NOT already reserved, e.g. "pending")
    if (!wasPaidLike && isNowPaidLike && previousStatus !== "whatsapp_initiated") {
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

    // 2. If cancelling an order that had stock reserved (either was paid-like or was whatsapp_initiated), restore stock
    if ((wasPaidLike || previousStatus === "whatsapp_initiated") && args.newStatus === "cancelled") {
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
      updatePayload.trackingNumber = `GL-TRK-${Math.floor(100000 + Math.random() * 900000)}`;
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

