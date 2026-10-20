/**
 * One-click unsubscribe for marketing email (the category launch email, ADR 0022): CAN-SPAM
 * opt-out and RFC 8058 `List-Unsubscribe-Post`. Every `drop_alerts` row carries a random
 * token; the email links to the storefront page, and the headers point mail clients at the
 * Convex HTTP route. Pure module: safe to import from Convex functions, the HTTP route and
 * the "use node" sender.
 */

/** Random bytes per token: 256 bits, so a token cannot be guessed or enumerated. */
export const UNSUBSCRIBE_TOKEN_BYTES = 32;
/** base64url of 32 bytes, without padding. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** Path of the Convex HTTP route mail clients POST to (RFC 8058). */
export const UNSUBSCRIBE_HTTP_PATH = "/unsubscribe";

export type UnsubscribeLocale = "en" | "es";

/**
 * A new unsubscribe token. `fill` defaults to webcrypto (seeded per execution inside Convex
 * mutations, so still unpredictable); tests pass a fixed one.
 */
export function generateUnsubscribeToken(fill: (bytes: Uint8Array<ArrayBuffer>) => Uint8Array = (b) => crypto.getRandomValues(b)): string {
  const bytes = fill(new Uint8Array(UNSUBSCRIBE_TOKEN_BYTES));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** True for a string shaped like a token; anything else is rejected before a lookup. */
export function isUnsubscribeToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

/** "es" when asked for, otherwise the default "en". */
export function unsubscribeLocale(value: string | null | undefined): UnsubscribeLocale {
  return value === "es" ? "es" : "en";
}

const trimSlash = (url: string) => url.replace(/\/+$/, "");

/** The storefront page the email's unsubscribe link opens. */
export function unsubscribePageUrl(siteUrl: string, locale: UnsubscribeLocale, token: string): string {
  return `${trimSlash(siteUrl)}/${locale}/unsubscribe?token=${encodeURIComponent(token)}`;
}

/** The Convex HTTP route mail clients POST to; a GET (a reader opening it) redirects to the page. */
export function oneClickUnsubscribeUrl(convexSiteUrl: string, locale: UnsubscribeLocale, token: string): string {
  return `${trimSlash(convexSiteUrl)}${UNSUBSCRIBE_HTTP_PATH}?token=${encodeURIComponent(token)}&locale=${locale}`;
}

/** RFC 2369 + RFC 8058 headers that give Gmail, Yahoo and Apple Mail their one-click button. */
export function listUnsubscribeHeaders(oneClickUrl: string): { name: string; value: string }[] {
  return [
    { name: "List-Unsubscribe", value: `<${oneClickUrl}>` },
    { name: "List-Unsubscribe-Post", value: "List-Unsubscribe=One-Click" },
  ];
}

/**
 * Everything a launch email needs to unsubscribe its reader: the link shown in the signature
 * and the one-click headers. Headers are left out when the Convex site URL is unknown (it is
 * always set on a deployment).
 */
export function launchEmailUnsubscribe(opts: {
  siteUrl: string;
  convexSiteUrl: string | undefined;
  locale: UnsubscribeLocale;
  token: string;
}): { pageUrl: string; headers: { name: string; value: string }[] } {
  const pageUrl = unsubscribePageUrl(opts.siteUrl, opts.locale, opts.token);
  const headers = opts.convexSiteUrl
    ? listUnsubscribeHeaders(oneClickUnsubscribeUrl(opts.convexSiteUrl, opts.locale, opts.token))
    : [];
  return { pageUrl, headers };
}
