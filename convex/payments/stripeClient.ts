"use node";

/**
 * Stripe SDK access for the Node actions (payments/checkout, payments/webhook, payments/refunds):
 * the client, customer upsert, session expiry and checkout refunds. No Convex functions.
 */
import Stripe from "stripe";
import { ConvexError } from "convex/values";
import type { ActionCtx } from "../_generated/server";
import { api } from "../_generated/api";
import { toCheckoutSessionState, type CheckoutSessionState } from "../orders/model";

export function getStripe(): Stripe {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured in Convex environment variables.");
  }
  return new Stripe(stripeKey, {
    apiVersion: '2026-08-26.dahlia'
  });
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
 * Expire one Checkout Session if it is still open and report the state Stripe ends with:
 * "expired" only when Stripe says so (the expire response, or a session already expired).
 * Network or API errors report "unknown" so callers never release a hold on a guess.
 */
export async function expireCheckoutSession(
  stripe: Stripe,
  sessionId: string
): Promise<{ state: CheckoutSessionState; expiredNow: boolean }> {
  if (!sessionId.startsWith("cs_")) return { state: "unknown", expiredNow: false };
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.status !== "open") return { state: toCheckoutSessionState(session.status), expiredNow: false };
    const after = await stripe.checkout.sessions.expire(sessionId);
    return { state: toCheckoutSessionState(after.status), expiredNow: after.status === "expired" };
  } catch (err: any) {
    console.warn(`Could not expire Stripe session ${sessionId}:`, err?.message || err);
    return { state: "unknown", expiredNow: false };
  }
}

/**
 * Expire all still-open Stripe Checkout sessions recorded for an order. Best effort:
 * paid/open sessions and network errors are tolerated (idempotent across retries).
 * `states` holds what Stripe reported for each session, in order.
 */
export async function expireSessionsForIds(
  stripe: Stripe,
  sessionIds: string[]
): Promise<{ expired: string[]; skipped: string[]; states: CheckoutSessionState[] }> {
  const expired: string[] = [];
  const skipped: string[] = [];
  const states: CheckoutSessionState[] = [];
  for (const sessionId of sessionIds) {
    const { state, expiredNow } = await expireCheckoutSession(stripe, sessionId);
    (expiredNow ? expired : skipped).push(sessionId);
    states.push(state);
  }
  return { expired, skipped, states };
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
