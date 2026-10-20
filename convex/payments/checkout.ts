"use node";

/**
 * Stripe Checkout session actions (ADR 0002, ADR 0023, ADR 0024): card checkout behind a
 * Checkout Hold, expiry of open sessions when an order no longer accepts payment, and the
 * paths that release a hold once Stripe reports its session expired (replaced or abandoned
 * checkouts, and the hourly backstop).
 */
import { action, internalAction } from "../_generated/server";
import { v, ConvexError } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
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
import {
  checkoutHoldExpiresAt,
  computeShipping,
  decideHoldRelease,
  orderSessionIds,
  stripeSessionExpiresAt,
} from "../orders/model";
import { hasSettled, isCancelled } from "../orders/status";
import { expireCheckoutSession, expireSessionsForIds, getStripe, upsertStripeCustomer } from "./stripeClient";
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

type HoldReleaseReason = "replaced" | "abandoned";

/**
 * End a cart's open Checkout Session (a new Pay click, or Stripe's back link): expire it
 * and, once Stripe reports it expired, release its Order's hold. Best effort: a session
 * that is gone, paid or unreachable is left to the webhook and the hourly backstop.
 */
async function endOpenCheckout(
  ctx: ActionCtx,
  stripe: Stripe,
  sessionId: string,
  reason: HoldReleaseReason
): Promise<boolean> {
  const order: Doc<"orders"> | null = await ctx.runQuery(internal.orders.functions.getOrderByStripeSessionIdInternal, {
    stripeSessionId: sessionId,
  });
  if (!order || hasSettled(order) || isCancelled(order)) return false;
  const { state } = await expireCheckoutSession(stripe, sessionId);
  if (decideHoldRelease([state]) !== "release") return false;
  const { released } = await ctx.runMutation(internal.orders.checkoutHold.releaseCheckoutHold, {
    orderId: order._id,
    stripeSessionId: sessionId,
    reason,
  });
  return released;
}

export const createCheckoutSession = action({
  args: {
    items: v.array(cartLineValidator),
    currency: v.string(),
    locale: v.string(),
    origin: v.string(),
    clerkUserId: v.optional(v.string()),
    customerEmail: v.optional(v.string()),
    // The cart's previous open Checkout Session: expired (and its hold released) first.
    previousSessionId: v.optional(v.string()),
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

    const stripe = getStripe();

    // A new Pay click ends the cart's previous session first, so its units count again.
    if (args.previousSessionId) {
      await endOpenCheckout(ctx, stripe, args.previousSessionId, "replaced");
    }

    const { validatedItems, subtotal, totalItems, freeShipping, shippingFee, total } = await priceCart(
      ctx,
      args.items,
      args.locale,
      "checkout"
    );

    const orderNumber = `GL-${Date.now().toString(36).toUpperCase()}-${randomDigitString(4)}`;
    const holdExpiresAt = checkoutHoldExpiresAt(Date.now());

    // Checkout Hold (ADR 0024): the pending Order and its units, atomically. Throws a
    // customer-facing error when another Customer took the stock since pricing.
    const orderId: Id<"orders"> = await ctx.runMutation(internal.orders.checkoutHold.placeCheckoutHold, {
      orderNumber,
      items: validatedItems.map(({ variantId, name, quantity, price, image, colorway, size }) => ({
        variantId,
        name,
        quantity,
        price,
        image,
        ...(colorway ? { colorway } : {}),
        ...(size ? { size } : {}),
      })),
      currency: args.currency,
      subtotal,
      shippingFee,
      total,
      clerkUserId: resolvedClerkId || undefined,
      customerEmail: args.customerEmail,
      checkoutHoldExpiresAt: holdExpiresAt,
      locale: args.locale,
    });

    // Resolve or upsert customer if email is provided, so repeat buyers are deduplicated
    let customerId: string | undefined;
    if (args.customerEmail) {
      customerId = await upsertStripeCustomer(stripe, {
        email: args.customerEmail,
        orderNumber,
        clerkUserId: resolvedClerkId || undefined,
      });
    }

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(
        {
          expires_at: stripeSessionExpiresAt(holdExpiresAt),
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
              message: "By confirming payment, you authorize Good Luck 0880 to process your order.",
            },
            after_submit: {
              message: "Thank you for securing your piece from Good Luck 0880. Your receipt is on its way, and tracking follows once your order ships.",
            },
          },
          ...customerSessionFields(customerId, args.customerEmail),
          billing_address_collection: "required",
          ...STRIPE_COLLECTION_FIELDS,
          shipping_options: buildShippingOptions(shippingFee, freeShipping, true),
          success_url: `${args.origin}/${args.locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order_number=${orderNumber}`,
          // Stripe's back link: the checkout page expires this session at once (ADR 0024).
          cancel_url: `${args.origin}/${args.locale}/checkout?canceled=1`,
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
    } catch (err) {
      // No session exists to expire, so nothing can pay against this hold: release it now.
      await ctx.runMutation(internal.orders.checkoutHold.releaseCheckoutHold, {
        orderId,
        reason: "session_creation_failed",
      });
      throw err;
    }

    await ctx.runMutation(internal.orders.checkoutHold.attachCheckoutSession, {
      orderId,
      stripeSessionId: session.id,
      paymentUrl: session.url ?? undefined,
    });

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

/**
 * Stripe's back link (cancel_url): the Customer left the payment page, so expire the
 * session right away and release its hold once Stripe confirms. Takes the session id the
 * cart remembered; it is high-entropy, so nobody can end someone else's checkout.
 */
export const abandonCheckoutSession = action({
  args: { sessionId: v.string() },
  returns: v.object({ released: v.boolean() }),
  handler: async (ctx, args): Promise<{ released: boolean }> => {
    if (!args.sessionId.startsWith("cs_")) return { released: false };
    const released = await endOpenCheckout(ctx, getStripe(), args.sessionId, "abandoned");
    return { released };
  },
});

/**
 * INTERNAL (hourly cron): the backstop for a lost `checkout.session.expired` event. For each
 * Order still awaiting payment 45 minutes after Pay, expire its sessions and release the
 * hold only once Stripe reports them expired. A paid session is left for settlement.
 */
export const sweepOverdueCheckoutHolds = internalAction({
  args: {},
  returns: v.object({ checked: v.number(), released: v.number() }),
  handler: async (ctx): Promise<{ checked: number; released: number }> => {
    const overdue: Doc<"orders">[] = await ctx.runQuery(internal.orders.checkoutHold.listOverdueCheckoutHolds, {
      now: Date.now(),
    });
    if (overdue.length === 0) return { checked: 0, released: 0 };

    const stripe = getStripe();
    let released = 0;
    for (const order of overdue) {
      const { states } = await expireSessionsForIds(stripe, orderSessionIds(order));
      const decision = decideHoldRelease(states);
      if (decision === "paid") {
        console.warn(`Backstop: ${order.orderNumber} has a completed session but is still pending; awaiting settlement.`);
        continue;
      }
      if (decision !== "release") continue;
      const result = await ctx.runMutation(internal.orders.checkoutHold.releaseCheckoutHold, {
        orderId: order._id,
        stripeSessionId: order.stripeSessionId,
        reason: "backstop",
      });
      if (result.released) released++;
    }
    return { checked: overdue.length, released };
  },
});
