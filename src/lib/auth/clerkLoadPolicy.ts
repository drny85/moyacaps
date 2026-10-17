/**
 * When the storefront loads Clerk (ADR 0018). Pure: callers pass the pathname and
 * document.cookie in, so the policy is testable without a browser.
 *
 * - "now":         the route needs auth to render (account, checkout, admin).
 * - "idle":        a Clerk session cookie says the visitor is probably signed in;
 *                  load after the page settles so their avatar, orders link and
 *                  admin bar appear without delaying first paint.
 * - "interaction": anonymous visitor on a public page; load only when they reach
 *                  for sign-in (hover, focus or click on a sign-in control).
 */
export type ClerkLoadTrigger = "now" | "idle" | "interaction";

/** Route prefixes (after the locale) whose pages read the session to render */
export const AUTH_ROUTE_PREFIXES = ["account", "checkout", "admin"] as const;

const LOCALE_SEGMENT = /^\/(?:en|es)(?=\/|$)/;

export function routeNeedsClerk(pathname: string): boolean {
  const path = pathname.replace(LOCALE_SEGMENT, "") || "/";
  return AUTH_ROUTE_PREFIXES.some((prefix) => path === `/${prefix}` || path.startsWith(`/${prefix}/`));
}

/**
 * Clerk keeps `__client_uat` (optionally suffixed per instance) readable by scripts:
 * the Unix time of the last sign-in, or 0 when signed out. A positive value is a
 * hint, not proof; the real session is confirmed once clerk-js loads.
 */
export function hasSignedInHint(cookie: string): boolean {
  return cookie.split(";").some((pair) => {
    const [rawName, ...rest] = pair.split("=");
    const name = rawName.trim();
    if (name !== "__client_uat" && !name.startsWith("__client_uat_")) return false;
    return Number(rest.join("=").trim()) > 0;
  });
}

export function clerkLoadTrigger({ pathname, cookie }: { pathname: string; cookie: string }): ClerkLoadTrigger {
  if (routeNeedsClerk(pathname)) return "now";
  if (hasSignedInHint(cookie)) return "idle";
  return "interaction";
}
