/**
 * The storefront's primary navigation (pure, tested). Desktop links and the mobile drawer
 * render this one list, so a new section is added in one place.
 */

export type NavKey = "shop" | "caps" | "tees" | "tryOn" | "story" | "track";

export interface NavItem {
  key: NavKey;
  /** Locale-free href; a `#hash` item is an in-page anchor and is never "current" */
  href: string;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { key: "shop", href: "/products" },
  { key: "caps", href: "/products?category=caps" },
  { key: "tees", href: "/products?category=tees" },
  { key: "tryOn", href: "/try-on" },
  { key: "story", href: "/#story" },
  { key: "track", href: "/track" },
];

function parseHref(href: string): { path: string; query: URLSearchParams; hash: string } {
  const [beforeHash, hash = ""] = href.split("#");
  const [path, query = ""] = beforeHash.split("?");
  return { path, query: new URLSearchParams(query), hash };
}

/**
 * Which item is the current page. `pathname` is locale-free (next-intl's usePathname) and
 * `search` is the query string with or without "?". An item with query params matches only
 * on its exact path with every param equal; an item without them also covers nested paths
 * (`/products/eagle` is inside Shop). The most specific match wins, so `?category=caps`
 * marks Caps rather than Shop.
 */
export function activeNavKey(items: readonly NavItem[], pathname: string, search: string): NavKey | null {
  const current = new URLSearchParams(search);
  let best: { key: NavKey; specificity: number } | null = null;
  for (const item of items) {
    const { path, query, hash } = parseHref(item.href);
    if (hash) continue;
    const params = [...query.entries()];
    const matches =
      params.length > 0
        ? pathname === path && params.every(([k, v]) => current.get(k) === v)
        : pathname === path || pathname.startsWith(`${path}/`);
    if (matches && (!best || params.length > best.specificity)) {
      best = { key: item.key, specificity: params.length };
    }
  }
  return best?.key ?? null;
}
