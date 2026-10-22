import { claimableEmail } from "../orders/guestClaimModel";
import { isSendableEmail } from "../notifications/emailEnv";

/**
 * Where Stripe sends the buyer after Checkout (security review M1). `origin` and `locale`
 * arrive from the browser, and Stripe redirects to whatever success_url/cancel_url say, so an
 * unchecked origin made a real Good Luck Checkout page that ends on an attacker's site.
 */
export const PRODUCTION_ORIGINS = ["https://goodluckcaps.com", "https://www.goodluckcaps.com"] as const;
const FALLBACK_ORIGIN = PRODUCTION_ORIGINS[0];

/** This project's own Vercel URLs only: the team suffix keeps other accounts' "moyacaps-*" projects out. */
const VERCEL_ORIGIN = /^https:\/\/moyacaps(-[a-z0-9-]+-drny85s-projects)?\.vercel\.app$/;
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

function originOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** The requested origin when it is ours (site URL, production, our Vercel previews, local dev), else the site URL. */
export function resolveCheckoutOrigin(requested: string, appUrl: string | undefined): string {
  const site = originOf(appUrl) ?? FALLBACK_ORIGIN;
  const origin = originOf(requested);
  if (!origin) return site;
  const allowed =
    origin === site ||
    (PRODUCTION_ORIGINS as readonly string[]).includes(origin) ||
    VERCEL_ORIGIN.test(origin) ||
    LOCAL_ORIGIN.test(origin);
  return allowed ? origin : site;
}

/** Storefront locales; anything else falls back to English so it cannot shape a URL path. */
export function resolveCheckoutLocale(locale: string): "en" | "es" {
  return locale === "es" ? "es" : "en";
}

/**
 * The email a Checkout uses for the Stripe customer and receipt (security review L3): the
 * signed-in caller's verified email, else a well-formed browser-sent one, else none.
 */
export function checkoutCustomerEmail(
  identity: { email?: string; emailVerified?: boolean } | null,
  requested: string | undefined
): string | undefined {
  const verified = claimableEmail(identity?.email, identity?.emailVerified);
  if (verified) return verified;
  return isSendableEmail(requested) ? requested.trim().toLowerCase() : undefined;
}
