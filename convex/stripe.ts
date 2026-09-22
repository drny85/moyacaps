"use node";

import { action, internalAction } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { randomDigitString } from "./ids";
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
 * Canonical free-shipping rule: 2+ caps ship free, otherwise flat $8 US express.
 * Single source of truth for all checkout paths.
 */
export const FREE_SHIPPING_THRESHOLD_CAPS = 2;
export const FLAT_SHIPPING_FEE_USD = 8;

export function computeShipping(totalUnits: number): { freeShipping: boolean; shippingFee: number } {
  const freeShipping = totalUnits >= FREE_SHIPPING_THRESHOLD_CAPS;
  return { freeShipping, shippingFee: freeShipping ? 0 : FLAT_SHIPPING_FEE_USD };
}

type CheckoutLineItemInput = {
  variantId: string;
  name: string;
  quantity: number;
  price: number;
  image: string;
  taxCode?: string;
  category?: string;
  silhouette?: string;
};

/**
 * Builds Stripe line items from DB-verified order items. Shared by direct checkout,
 * WhatsApp lead creation, and payment-link refresh so the three can never drift.
 */
function buildLineItems(
  items: CheckoutLineItemInput[],
  origin: string
): Stripe.Checkout.SessionCreateParams.LineItem[] {
  return items.map((item) => ({
    price_data: {
      currency: "usd",
      product_data: {
        name: `Good Luck 0880 — ${item.name}`,
        images: [item.image.startsWith("http") ? item.image : `${origin}${item.image}`],
        tax_code: resolveProductTaxCode(item),
        metadata: {
          variantId: item.variantId,
        },
      },
      unit_amount: Math.round(item.price * 100),
    },
    quantity: item.quantity,
  }));
}

/**
 * Single shipping option with free/paid presentation. Shared across checkout paths.
 */
function buildShippingOptions(
  shippingFee: number,
  freeShipping: boolean,
  withDeliveryEstimate: boolean
): Stripe.Checkout.SessionCreateParams.ShippingOption[] {
  const shippingRate: Stripe.Checkout.SessionCreateParams.ShippingOption.ShippingRateData = {
    type: "fixed_amount",
    fixed_amount: {
      amount: Math.round(shippingFee * 100),
      currency: "usd",
    },
    display_name: freeShipping ? "Free US Express Delivery" : "US Tracked Express Courier",
    tax_code: "txcd_92010001", // Shipping / delivery fee
    tax_behavior: "exclusive",
  };
  if (withDeliveryEstimate) {
    shippingRate.delivery_estimate = {
      minimum: { unit: "business_day", value: 2 },
      maximum: { unit: "business_day", value: 4 },
    };
  }
  return [{ shipping_rate_data: shippingRate }];
}

/**
 * Compact items representation to stay strictly under Stripe's 500-char metadata limit.
 */
function compactItemsMetadata(
  items: Array<{ variantId: string; quantity: number; price: number }>
): string {
  return JSON.stringify(
    items.map((item) => ({
      v: item.variantId,
      q: item.quantity,
      p: item.price,
    }))
  );
}

/**
 * Idempotent Stripe Customer resolution: reuse an existing customer by email so repeated
 * leads/refreshes don't bloat the customer directory with duplicate objects.
 */
async function upsertStripeCustomer(
  stripe: Stripe,
  params: {
    name?: string;
    phone?: string;
    email?: string;
    address?: Stripe.AddressParam | undefined;
    orderNumber: string;
    clerkUserId?: string;
  }
): Promise<string | undefined> {
  try {
    if (params.email) {
      const existing = await stripe.customers.list({ email: params.email, limit: 1 });
      if (existing.data.length > 0) {
        const reused = existing.data[0];
        // Keep contact fields fresh on the reused object (best effort).
        try {
          await stripe.customers.update(reused.id, {
            name: params.name || undefined,
            phone: params.phone || undefined,
          });
        } catch {
          /* non-fatal */
        }
        return reused.id;
      }
    }

    const customerParams: Stripe.CustomerCreateParams = {
      name: params.name || undefined,
      phone: params.phone || undefined,
      email: params.email || undefined,
      metadata: {
        orderNumber: params.orderNumber,
        clerkUserId: params.clerkUserId || "",
      },
    };
    if (params.address) {
      customerParams.address = params.address;
      customerParams.shipping = {
        name: params.name || "Customer",
        phone: params.phone || undefined,
        address: params.address,
      };
    }
    const created = await stripe.customers.create(customerParams);
    return created.id;
  } catch (custErr) {
    console.warn("Could not resolve Stripe customer:", custErr);
    return undefined;
  }
}

function toStripeAddress(
  addr: { line1: string; line2?: string; city: string; state: string; postalCode: string } | undefined | null
): Stripe.AddressParam | undefined {
  if (!addr || !addr.line1) return undefined;
  return {
    line1: addr.line1,
    line2: addr.line2 || undefined,
    city: addr.city,
    state: addr.state,
    postal_code: addr.postalCode,
    country: "US",
  };
}

/**
 * Expire all still-open Stripe Checkout sessions recorded for an order. Best effort:
 * paid/open sessions and network errors are tolerated (idempotent across retries).
 */
async function expireSessionsForIds(
  stripe: Stripe,
  sessionIds: string[]
): Promise<{ expired: string[]; skipped: string[] }> {
  const expired: string[] = [];
  const skipped: string[] = [];
  for (const sessionId of sessionIds) {
    if (!sessionId.startsWith("cs_")) {
      skipped.push(sessionId);
      continue;
    }
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.status === "open") {
        await stripe.checkout.sessions.expire(sessionId);
        expired.push(sessionId);
      } else {
        skipped.push(sessionId);
      }
    } catch (err: any) {
      console.warn(`Could not expire Stripe session ${sessionId}:`, err?.message || err);
      skipped.push(sessionId);
    }
  }
  return { expired, skipped };
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
        // No invented fallback prices: use the price stored in the compact metadata, else
        // the live DB price. Zero only if the variant vanished AND no price was recorded.
        const storedPrice = typeof i.price === "number" ? i.price : typeof i.p === "number" ? i.p : undefined;
        const variant = await ctx.runQuery(api.products.getVariantById, { variantId: vid });
        const price = storedPrice ?? variant?.priceUsd;
        if (price === undefined) {
          console.error(`hydrateOrderItems: no price available for variant ${vid}; using 0 — flag for review.`);
        }
        return {
          variantId: vid,
          name: variant?.nameEn || i.name || vid,
          price: price ?? 0,
          quantity: qty,
          image: variant?.image || i.image || "",
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

    const { freeShipping, shippingFee } = computeShipping(totalItems);
    const total = subtotal + shippingFee;

    const orderNumber = `GL-${Date.now().toString(36).toUpperCase()}-${randomDigitString(4)}`;
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create(
      {
        payment_method_types: ["card", "link"],
        line_items: buildLineItems(validatedItems, args.origin),
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
        shipping_options: buildShippingOptions(shippingFee, freeShipping, true),
        success_url: `${args.origin}/${args.locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_number=${orderNumber}`,
        cancel_url: `${args.origin}/${args.locale}?canceled=true`,
        client_reference_id: orderNumber,
        metadata: {
          orderNumber,
          clerkUserId: resolvedClerkId || "",
          currency: args.currency,
          subtotal: subtotal.toString(),
          shippingFee: shippingFee.toString(),
          total: total.toString(),
          isWhatsAppOrder: "false",
          itemsJson: compactItemsMetadata(validatedItems),
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
    customerPhone: v.optional(v.string()),
    customerEmail: v.string(),
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
    currency: v.string(),
    locale: v.string(),
    origin: v.string(),
    clerkUserId: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    orderId: Id<"orders">;
    orderNumber: string;
    paymentUrl: string | null;
    reservationExpiresAt: number;
    subtotal: number;
    shippingFee: number;
    total: number;
    items: Array<{ name: string; quantity: number; price: number }>;
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

    const { freeShipping, shippingFee } = computeShipping(totalItems);
    const total = subtotal + shippingFee;

    const stripe = getStripe();

    // 1. Resolve/reuse Stripe customer (by email) and create the payment session FIRST.
    //    If Stripe fails, nothing is reserved and the customer sees a clean error.
    const customerId = await upsertStripeCustomer(stripe, {
      name: args.customerName,
      phone: args.customerPhone,
      email: args.customerEmail,
      address: toStripeAddress(args.shippingAddress),
      orderNumber: "PENDING",
      clerkUserId: args.clerkUserId,
    });

    // Session expires 2 minutes before 24 hours (Stripe limit is strictly < 24h)
    const sessionExpiresAt = Math.floor(Date.now() / 1000) + 24 * 3600 - 120;

    let session: Stripe.Response<Stripe.Checkout.Session>;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card", "link"],
        line_items: buildLineItems(validatedItems, args.origin),
        mode: "payment",
        expires_at: sessionExpiresAt,
        customer: customerId,
        customer_update: customerId
          ? {
            shipping: "auto",
            address: "auto",
            name: "auto",
          }
          : undefined,
        customer_email: customerId ? undefined : (args.customerEmail || undefined),
        billing_address_collection: "auto",
        shipping_address_collection: {
          allowed_countries: ["US"],
        },
        phone_number_collection: {
          enabled: true,
        },
        automatic_tax: {
          enabled: true,
        },
        shipping_options: buildShippingOptions(shippingFee, freeShipping, false),
        success_url: `${args.origin}/${args.locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${args.origin}/${args.locale}?canceled=true`,
        metadata: {
          clerkUserId: args.clerkUserId || "",
          currency: "USD",
          subtotal: subtotal.toString(),
          shippingFee: shippingFee.toString(),
          total: total.toString(),
          isWhatsAppOrder: "true",
          itemsJson: compactItemsMetadata(validatedItems),
        },
      });
    } catch (err: any) {
      console.error("Stripe session creation failed for WhatsApp lead:", err);
      throw new ConvexError("PAYMENT_LINK_FAILED");
    }

    // 2. Create the WhatsApp Order Lead in Convex (reserves inventory for 24 hours),
    //    carrying the freshly created session so the order is never left link-less.
    const orderLead: {
      orderId: Id<"orders">;
      orderNumber: string;
      reservationExpiresAt: number;
      subtotal: number;
      shippingFee: number;
      total: number;
      items: CheckoutLineItemInput[];
    } = await ctx.runMutation(internal.orders.createWhatsAppOrderLead, {
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
      paymentUrl: session.url || undefined,
      stripeSessionId: session.id,
    });

    // 3. Backfill order-scoped session metadata (order number now known) so the webhook can
    //    match this session to the lead via metadata.orderNumber.
    try {
      await stripe.checkout.sessions.update(session.id, {
        metadata: {
          orderNumber: orderLead.orderNumber,
          clerkUserId: args.clerkUserId || "",
          currency: "USD",
          subtotal: orderLead.subtotal.toString(),
          shippingFee: orderLead.shippingFee.toString(),
          total: orderLead.total.toString(),
          isWhatsAppOrder: "true",
          itemsJson: compactItemsMetadata(orderLead.items),
        },
      });
    } catch (err) {
      console.warn("Could not backfill Stripe session metadata with order number:", err);
    }

    if (customerId) {
      await ctx.runMutation(internal.orders.attachStripeCustomerInternal, {
        orderId: orderLead.orderId,
        stripeCustomerId: customerId,
      });
    }

    await ctx.runMutation(internal.orders.recordPaymentEvent, {
      orderId: orderLead.orderId,
      orderNumber: orderLead.orderNumber,
      type: "link_generated",
      stripeSessionId: session.id,
      actor: args.customerEmail,
      details: "Pre-generated checkout session attached to new WhatsApp lead.",
    });

    // Canonical server-verified amounts + items for customer-facing messaging.
    return {
      orderId: orderLead.orderId,
      orderNumber: orderLead.orderNumber,
      paymentUrl: session.url || null,
      reservationExpiresAt: orderLead.reservationExpiresAt,
      subtotal: orderLead.subtotal,
      shippingFee: orderLead.shippingFee,
      total: orderLead.total,
      items: orderLead.items.map((i) => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
      })),
    };
  },
});

/**
 * Regenerates or refreshes a Stripe Checkout payment link for an existing WhatsApp order,
 * ensuring the destination shipping address is pre-filled and automatic sales tax is computed.
 */
export const generateOrRefreshWhatsAppPaymentLink = action({
  args: {
    orderId: v.id("orders"),
    origin: v.string(),
    locale: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    paymentUrl: string | null;
    stripeSessionId?: string;
  }> => {
    const order: any = await ctx.runQuery(internal.orders.getOrderByIdInternal, {
      orderId: args.orderId,
    });
    if (!order) {
      throw new Error("Order not found");
    }

    // STRICT ADMIN GATE: this action returns a live, chargeable payment URL.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthorized: Staff authentication required.");
    }
    const adminUser = await ctx.runQuery(api.users.getUserByClerkId, {
      clerkId: identity.subject,
    });
    if (adminUser?.role !== "admin") {
      throw new ConvexError("Unauthorized: Administrative privileges required.");
    }

    // Authorization happens in the caller (admin panel); defense in depth: only unsettled
    // WhatsApp reservations may receive a payment link, and settled orders must never
    // receive a fresh chargeable session.
    if (order.status !== "whatsapp_initiated") {
      throw new ConvexError(`Cannot generate a payment link for an order in status ${order.status}.`);
    }

    const stripe = getStripe();

    // M3: expire every previously-issued OPEN session first so customers cannot pay an
    // orphaned link the panel no longer shows. Paid sessions are skipped by the helper.
    const priorSessionIds = [
      ...(order.stripeSessionIds || []),
      ...(order.stripeSessionId && !(order.stripeSessionIds || []).includes(order.stripeSessionId)
        ? [order.stripeSessionId]
        : []),
    ];
    if (priorSessionIds.length > 0) {
      await expireSessionsForIds(stripe, priorSessionIds);
    }

    const items: CheckoutLineItemInput[] = order.items || [];
    const totalCaps = items.reduce((acc: number, i: any) => acc + i.quantity, 0);
    const { freeShipping } = computeShipping(totalCaps);
    const shippingFee = order.shippingFee ?? computeShipping(totalCaps).shippingFee;
    const subtotal = order.subtotal ?? items.reduce((acc: number, i: any) => acc + i.price * i.quantity, 0);
    const total = subtotal + shippingFee;

    const customerId =
      order.stripeCustomerId ||
      (await upsertStripeCustomer(stripe, {
        name: order.customerName || undefined,
        phone: order.customerPhone || undefined,
        email: order.customerEmail || undefined,
        address: toStripeAddress(order.shippingAddress),
        orderNumber: order.orderNumber,
        clerkUserId: order.clerkUserId || undefined,
      }));

    const sessionExpiresAt = Math.floor(Date.now() / 1000) + 24 * 3600 - 120;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "link"],
      line_items: buildLineItems(items, args.origin),
      mode: "payment",
      expires_at: sessionExpiresAt,
      customer: customerId,
      customer_update: customerId
        ? {
          shipping: "auto",
          address: "auto",
          name: "auto",
        }
        : undefined,
      customer_email: customerId ? undefined : (order.customerEmail || undefined),
      billing_address_collection: "auto",
      shipping_address_collection: {
        allowed_countries: ["US"],
      },
      phone_number_collection: {
        enabled: true,
      },
      automatic_tax: {
        enabled: true,
      },
      shipping_options: buildShippingOptions(shippingFee, freeShipping, false),
      success_url: `${args.origin}/${args.locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_number=${order.orderNumber}`,
      cancel_url: `${args.origin}/${args.locale}?canceled=true`,
      client_reference_id: order.orderNumber,
      metadata: {
        orderNumber: order.orderNumber,
        clerkUserId: order.clerkUserId || "",
        currency: "USD",
        subtotal: subtotal.toString(),
        shippingFee: shippingFee.toString(),
        total: total.toString(),
        isWhatsAppOrder: "true",
        itemsJson: compactItemsMetadata(items),
      },
    });

    if (session.url) {
      await ctx.runMutation(internal.orders.updateOrderPaymentUrl, {
        orderId: order._id,
        paymentUrl: session.url,
        stripeSessionId: session.id,
      });
    }
    if (customerId && !order.stripeCustomerId) {
      await ctx.runMutation(internal.orders.attachStripeCustomerInternal, {
        orderId: order._id,
        stripeCustomerId: customerId,
      });
    }

    await ctx.runMutation(internal.orders.recordPaymentEvent, {
      orderId: order._id,
      orderNumber: order.orderNumber,
      type: "link_generated",
      stripeSessionId: session.id,
      details: `Refreshed link; expired prior open sessions: ${priorSessionIds.join(", ") || "none"}`,
    });

    return {
      paymentUrl: session.url,
      stripeSessionId: session.id,
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
    } = await ctx.runMutation(internal.orders.cancelOrder, {
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
    } = await ctx.runMutation(internal.orders.cancelOrderAdmin, {
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

    // S8 gate: only accept sessions that carry this app's own checkout contract. A paid
    // session with no order contract is rejected, so this repair path cannot be used to
    // mint orders for unrelated session ids.
    const metadata = session.metadata || {};
    const isWhatsAppOrder = metadata.isWhatsAppOrder === "true";
    if (!metadata.orderNumber || !metadata.itemsJson) {
      return { success: false, status: "unrecognized_session" };
    }

    if (isWhatsAppOrder) {
      // WhatsApp leads must already exist in the DB; the webhook owns their settlement.
      const existing = await ctx.runQuery(internal.orders.getOrderByNumberInternal, {
        orderNumber: metadata.orderNumber,
      });
      if (!existing) {
        return { success: false, status: "unknown_order" };
      }
    }

    if (session.payment_status === "paid") {
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
        isWhatsAppOrder,
      });

      return { success: true, orderId, status: "paid" };
    }

    return { success: false, status: session.payment_status };
  },
});

/**
 * INTERNAL Stripe webhook processor. Signature-verified, replay-deduped, with coverage for
 * the settlement lifecycle: completed / async_payment_failed / expired / refunded / disputes.
 */
export const fulfillStripeWebhook = internalAction({
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

    if (
      event.type !== "checkout.session.completed" &&
      event.type !== "checkout.session.async_payment_failed" &&
      event.type !== "checkout.session.expired" &&
      event.type !== "charge.refunded" &&
      event.type !== "charge.dispute.created" &&
      event.type !== "charge.dispute.closed"
    ) {
      // Ack unrelated events quickly (e.g. customer.created) without side effects.
      return { received: true };
    }

    // ── Settlement ──────────────────────────────────────────────────────────────
    if (event.type === "checkout.session.completed") {
      let session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_status !== "paid") {
        // completed fires only when paid for card flows; trust the retrieved status.
        session = await stripe.checkout.sessions.retrieve(session.id, {
          expand: ["total_details.breakdown"],
        });
        if (session.payment_status !== "paid") return { received: true };
      }

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
        orderNumber: metadata.orderNumber || session.client_reference_id || `GL-${session.id.slice(-8).toUpperCase()}`,
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
        webhookEventId: event.id,
        isWhatsAppOrder: metadata.isWhatsAppOrder === "true",
      });
      return { received: true };
    }

    // ── Non-settlement lifecycle: link every session-shaped event to its order ──
    let sessionId: string | undefined;
    if (
      event.type === "checkout.session.expired" ||
      event.type === "checkout.session.async_payment_failed"
    ) {
      sessionId = (event.data.object as Stripe.Checkout.Session).id;
    } else if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      sessionId = (charge as any).checkout_session || undefined;
    } else {
      const dispute = event.data.object as Stripe.Dispute;
      if (dispute.payment_intent) {
        const pi = await stripe.paymentIntents.retrieve(dispute.payment_intent as string, {
          expand: ["charges.data.checkout_session"],
        });
        sessionId = ((pi as any)?.charges?.data?.[0]?.checkout_session as string) || undefined;
      }
    }

    if (!sessionId) return { received: true };

    // Resolve the order: current session id first, then via the session's own metadata
    // (covers refreshed links whose replaced sessions live only in bounded history).
    let order: any = await ctx.runQuery(internal.orders.getOrderByStripeSessionIdInternal, {
      stripeSessionId: sessionId,
    });
    if (!order) {
      try {
        const sessionObj = await stripe.checkout.sessions.retrieve(sessionId);
        const orderNumber =
          sessionObj.metadata?.orderNumber || sessionObj.client_reference_id || undefined;
        if (orderNumber) {
          order = await ctx.runQuery(internal.orders.getOrderByNumberInternal, { orderNumber });
        }
      } catch {
        /* session not retrievable */
      }
    }

    const auditType =
      event.type === "checkout.session.expired"
        ? "session_expired"
        : event.type === "charge.refunded"
          ? "charge_refunded"
          : event.type === "charge.dispute.created"
            ? "dispute_created"
            : event.type === "charge.dispute.closed"
              ? "dispute_closed"
              : "async_payment_failed";

    if (!order) {
      console.warn(`Stripe ${event.type} for unknown session ${sessionId}; ignoring.`);
      return { received: true };
    }

    // Replay guard: skip if this exact event was already applied to the order.
    if (order.webhookEventIds?.includes(event.id)) {
      return { received: true };
    }
    await ctx.runMutation(internal.orders.recordWebhookEventIdInternal, {
      orderId: order._id,
      webhookEventId: event.id,
    });

    await ctx.runMutation(internal.orders.recordPaymentEvent, {
      orderId: order._id,
      orderNumber: order.orderNumber,
      type: auditType,
      stripeEventId: event.id,
      stripeSessionId: sessionId,
      details:
        event.type === "charge.dispute.created"
          ? `⚠️ Dispute opened on $${(
            ((event.data.object as Stripe.Dispute).amount ?? 0) / 100
          ).toFixed(2)} — respond in Stripe Dashboard.`
          : `Stripe ${event.type}`,
    });

    // Payment link expired at Stripe: if the reservation window also elapsed, release stock
    // immediately instead of waiting for the scheduled job.
    if (event.type === "checkout.session.expired" && order.status === "whatsapp_initiated") {
      await ctx.runMutation(internal.orders.expireWhatsAppOrderLead, {
        orderId: order._id,
      });
    }

    return { received: true };
  },
});

/**
 * INTERNAL: expire every still-open Stripe Checkout session recorded on an order.
 * Scheduled by Zelle settlement and cancellation flows so payment links can never outlive
 * their order state (double-charge safety).
 */
export const expireOpenCheckoutSessionsInternal = internalAction({
  args: {
    orderId: v.id("orders"),
  },
  handler: async (ctx, args): Promise<{ expired: string[]; skipped: string[] }> => {
    const order: any = await ctx.runQuery(internal.orders.getOrderByIdInternal, {
      orderId: args.orderId,
    });
    if (!order) return { expired: [], skipped: [] };

    const sessionIds = Array.from(
      new Set(
        [
          ...(order.stripeSessionIds || []),
          ...(order.stripeSessionId ? [order.stripeSessionId] : []),
        ].filter(Boolean)
      )
    );
    if (sessionIds.length === 0) return { expired: [], skipped: [] };

    const stripe = getStripe();
    const { expired, skipped } = await expireSessionsForIds(stripe, sessionIds);

    if (expired.length > 0) {
      await ctx.runMutation(internal.orders.recordPaymentEvent, {
        orderId: args.orderId,
        orderNumber: order.orderNumber,
        type: "session_expired",
        actor: "system",
        details: `Expired open checkout sessions: ${expired.join(", ")}`,
      });
    }
    return { expired, skipped };
  },
});

