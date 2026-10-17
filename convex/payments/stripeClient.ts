"use node";

/**
 * Stripe SDK access for the Node actions (stripeCheckout, stripeWebhook, stripeRefunds):
 * the client, customer upsert, session expiry and checkout refunds. No Convex functions.
 */
import Stripe from "stripe";
import { ConvexError } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";

export function getStripe(): Stripe {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured in Convex environment variables.");
  }
  return new Stripe(stripeKey, {
    apiVersion: '2026-08-26.dahlia'
  });
}

/** Throws unless the caller is a signed-in Administrator; returns their identity. */
export async function requireAdminIdentity(ctx: ActionCtx, messages: { unauthenticated: string; forbidden: string }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError(messages.unauthenticated);
  }
  const adminUser = await ctx.runQuery(api.users.functions.getUserByClerkId, {
    clerkId: identity.subject,
  });
  if (adminUser?.role !== "admin") {
    throw new ConvexError(messages.forbidden);
  }
  return identity;
}

/**
 * Idempotent Stripe Customer resolution: reuse an existing customer by email so repeated
 * leads/refreshes don't bloat the customer directory with duplicate objects.
 */
export async function upsertStripeCustomer(
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

/**
 * Expire all still-open Stripe Checkout sessions recorded for an order. Best effort:
 * paid/open sessions and network errors are tolerated (idempotent across retries).
 */
export async function expireSessionsForIds(
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
 * Full refund of a Checkout session's payment. Returns false when the session has no
 * payment intent (nothing was charged); Stripe errors propagate to the caller.
 */
export async function refundCheckoutSession(
  stripe: Stripe,
  sessionId: string,
  metadata: Record<string, string>
): Promise<boolean> {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!session.payment_intent) return false;
  await stripe.refunds.create({
    payment_intent: session.payment_intent as string,
    reason: "requested_by_customer",
    metadata,
  });
  return true;
}
