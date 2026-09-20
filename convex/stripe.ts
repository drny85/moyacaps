"use node";

import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import Stripe from "stripe";

function getStripe(): Stripe {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured in Convex environment variables.");
  }
  return new Stripe(stripeKey, {
    apiVersion: '2026-08-26.dahlia'
  });
}

export const createCheckoutSession = action({
  args: {
    items: v.array(
      v.object({
        variantId: v.string(),
        quantity: v.number(),
      })
    ),
    currency: v.string(),
    locale: v.string(),
    origin: v.string(),
    clerkUserId: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    url: string | null;
    orderNumber: string;
    sessionId: string;
  }> => {
    if (!args.items || args.items.length === 0) {
      throw new Error("Cart is empty");
    }

    // Try to resolve authenticated user identity from Clerk JWT
    let resolvedClerkId = args.clerkUserId;
    const identity = await ctx.auth.getUserIdentity();
    if (identity?.subject) {
      resolvedClerkId = identity.subject;
    }

    // Query official variants from Convex database
    const allVariants = await ctx.runQuery(api.products.getVariants, {});

    let totalItems = 0;
    let subtotal = 0;
    const validatedItems: {
      variantId: string;
      name: string;
      quantity: number;
      price: number;
      image: string;
    }[] = [];

    for (const item of args.items) {
      const variant = allVariants.find((v: any) => v.variantId === item.variantId);
      if (!variant) {
        throw new ConvexError(
          args.locale === "es"
            ? `Este modelo ya no está disponible para compra: ${item.variantId}`
            : `This product variant is no longer available for purchase: ${item.variantId}`
        );
      }

      const variantName = args.locale === "es" ? variant.nameEs : variant.nameEn;
      const stock = typeof variant.stock === "number" ? variant.stock : 0;

      if (stock <= 0) {
        throw new ConvexError(
          args.locale === "es"
            ? `La gorra "${variantName}" se encuentra agotada.`
            : `The cap "${variantName}" is sold out.`
        );
      }

      const isUpcomingDrop =
        variant.isDrop &&
        variant.dropStatus !== "live" &&
        ((typeof variant.dropDate === "number" && Date.now() < variant.dropDate) ||
          variant.dropStatus === "scheduled");

      if (isUpcomingDrop) {
        throw new ConvexError(
          args.locale === "es"
            ? `La gorra "${variantName}" es un drop VIP programado y aún no está disponible para compra.`
            : `The cap "${variantName}" is an upcoming VIP drop and is not yet available for purchase.`
        );
      }

      const qty = Math.max(1, Math.floor(item.quantity || 1));
      if (qty > stock) {
        throw new ConvexError(
          args.locale === "es"
            ? `Inventario insuficiente para "${variantName}". Solo hay ${stock} pieza(s) disponible(s).`
            : `Insufficient stock for "${variantName}". Only ${stock} unit(s) available.`
        );
      }

      const unitPrice: number = typeof variant.priceUsd === "number" ? variant.priceUsd : 120;

      totalItems += qty;
      subtotal += unitPrice * qty;

      validatedItems.push({
        variantId: variant.variantId,
        name: variantName,
        quantity: qty,
        price: unitPrice,
        image: variant.image,
      });
    }

    const freeShipping = totalItems >= 2;
    const shippingFee = freeShipping ? 0 : 8;
    const total = subtotal + shippingFee;

    const orderNumber = `MC-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const stripe = getStripe();

    const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = validatedItems.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: `Moya Caps 0880 — ${item.name}`,
          images: [item.image.startsWith("http") ? item.image : `${args.origin}${item.image}`],
          tax_code: "txcd_40030000", // Clothing Accessories: Hats & Headwear
          metadata: {
            variantId: item.variantId,
          },
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: item.quantity,
    }));

    const shippingOptions: Stripe.Checkout.SessionCreateParams.ShippingOption[] = [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: {
            amount: Math.round(shippingFee * 100),
            currency: "usd",
          },
          display_name: freeShipping ? "Free US Express Delivery" : "US Tracked Express Courier",
          tax_code: "txcd_92010001", // Shipping / delivery fee
          tax_behavior: "exclusive",
          delivery_estimate: {
            minimum: { unit: "business_day", value: 2 },
            maximum: { unit: "business_day", value: 4 },
          },
        },
      },
    ];

    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ["card", "link"],
        line_items: stripeLineItems,
        mode: "payment",
        customer_email: args.customerEmail || undefined,
        billing_address_collection: "required",
        shipping_address_collection: {
          allowed_countries: ["US"],
        },
        phone_number_collection: {
          enabled: true,
        },
        automatic_tax: {
          enabled: true,
        },
        shipping_options: shippingOptions,
        success_url: `${args.origin}/${args.locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_number=${orderNumber}`,
        cancel_url: `${args.origin}/${args.locale}?canceled=true`,
        metadata: {
          orderNumber,
          clerkUserId: resolvedClerkId || "",
          currency: args.currency,
          subtotal: subtotal.toString(),
          shippingFee: shippingFee.toString(),
          total: total.toString(),
          itemsJson: JSON.stringify(validatedItems),
        },
      },
      {
        idempotencyKey: `cs_${resolvedClerkId || args.customerEmail || "guest"}_${orderNumber}`,
      }
    );

    return {
      url: session.url,
      orderNumber,
      sessionId: session.id,
    };
  },
});

export const cancelAndRefundOrder = action({
  args: {
    orderId: v.id("orders"),
    clerkUserId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    refundIssued: boolean;
    orderNumber: string;
    message: string;
  }> => {
    // Authenticate caller
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized: Authentication required to cancel order.");
    }
    if (identity.subject !== args.clerkUserId) {
      const user = await ctx.runQuery(api.users.getUserByClerkId, {
        clerkId: identity.subject,
      });
      if (user?.role !== "admin") {
        throw new ConvexError("Forbidden: Cannot cancel another customer's order.");
      }
    }

    // 1. Cancel order in Convex and restore inventory
    const result: {
      success: boolean;
      stripeSessionId?: string;
      orderNumber: string;
      total: number;
      currency: string;
    } = await ctx.runMutation(api.orders.cancelOrder, {
      orderId: args.orderId,
      clerkUserId: args.clerkUserId,
      reason: args.reason || "Customer self-service cancellation",
    });

    // 2. Issue Stripe refund if order has stripeSessionId
    let refundIssued = false;
    if (result.stripeSessionId) {
      try {
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(result.stripeSessionId);

        if (session.payment_intent) {
          await stripe.refunds.create({
            payment_intent: session.payment_intent as string,
            reason: "requested_by_customer",
            metadata: {
              orderNumber: result.orderNumber,
              clerkUserId: args.clerkUserId,
            },
          });
          refundIssued = true;
        }
      } catch (err: any) {
        console.error("Stripe refund error in Convex action:", err);
      }
    }

    return {
      success: true,
      refundIssued,
      orderNumber: result.orderNumber,
      message: refundIssued
        ? "Order cancelled and full refund sent to original payment method."
        : "Order cancelled and stock restored.",
    };
  },
});

export const cancelAndRefundOrderAdmin = action({
  args: {
    orderId: v.id("orders"),
    refundStripe: v.boolean(),
    reason: v.optional(v.string()),
    adminNotes: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    refundIssued: boolean;
    refundError?: string;
    orderNumber: string;
    message: string;
  }> => {
    // 1. Strictly verify caller has authenticated admin identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized: Staff authentication required to cancel orders.");
    }

    const adminUser = await ctx.runQuery(api.users.getUserByClerkId, {
      clerkId: identity.subject,
    });
    if (adminUser?.role !== "admin") {
      throw new ConvexError("Unauthorized: Administrative privileges required to cancel orders.");
    }

    // 2. Cancel order in Convex and restore inventory
    const result: {
      success: boolean;
      stripeSessionId?: string;
      orderNumber: string;
      total: number;
      currency: string;
      paymentMethod: string;
    } = await ctx.runMutation(api.orders.cancelOrderAdmin, {
      orderId: args.orderId,
      reason: args.reason || "Administrative cancellation",
      adminNotes: args.adminNotes,
    });

    // 3. Issue Stripe refund if requested and session exists
    let refundIssued = false;
    let refundError: string | undefined;
    if (args.refundStripe && result.stripeSessionId) {
      try {
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(result.stripeSessionId);

        if (session.payment_intent) {
          await stripe.refunds.create({
            payment_intent: session.payment_intent as string,
            reason: "requested_by_customer",
            metadata: {
              orderNumber: result.orderNumber,
              cancelledByAdmin: identity?.subject || "admin",
            },
          });
          refundIssued = true;
        }
      } catch (err: any) {
        console.error("Stripe refund error in cancelAndRefundOrderAdmin:", err);
        refundError = err?.message || "Failed to process refund on Stripe.";
      }
    }

    return {
      success: true,
      refundIssued,
      refundError,
      orderNumber: result.orderNumber,
      message: refundIssued
        ? "Order cancelled, inventory restocked, and full Stripe refund processed."
        : refundError
        ? `Order cancelled and restocked, but Stripe refund failed: ${refundError}`
        : "Order cancelled and inventory restocked without automated Stripe refund.",
    };
  },
});

export const syncCheckoutSession = action({
  args: {
    sessionId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    orderId?: any;
    status: string;
  }> => {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(args.sessionId, {
      expand: ["total_details.breakdown"],
    });

    if (session.payment_status === "paid") {
      const metadata = session.metadata || {};
      const shipping = (session as any).shipping_details || (session as any).shipping_cost;
      const address = shipping?.address || session.customer_details?.address;

      let parsedItems = [];
      try {
        if (metadata.itemsJson) {
          parsedItems = JSON.parse(metadata.itemsJson);
        }
      } catch (e) {
        console.error("Failed to parse itemsJson in syncCheckoutSession:", e);
      }

      const taxAmountCents = session.total_details?.amount_tax ?? 0;
      const taxAmount = taxAmountCents > 0 ? Number((taxAmountCents / 100).toFixed(2)) : undefined;

      let taxDetails: { amount: number; rate?: number; jurisdiction?: string } | undefined = undefined;
      if (taxAmount && taxAmount > 0) {
        const breakdownTax = session.total_details?.breakdown?.taxes?.[0];
        taxDetails = {
          amount: taxAmount,
          rate: breakdownTax?.rate?.percentage ? Number(breakdownTax.rate.percentage) : undefined,
          jurisdiction: breakdownTax?.rate?.jurisdiction || address?.state || undefined,
        };
      }

      const orderId: any = await ctx.runMutation(internal.orders.createOrUpdateStripeOrder, {
        stripeSessionId: session.id,
        orderNumber: metadata.orderNumber || `MC-${session.id.slice(-8).toUpperCase()}`,
        customerEmail: session.customer_details?.email || undefined,
        customerName: session.customer_details?.name || undefined,
        customerPhone: session.customer_details?.phone || undefined,
        clerkUserId: metadata.clerkUserId || undefined,
        shippingAddress: address
          ? {
            line1: address.line1 || "Street address",
            line2: address.line2 || undefined,
            city: address.city || "City",
            state: address.state || "",
            postalCode: address.postal_code || "",
            country: address.country || "US",
          }
          : undefined,
        items: parsedItems,
        currency: (session.currency || "usd").toUpperCase(),
        subtotal: metadata.subtotal ? Number(metadata.subtotal) : undefined,
        shippingFee: metadata.shippingFee ? Number(metadata.shippingFee) : undefined,
        tax: taxAmount,
        taxDetails: taxDetails,
        total: (session.amount_total || 0) / 100,
      });

      return { success: true, orderId, status: "paid" };
    }

    return { success: false, status: session.payment_status };
  },
});

export const fulfillStripeWebhook = action({
  args: {
    payload: v.string(),
    signature: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    received: boolean;
  }> => {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripe = getStripe();

    let event: Stripe.Event;
    if (webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(args.payload, args.signature, webhookSecret);
      } catch (err: any) {
        console.error(`Webhook signature verification failed: ${err.message}`);
        throw new Error(`Webhook Error: ${err.message}`);
      }
    } else {
      if (process.env.NODE_ENV === "production") {
        throw new Error("STRIPE_WEBHOOK_SECRET is not configured in production environment.");
      }
      // In dev or sandbox when secret is not configured, parse payload directly
      event = JSON.parse(args.payload) as Stripe.Event;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const metadata = session.metadata || {};
      const shipping = (session as any).shipping_details || (session as any).shipping_cost;
      const address = shipping?.address || session.customer_details?.address;

      let parsedItems = [];
      try {
        if (metadata.itemsJson) {
          parsedItems = JSON.parse(metadata.itemsJson);
        }
      } catch (e) {
        console.error("Failed to parse itemsJson in webhook:", e);
      }

      const taxAmountCents = session.total_details?.amount_tax ?? 0;
      const taxAmount = taxAmountCents > 0 ? Number((taxAmountCents / 100).toFixed(2)) : undefined;

      let taxDetails: { amount: number; rate?: number; jurisdiction?: string } | undefined = undefined;
      if (taxAmount && taxAmount > 0) {
        const breakdownTax = session.total_details?.breakdown?.taxes?.[0];
        taxDetails = {
          amount: taxAmount,
          rate: breakdownTax?.rate?.percentage ? Number(breakdownTax.rate.percentage) : undefined,
          jurisdiction: breakdownTax?.rate?.jurisdiction || address?.state || undefined,
        };
      }

      await ctx.runMutation(internal.orders.createOrUpdateStripeOrder, {
        stripeSessionId: session.id,
        orderNumber: metadata.orderNumber || `MC-${session.id.slice(-8).toUpperCase()}`,
        customerEmail: session.customer_details?.email || undefined,
        customerName: session.customer_details?.name || undefined,
        customerPhone: session.customer_details?.phone || undefined,
        clerkUserId: metadata.clerkUserId || undefined,
        shippingAddress: address
          ? {
            line1: address.line1 || "Street address",
            line2: address.line2 || undefined,
            city: address.city || "City",
            state: address.state || "",
            postalCode: address.postal_code || "",
            country: address.country || "US",
          }
          : undefined,
        items: parsedItems,
        currency: (session.currency || "usd").toUpperCase(),
        subtotal: metadata.subtotal ? Number(metadata.subtotal) : undefined,
        shippingFee: metadata.shippingFee ? Number(metadata.shippingFee) : undefined,
        tax: taxAmount,
        taxDetails: taxDetails,
        total: (session.amount_total || 0) / 100,
      });
    }

    return { received: true };
  },
});

