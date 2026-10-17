/**
 * Which message namespaces reach the browser (ADR 0018). The storefront layout sends
 * only STOREFRONT_NAMESPACES, so every public page's HTML skips admin, checkout,
 * account and tracking copy. Those routes add the full set through
 * `FullMessagesProvider` in their segment layout.
 *
 * Every top-level key in src/messages/*.json must be listed in exactly one of the two
 * lists (enforced by src/__tests__/clientMessages.test.ts).
 */
export const STOREFRONT_NAMESPACES = [
  "nav",
  "footer",
  "hero",
  "home",
  "story",
  "anatomy",
  "dropRadar",
  "dropAlert",
  "shop",
  "product",
  "pdp",
  "cart",
  "share",
] as const;

/** Namespaces only used under checkout, account, track and admin */
export const ROUTE_SCOPED_NAMESPACES = [
  "checkout",
  "checkoutSuccess",
  "account",
  "track",
  "validation",
  "admin",
] as const;

export type Messages = Record<string, unknown>;

export function pickNamespaces(messages: Messages, namespaces: readonly string[]): Messages {
  const picked: Messages = {};
  for (const ns of namespaces) {
    if (ns in messages) picked[ns] = messages[ns];
  }
  return picked;
}
