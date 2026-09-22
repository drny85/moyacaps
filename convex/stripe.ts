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

/**
 * Resolves the appropriate Stripe Product Tax Code (PTC).
 * - "txcd_30060006": Hats, caps, beanies, headwear
 * - "txcd_30011000": Clothing & footwear (hoodies, sweaters, sweatshirts, t-shirts, jackets)
 */
function resolveProductTaxCode(item: {
  taxCode?: string;
  category?: string;
  silhouette?: string;
  name?: string;
}): string {
  if (item.taxCode && item.taxCode.trim().length > 0) {
    return item.taxCode.trim();
  }

  const descriptor = `${item.category || ""} ${item.silhouette || ""} ${item.name || ""}`.toLowerCase();

  // General apparel (hoodies, sweaters, knitwear, jackets, shirts)
  if (
    descriptor.includes("hoodie") ||
    descriptor.includes("sweater") ||
    descriptor.includes("sweatshirt") ||
    descriptor.includes("jacket") ||
    descriptor.includes("fleece") ||
    descriptor.includes("tee") ||
    descriptor.includes("t-shirt") ||
    descriptor.includes("shirt") ||
    descriptor.includes("pant") ||
    descriptor.includes("short") ||
    descriptor.includes("clothing") ||
    descriptor.includes("apparel")
  ) {
    return "txcd_30011000"; // Clothing & Footwear
  }

  // Default to Hats & Headwear for Good Luck Caps
  return "txcd_30060006"; // Hats
}

/**
 * Extracts normalized sales tax amounts, composite rates, and jurisdictions from a Stripe session.
 */
function extractTaxInfo(
  session: Stripe.Checkout.Session,
  address?: { state?: string | null } | null
): {
  taxAmount?: number;
  taxDetails?: {
    amount: number;
    rate?: number;
    jurisdiction?: string;
  };
} {
  const taxAmountCents = session.total_details?.amount_tax ?? 0;
  const taxAmount = taxAmountCents > 0 ? Number((taxAmountCents / 100).toFixed(2)) : undefined;

  let taxDetails: { amount: number; rate?: number; jurisdiction?: string } | undefined = undefined;
  if (taxAmount && taxAmount > 0) {
    const taxesList = session.total_details?.breakdown?.taxes || [];
    const sumRate = taxesList.reduce((acc, t) => acc + (Number(t.rate?.percentage) || 0), 0);
    const jurisdictionList = Array.from(
      new Set(
        taxesList
          .map((t) => t.rate?.jurisdiction || t.rate?.display_name)
          .filter(Boolean)
      )
    );
    const jurisdiction = jurisdictionList.length > 0 ? jurisdictionList.join(", ") : address?.state || undefined;
    taxDetails = {
      amount: taxAmount,
      rate: sumRate > 0 ? Number(sumRate.toFixed(2)) : undefined,
      jurisdiction: jurisdiction || undefined,
    };
  }

  return { taxAmount, taxDetails };
}

/**
 * Hydrates line items from metadata to guarantee full product information
 * even if compact representation was used to respect Stripe's 500-char metadata limit.
 */
async function hydrateOrderItems(ctx: any, itemsJson?: string): Promise<any[]> {
  if (!itemsJson) return [];
  try {
    const raw = JSON.parse(itemsJson);
    if (!Array.isArray(raw)) return [];

    return await Promise.all(
      raw.map(async (i: any) => {
        if (i.variantId && i.name && i.price !== undefined && i.image) {
          return i;
        }
        const vid = i.variantId || i.id || i.v;
        const qty = i.quantity || i.q || 1;
        const fallbackPrice = typeof i.price === "number" ? i.price : typeof i.p === "number" ? i.p : 120;
        const variant = await ctx.runQuery(api.products.getVariantById, { variantId: vid });
        return {
          variantId: vid,
          name: variant?.nameEn || vid,
          price: variant?.priceUsd || fallbackPrice,
          quantity: qty,
          image: variant?.image || "",
        };
      })
    );
  } catch (e) {
    console.error("Failed to parse and hydrate itemsJson:", e);
    return [];
  }
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
    sessionId: string;
    orderNumber: string;
  }> => {
    if (!args.items || args.items.length === 0) {
      throw new ConvexError(
        args.locale === "es"
          ? "El carrito está vacío. Agrega gorras antes de pagar."
          : "Your cart is empty. Add caps before checking out."
      );
    }

    // Try to resolve authenticated user identity from Clerk JWT
    let resolvedClerkId = args.clerkUserId;
    const identity = await ctx.auth.getUserIdentity();
    if (identity?.subject) {
      resolvedClerkId = identity.subject;
    }

    let subtotal = 0;
    let totalItems = 0;
    const validatedItems: {
      variantId: string;
      name: string;
      quantity: number;
      price: number;
      image: string;
      taxCode?: string;
      category?: string;
      silhouette?: string;
    }[] = [];

    // Concurrently fetch all variants to eliminate sequential network roundtrips
    const fetchedVariants = await Promise.all(
      args.items.map((item) =>
        ctx.runQuery(api.products.getVariantById, { variantId: item.variantId })
      )
    );

    for (let i = 0; i < args.items.length; i++) {
      const item = args.items[i];
      const variant = fetchedVariants[i];

      if (!variant) {
        throw new ConvexError(
          args.locale === "es"
            ? `Producto no encontrado o no disponible: ${item.variantId}`
            : `Product not found or unavailable: ${item.variantId}`
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

      // Ironclad Purchase Gate: Drop products cannot be purchased until released
      const isUpcomingDrop = Boolean(
        variant.isDrop &&
        variant.dropStatus !== "live" &&
        ((typeof variant.dropDate === "number" && Date.now() < variant.dropDate) || variant.dropStatus === "scheduled")
      );

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
        taxCode: (variant as any).taxCode,
        category: (variant as any).category,
        silhouette: variant.silhouette,
      });
    }

    const freeShipping = totalItems >= 2;
    const shippingFee = freeShipping ? 0 : 8;
    const total = subtotal + shippingFee;

    const orderNumber = `GL-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const stripe = getStripe();

    const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = validatedItems.map((item) => ({
      price_data: {
        currency: "usd",
        product_data: {
          name: `Good Luck 0880 — ${item.name}`,
          images: [item.image.startsWith("http") ? item.image : `${args.origin}${item.image}`],
          tax_code: resolveProductTaxCode(item),
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

    // Compact items representation to stay strictly under Stripe's 500-char metadata limit
    const compactItems = validatedItems.map((item) => ({
      v: item.variantId,
      q: item.quantity,
      p: item.price,
    }));

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
          itemsJson: JSON.stringify(compactItems),
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

export const createWhatsAppCheckoutSession = action({
  args: {
    items: v.array(
      v.object({
        variantId: v.string(),
        quantity: v.number(),
      })
    ),
    customerName: v.string(),
    customerPhone: v.string(),
    customerEmail: v.optional(v.string()),
    shippingAddress: v.object({
      line1: v.string(),
      line2: v.optional(v.string()),
      city: v.string(),
      state: v.string(),
      postalCode: v.string(),
      country: v.string(),
    }),
    currency: v.string(),
    locale: v.string(),
    origin: v.string(),
    clerkUserId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    orderId: any;
    orderNumber: string;
    paymentUrl: string | null;
    reservationExpiresAt?: number;
  }> => {
    if (!args.items || args.items.length === 0) {
      throw new ConvexError(
        args.locale === "es"
          ? "El carrito está vacío. Agrega gorras antes de apartar."
          : "Your bag is empty. Add caps before reserving."
      );
    }

    let subtotal = 0;
    let totalItems = 0;
    const validatedItems: {
      variantId: string;
      name: string;
      quantity: number;
      price: number;
      image: string;
      taxCode?: string;
      category?: string;
      silhouette?: string;
    }[] = [];

    const fetchedVariants = await Promise.all(
      args.items.map((item) =>
        ctx.runQuery(api.products.getVariantById, { variantId: item.variantId })
      )
    );

    for (let i = 0; i < args.items.length; i++) {
      const item = args.items[i];
      const variant = fetchedVariants[i];

      if (!variant) {
        throw new ConvexError(
          args.locale === "es"
            ? `Producto no disponible: ${item.variantId}`
            : `Product not available: ${item.variantId}`
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

      const isUpcomingDrop = Boolean(
        variant.isDrop &&
        variant.dropStatus !== "live" &&
        ((typeof variant.dropDate === "number" && Date.now() < variant.dropDate) || variant.dropStatus === "scheduled")
      );

      if (isUpcomingDrop) {
        throw new ConvexError(
          args.locale === "es"
            ? `La gorra "${variantName}" es un drop VIP programado.`
            : `The cap "${variantName}" is an upcoming VIP drop.`
        );
      }

      const qty = Math.max(1, Math.floor(item.quantity || 1));
      if (qty > stock) {
        throw new ConvexError(
          args.locale === "es"
            ? `Inventario insuficiente para "${variantName}". Solo quedan ${stock} disponible(s).`
            : `Insufficient stock for "${variantName}". Only ${stock} available.`
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
        taxCode: (variant as any).taxCode,
        category: (variant as any).category,
        silhouette: variant.silhouette,
      });
    }

    const freeShipping = totalItems >= 2;
    const shippingFee = freeShipping ? 0 : 8;
    const total = subtotal + shippingFee;

    // 1. Create WhatsApp Order Lead in Convex (reserves inventory for 24 hours)
    const orderLead = await ctx.runMutation(api.orders.createWhatsAppOrderLead, {
      items: validatedItems.map((v) => ({
        variantId: v.variantId,
        name: v.name,
        quantity: v.quantity,
        price: v.price,
        image: v.image,
      })),
      currency: "USD",
      subtotal,
      shippingFee,
      total,
      customerName: args.customerName,
      customerPhone: args.customerPhone,
      customerEmail: args.customerEmail,
      shippingAddress: args.shippingAddress,
      clerkUserId: args.clerkUserId,
    });

    let paymentUrl: string | null = null;
    let stripeSessionId: string | undefined = undefined;

    // 2. Generate Stripe Payment Link / Checkout Session for this order
    try {
      const stripe = getStripe();

      const stripeLineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = validatedItems.map((item) => ({
        price_data: {
          currency: "usd",
          product_data: {
            name: `Good Luck 0880 — ${item.name}`,
            images: [item.image.startsWith("http") ? item.image : `${args.origin}${item.image}`],
            tax_code: resolveProductTaxCode(item),
            metadata: {
              variantId: item.variantId,
            },
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      }));

      // Session expires 2 minutes before 24 hours (Stripe limit is strictly < 24h)
      const sessionExpiresAt = Math.floor(Date.now() / 1000) + 24 * 3600 - 120;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "link"],
        line_items: stripeLineItems,
        mode: "payment",
        expires_at: sessionExpiresAt,
        customer_email: args.customerEmail || undefined,
        billing_address_collection: "auto",
        shipping_options: [
          {
            shipping_rate_data: {
              type: "fixed_amount",
              fixed_amount: {
                amount: Math.round(shippingFee * 100),
                currency: "usd",
              },
              display_name: freeShipping ? "Free US Express Delivery" : "US Tracked Express Courier",
              tax_code: "txcd_92010001",
              tax_behavior: "exclusive",
            },
          },
        ],
        success_url: `${args.origin}/${args.locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_number=${orderLead.orderNumber}`,
        cancel_url: `${args.origin}/${args.locale}?canceled=true`,
        client_reference_id: orderLead.orderNumber,
        metadata: {
          orderNumber: orderLead.orderNumber,
          clerkUserId: args.clerkUserId || "",
          currency: "USD",
          subtotal: subtotal.toString(),
          shippingFee: shippingFee.toString(),
          total: total.toString(),
          isWhatsAppOrder: "true",
        },
      });

      paymentUrl = session.url;
      stripeSessionId = session.id;

      if (session.url) {
        await ctx.runMutation(api.orders.updateOrderPaymentUrl, {
          orderId: orderLead.orderId,
          paymentUrl: session.url,
          stripeSessionId: session.id,
        });
      }
    } catch (err) {
      console.warn("Stripe session creation bypassed for WhatsApp lead:", err);
    }

    return {
      orderId: orderLead.orderId,
      orderNumber: orderLead.orderNumber,
      paymentUrl,
      reservationExpiresAt: orderLead.reservationExpiresAt,
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

      const parsedItems = await hydrateOrderItems(ctx, metadata.itemsJson);
      const { taxAmount, taxDetails } = extractTaxInfo(session, address);

      const orderId: any = await ctx.runMutation(internal.orders.createOrUpdateStripeOrder, {
        stripeSessionId: session.id,
        orderNumber: metadata.orderNumber || `GL-${session.id.slice(-8).toUpperCase()}`,
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
      let session = event.data.object as Stripe.Checkout.Session;

      // Retrieve full session with tax breakdown if not already present
      if (!session.total_details?.breakdown && session.id) {
        try {
          session = await stripe.checkout.sessions.retrieve(session.id, {
            expand: ["total_details.breakdown"],
          });
        } catch (e) {
          console.warn("Could not retrieve expanded session in webhook, continuing with payload:", e);
        }
      }

      const metadata = session.metadata || {};
      const shipping = (session as any).shipping_details || (session as any).shipping_cost;
      const address = shipping?.address || session.customer_details?.address;

      const parsedItems = await hydrateOrderItems(ctx, metadata.itemsJson);
      const { taxAmount, taxDetails } = extractTaxInfo(session, address);

      await ctx.runMutation(internal.orders.createOrUpdateStripeOrder, {
        stripeSessionId: session.id,
        orderNumber: metadata.orderNumber || `GL-${session.id.slice(-8).toUpperCase()}`,
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

