"use node";

/**
 * Stripe Checkout session actions (ADR 0002, ADR 0023): direct card checkout and expiry
 * of open sessions when an order no longer accepts payment.
 */
import { action, internalAction } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import type Stripe from "stripe";
import { randomDigitString } from "../lib/ids";
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
import { computeShipping, orderSessionIds } from "../orders/model";
import { expireSessionsForIds, getStripe, upsertStripeCustomer } from "./stripeClient";
import { requireAdminInAction } from "../lib/auth";
import type { ActionCtx } from "../_generated/server";

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
    Promise.all(items.map((item) => ctx.runQuery(api.catalog.queries.getVariantById, { variantId: item.variantId }))),
    Promise.all(
      items.map((item) =>
        ctx.runQuery(internal.catalog.queries.getLineStock, {
          variantId: item.variantId,
          colorway: item.colorway,
          size: item.size,
        })
      )
    ),
  ]);
  const priced = validateCartLines(items, variants, lineStocks, { locale, flow, now: Date.now() });
  const settings = await ctx.runQuery(internal.settings.functions.getStoreSettingsInternal, {});
  const { freeShipping, shippingFee } = computeShipping(priced.totalItems, settings);
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

/**
 * INTERNAL: expire every still-open Stripe Checkout session recorded on an order.
 * Scheduled by cancellation flows so a payment page can never outlive its order
 * (double-charge safety).
 */
export const expireOpenCheckoutSessionsInternal = internalAction({
  args: {
    orderId: v.id("orders"),
  },
  returns: v.object({ expired: v.array(v.string()), skipped: v.array(v.string()) }),
  handler: async (ctx, args): Promise<{ expired: string[]; skipped: string[] }> => {
    const order: any = await ctx.runQuery(internal.orders.functions.getOrderByIdInternal, {
      orderId: args.orderId,
    });
    if (!order) return { expired: [], skipped: [] };

    const sessionIds = orderSessionIds(order);
    if (sessionIds.length === 0) return { expired: [], skipped: [] };

    const stripe = getStripe();
    const { expired, skipped } = await expireSessionsForIds(stripe, sessionIds);

    if (expired.length > 0) {
      await ctx.runMutation(internal.orders.functions.recordPaymentEvent, {
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
