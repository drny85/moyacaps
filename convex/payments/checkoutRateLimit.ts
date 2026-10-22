/**
 * Pay-click rate limits (security review H1). Every createCheckoutSession places a Checkout
 * Hold on its units for about 30 minutes (ADR 0024), so an unthrottled script could keep a
 * whole drop "sold out". Signed-in buyers get their own bucket. Guests get one per client IP
 * through a Checkout Pass (M2, ADR 0029), since Convex actions see no client IP; a guest
 * without a valid pass falls back to the shared anonymous bucket.
 *
 * Also the Stripe session lookups behind the public sync and abandon actions (M1): each call
 * reaches Stripe, so a script could otherwise spend the account's Stripe API rate limit.
 */
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";
import { components } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

export const checkoutRateLimiter = new RateLimiter(components.rateLimiter, {
  // A new Pay click replaces the cart's last session, so 10 in 10 minutes is generous for a person.
  checkoutPerBuyer: { kind: "token bucket", rate: 10, period: 10 * MINUTE, capacity: 10 },
  // One guest client IP, as a person: the same budget as a signed-in buyer.
  checkoutPerGuestIp: { kind: "token bucket", rate: 10, period: 10 * MINUTE, capacity: 10 },
  // Guests without a Checkout Pass (CHECKOUT_PASS_SECRET unset, or a page built before passes),
  // all together; sharded so a drop's real traffic does not contend on one row.
  checkoutAnonymous: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 60, shards: 4 },
  // One Stripe Checkout Session: the success page syncs once per load, the back link abandons once.
  stripeSessionPerId: { kind: "token bucket", rate: 5, period: MINUTE, capacity: 5 },
  // Every success-page sync together, far below Stripe's API rate limit. Running dry only delays
  // the repair path: the webhook still settles the Order.
  checkoutSyncGlobal: { kind: "token bucket", rate: 120, period: MINUTE, capacity: 120, shards: 4 },
});

/**
 * The bucket a Pay click draws from: the signed-in subject, else the guest key from a verified
 * Checkout Pass, else everyone anonymous. A guest's email is not a key: it is browser-sent, so
 * a script could send a new one per click.
 */
export function checkoutRateLimitKey(subject: string | undefined, guestKey?: string | null) {
  if (subject) return { name: "checkoutPerBuyer" as const, key: `user:${subject}` };
  if (guestKey) return { name: "checkoutPerGuestIp" as const, key: `ip:${guestKey}` };
  return { name: "checkoutAnonymous" as const, key: undefined };
}

export function checkoutRateLimitError(retryAfterMs: number, locale: string): string {
  const minutes = Math.max(1, Math.ceil(retryAfterMs / MINUTE));
  return locale === "es"
    ? `Demasiados intentos de pago. Intenta de nuevo en ${minutes} min.`
    : `Too many checkout attempts. Try again in ${minutes} min.`;
}

/** Throws a customer-facing ConvexError when this caller is over its Pay-click budget. */
export async function enforceCheckoutRateLimit(
  ctx: ActionCtx,
  subject: string | undefined,
  guestKey: string | null,
  locale: string
) {
  const { name, key } = checkoutRateLimitKey(subject, guestKey);
  const { ok, retryAfter } = await checkoutRateLimiter.limit(ctx, name, key ? { key } : {});
  if (!ok) throw new ConvexError(checkoutRateLimitError(retryAfter, locale));
}

/** A public action's Stripe session lookup: "sync" also draws from the shared sync budget. */
export type StripeSessionLookup = "sync" | "abandon";

/**
 * Whether a public action may call Stripe for this Checkout Session now. Only `cs_` ids are
 * looked up at all. Abandon skips the shared budget: a script draining it must not stop real
 * back-link releases, which would leave units held.
 */
export async function allowStripeSessionLookup(
  ctx: ActionCtx,
  sessionId: string,
  lookup: StripeSessionLookup
): Promise<boolean> {
  if (!sessionId.startsWith("cs_")) return false;
  const perSession = await checkoutRateLimiter.limit(ctx, "stripeSessionPerId", { key: `session:${sessionId}` });
  if (!perSession.ok) return false;
  if (lookup === "abandon") return true;
  return (await checkoutRateLimiter.limit(ctx, "checkoutSyncGlobal")).ok;
}
