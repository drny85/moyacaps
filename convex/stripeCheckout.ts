"use node";

/**
 * Stripe Checkout session actions (ADR 0002, ADR 0010): direct card checkout, the
 * WhatsApp concierge reservation with its pre-generated payment link, link refresh,
 * and expiry of open sessions when an order no longer accepts payment.
 */
import { action, internalAction } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import type Stripe from "stripe";
import { randomDigitString } from "./ids";
import { encodeItemsMetadata } from "./checkoutMetadata";
import {
  buildLineItems,
  buildShippingOptions,
  CartLine,
  CheckoutFlow,
  CheckoutLineItemInput,
  countLabel,
  customerSessionFields,
  emptyCartError,
  INVOICE_FOOTER,
  itemSummary,
  reservationSessionExpiresAt,
  STRIPE_COLLECTION_FIELDS,
  toStripeAddress,
  validateCartLines,
} from "./checkoutModel";
import { computeShipping, orderSessionIds } from "./orderModel";
import { expireSessionsForIds, getStripe, requireAdminIdentity, upsertStripeCustomer } from "./stripeClient";
import type { ActionCtx } from "./_generated/server";

const cartLineValidator = v.object({
  variantId: v.string(),
  quantity: v.number(),
  size: v.optional(v.string()),
  colorway: v.optional(v.string()),
});

/** Validate and price a cart from live variants and per-line (per-SKU for tees) stock. */
async function priceCart(ctx: ActionCtx, items: CartLine[], locale: string, flow: CheckoutFlow) {
  if (!items || items.length === 0) {
    throw new ConvexError(emptyCartError(flow, locale));
  }
  const [variants, lineStocks] = await Promise.all([
    Promise.all(items.map((item) => ctx.runQuery(api.catalog.getVariantById, { variantId: item.variantId }))),
    Promise.all(
      items.map((item) =>
        ctx.runQuery(internal.catalog.getLineStock, {
          variantId: item.variantId,
          colorway: item.colorway,
          size: item.size,
        })
      )
    ),
  ]);
  const priced = validateCartLines(items, variants, lineStocks, { locale, flow, now: Date.now() });
  const { freeShipping, shippingFee } = computeShipping(priced.totalItems);
  return { ...priced, freeShipping, shippingFee, total: priced.subtotal + shippingFee };
}

export const createCheckoutSession = action({
  args: {
    items: v.array(cartLineValidator),
    currency: v.string(),
    locale: v.string(),
    origin: v.string(),
    clerkUserId: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
  },
  returns: v.object({ url: v.union(v.string(), v.null()), sessionId: v.string(), orderNumber: v.string() }),
  handler: async (
    ctx,
    args
  ): Promise<{
    url: string | null;
    sessionId: string;
    orderNumber: string;
  }> => {
    if (!args.items || args.items.length === 0) {
      throw new ConvexError(emptyCartError("checkout", args.locale));
    }

    // Try to resolve authenticated user identity from Clerk JWT
    let resolvedClerkId = args.clerkUserId;
    const identity = await ctx.auth.getUserIdentity();
    if (identity?.subject) {
      resolvedClerkId = identity.subject;
    }

    const { validatedItems, subtotal, totalItems, freeShipping, shippingFee, total } = await priceCart(
      ctx,
      args.items,
      args.locale,
      "checkout"
    );

    const orderNumber = `GL-${Date.now().toString(36).toUpperCase()}-${randomDigitString(4)}`;
    const stripe = getStripe();

    // Resolve or upsert customer if email is provided, so repeat buyers are deduplicated
    let customerId: string | undefined;
    if (args.customerEmail) {
      customerId = await upsertStripeCustomer(stripe, {
        email: args.customerEmail,
        orderNumber,
        clerkUserId: resolvedClerkId || undefined,
      });
    }

    const session = await stripe.checkout.sessions.create(
      {
        line_items: buildLineItems(validatedItems, args.origin),
        mode: "payment",
        invoice_creation: {
          enabled: true,
          invoice_data: {
            description: `Good Luck — Order #${orderNumber} ${countLabel(totalItems, "item")}`,
            metadata: {
              orderNumber,
              clerkUserId: resolvedClerkId || "",
              itemCount: totalItems.toString(),
            },
            footer: INVOICE_FOOTER,
          },
        },
        payment_intent_data: {
          description: `Good Luck 0880 — Order #${orderNumber} ${countLabel(totalItems, "item")}`,
          statement_descriptor_suffix: "GOODLUCK",
          metadata: {
            orderNumber,
            clerkUserId: resolvedClerkId || "",
            customerEmail: args.customerEmail || "",
            itemCount: totalItems.toString(),
            itemSummary: itemSummary(validatedItems),
            brand: "Good Luck 0880",
            storeUrl: "https://goodluckcaps.com",
          },
        },
        custom_text: {
          shipping_address: {
            message: "Please verify your delivery address carefully. Physical signature may be required for limited drops.",
          },
          submit: {
            message: "By confirming payment, you authorize Good Luck 0880 to process your bespoke order.",
          },
          after_submit: {
            message: "Thank you for securing your piece from Good Luck 0880. An order receipt and courier tracking updates will be dispatched immediately.",
          },
        },
        ...customerSessionFields(customerId, args.customerEmail),
        billing_address_collection: "required",
        ...STRIPE_COLLECTION_FIELDS,
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
          itemCount: totalItems.toString(),
          itemSummary: itemSummary(validatedItems),
          isWhatsAppOrder: "false",
          brand: "Good Luck 0880",
          ...encodeItemsMetadata(validatedItems),
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
    items: v.array(cartLineValidator),
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
  returns: v.object({
    orderId: v.id("orders"),
    orderNumber: v.string(),
    paymentUrl: v.union(v.string(), v.null()),
    reservationExpiresAt: v.number(),
    subtotal: v.number(),
    shippingFee: v.number(),
    total: v.number(),
    items: v.array(v.object({ name: v.string(), quantity: v.number(), price: v.number() })),
  }),
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
    const { validatedItems, subtotal, totalItems, freeShipping, shippingFee, total } = await priceCart(
      ctx,
      args.items,
      args.locale,
      "reservation"
    );

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

    let session: Stripe.Response<Stripe.Checkout.Session>;
    try {
      session = await stripe.checkout.sessions.create({
        line_items: buildLineItems(validatedItems, args.origin),
        mode: "payment",
        invoice_creation: {
          enabled: true,
          invoice_data: {
            description: `Good Luck 0880 — Concierge Order ${countLabel(totalItems, "cap")}`,
            metadata: {
              clerkUserId: args.clerkUserId || "",
              itemCount: totalItems.toString(),
            },
            footer: INVOICE_FOOTER,
          },
        },
        payment_intent_data: {
          description: `Good Luck 0880 — Concierge Order ${countLabel(totalItems, "item")}`,
          statement_descriptor_suffix: "GOODLUCK",
          metadata: {
            clerkUserId: args.clerkUserId || "",
            customerEmail: args.customerEmail || "",
            itemCount: totalItems.toString(),
            itemSummary: itemSummary(validatedItems),
            brand: "Good Luck 0880",
            storeUrl: "https://goodluckcaps.com",
          },
        },
        custom_text: {
          shipping_address: {
            message: "Please confirm your delivery address for your concierge order.",
          },
          submit: {
            message: "By confirming payment, you authorize Good Luck 0880 to process your concierge order.",
          },
          after_submit: {
            message: "Your concierge reservation is confirmed. Our studio team will prepare your shipment and provide direct courier tracking.",
          },
        },
        // Session expires 2 minutes before 24 hours (Stripe limit is strictly < 24h)
        expires_at: reservationSessionExpiresAt(Date.now()),
        ...customerSessionFields(customerId, args.customerEmail),
        billing_address_collection: "auto",
        ...STRIPE_COLLECTION_FIELDS,
        shipping_options: buildShippingOptions(shippingFee, freeShipping, false),
        success_url: `${args.origin}/${args.locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${args.origin}/${args.locale}?canceled=true`,
        metadata: {
          clerkUserId: args.clerkUserId || "",
          currency: "USD",
          subtotal: subtotal.toString(),
          shippingFee: shippingFee.toString(),
          total: total.toString(),
          itemCount: totalItems.toString(),
          itemSummary: itemSummary(validatedItems),
          isWhatsAppOrder: "true",
          brand: "Good Luck 0880",
          ...encodeItemsMetadata(validatedItems),
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
    } = await ctx.runMutation(internal.whatsappOrders.createWhatsAppOrderLead, {
      items: validatedItems.map((v) => ({
        variantId: v.variantId,
        name: v.name,
        quantity: v.quantity,
        price: v.price,
        image: v.image,
        ...(v.colorway ? { colorway: v.colorway } : {}),
        ...(v.size ? { size: v.size } : {}),
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
          ...encodeItemsMetadata(orderLead.items),
        },
      });
    } catch (err) {
      console.warn("Could not backfill Stripe session metadata with order number:", err);
    }

    if (customerId) {
      await ctx.runMutation(internal.orderSettlement.attachStripeCustomerInternal, {
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
  returns: v.object({ paymentUrl: v.union(v.string(), v.null()), stripeSessionId: v.optional(v.string()) }),
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
    await requireAdminIdentity(ctx, {
      unauthenticated: "Unauthorized: Staff authentication required.",
      forbidden: "Unauthorized: Administrative privileges required.",
    });

    // Authorization happens in the caller (admin panel); defense in depth: only unsettled
    // WhatsApp reservations may receive a payment link, and settled orders must never
    // receive a fresh chargeable session.
    if (order.status !== "whatsapp_initiated") {
      throw new ConvexError(`Cannot generate a payment link for an order in status ${order.status}.`);
    }

    const stripe = getStripe();

    // M3: expire every previously-issued OPEN session first so customers cannot pay an
    // orphaned link the panel no longer shows. Paid sessions are skipped by the helper.
    const priorSessionIds = orderSessionIds(order);
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

    const session = await stripe.checkout.sessions.create({
      line_items: buildLineItems(items, args.origin),
      mode: "payment",
      invoice_creation: {
        enabled: true,
        invoice_data: {
          description: `Good Luck 0880 — Order #${order.orderNumber} ${countLabel(totalCaps, "cap")}`,
          metadata: {
            orderNumber: order.orderNumber,
            clerkUserId: order.clerkUserId || "",
            itemCount: totalCaps.toString(),
          },
          footer: INVOICE_FOOTER,
        },
      },
      payment_intent_data: {
        description: `Good Luck 0880 — Order #${order.orderNumber} ${countLabel(totalCaps, "item")}`,
        statement_descriptor_suffix: "GOODLUCK",
        metadata: {
          orderNumber: order.orderNumber,
          clerkUserId: order.clerkUserId || "",
          customerEmail: order.customerEmail || "",
          itemCount: totalCaps.toString(),
          itemSummary: itemSummary(items),
          brand: "Good Luck 0880",
          storeUrl: "https://goodluckcaps.com",
        },
      },
      custom_text: {
        shipping_address: {
          message: "Please ensure your delivery address is accurate. Physical signature may be required for limited drops.",
        },
        submit: {
          message: "By confirming payment, you authorize Good Luck 0880 to process your order.",
        },
        after_submit: {
          message: "Thank you for completing your payment. An updated receipt and tracking will be dispatched immediately.",
        },
      },
      expires_at: reservationSessionExpiresAt(Date.now()),
      ...customerSessionFields(customerId, order.customerEmail),
      billing_address_collection: "auto",
      ...STRIPE_COLLECTION_FIELDS,
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
        itemCount: totalCaps.toString(),
        itemSummary: itemSummary(items),
        isWhatsAppOrder: "true",
        brand: "Good Luck 0880",
        ...encodeItemsMetadata(items),
      },
    });

    if (session.url) {
      await ctx.runMutation(internal.whatsappOrders.updateOrderPaymentUrl, {
        orderId: order._id,
        paymentUrl: session.url,
        stripeSessionId: session.id,
      });
    }
    if (customerId && !order.stripeCustomerId) {
      await ctx.runMutation(internal.orderSettlement.attachStripeCustomerInternal, {
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

/**
 * INTERNAL: expire every still-open Stripe Checkout session recorded on an order.
 * Scheduled by Zelle settlement and cancellation flows so payment links can never outlive
 * their order state (double-charge safety).
 */
export const expireOpenCheckoutSessionsInternal = internalAction({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.object({ expired: v.array(v.string()), skipped: v.array(v.string()) }),
  handler: async (ctx, args): Promise<{ expired: string[]; skipped: string[] }> => {
    const order: any = await ctx.runQuery(internal.orders.getOrderByIdInternal, {
      orderId: args.orderId,
    });
    if (!order) return { expired: [], skipped: [] };

    const sessionIds = orderSessionIds(order);
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
