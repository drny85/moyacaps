/**
 * Pay-click rate limits (security review H1). Every createCheckoutSession places a Checkout
 * Hold on its units for about 30 minutes (ADR 0024), so an unthrottled script could keep a
 * whole drop "sold out". Signed-in buyers and guest emails get their own bucket; guests with
 * no email share one, since Convex actions see no client IP.
 */
import { MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { ConvexError } from "convex/values";
import { components } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";

export const checkoutRateLimiter = new RateLimiter(components.rateLimiter, {
  // A new Pay click replaces the cart's last session, so 10 in 10 minutes is generous for a person.
  checkoutPerBuyer: { kind: "token bucket", rate: 10, period: 10 * MINUTE, capacity: 10 },
  // Every anonymous guest together; sharded so a drop's real traffic does not contend on one row.
  checkoutAnonymous: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 60, shards: 4 },
});

/** The bucket a Pay click draws from: the signed-in subject, else the guest's email, else everyone anonymous. */
export function checkoutRateLimitKey(subject: string | undefined, customerEmail: string | undefined) {
  if (subject) return { name: "checkoutPerBuyer" as const, key: `user:${subject}` };
  const email = customerEmail?.trim().toLowerCase();
  if (email) return { name: "checkoutPerBuyer" as const, key: `email:${email}` };
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
  customerEmail: string | undefined,
  locale: string
) {
  const { name, key } = checkoutRateLimitKey(subject, customerEmail);
  const { ok, retryAfter } = await checkoutRateLimiter.limit(ctx, name, key ? { key } : {});
  if (!ok) throw new ConvexError(checkoutRateLimitError(retryAfter, locale));
}
