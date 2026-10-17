/**
 * Shop category URLs (ADR 0019). Visitors and links use `/{locale}/products?category=caps`;
 * the proxy rewrites that to the prerendered `/{locale}/products/category/caps`, so each
 * category view is static HTML with its own canonical metadata while the public URL stays
 * the same. Pure, so the proxy and the pages share one rule.
 */
export const SHOP_CATEGORIES = ["caps", "tees"] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

export function isShopCategory(value: string | null | undefined): value is ShopCategory {
  return SHOP_CATEGORIES.includes(value as ShopCategory);
}

const SHOP_PATH = /^\/(en|es)\/products\/?$/;

/** Internal path to serve for a Shop request, or null when no rewrite applies */
export function shopCategoryRewrite(pathname: string, category: string | null): string | null {
  const match = pathname.match(SHOP_PATH);
  if (!match || !isShopCategory(category)) return null;
  return `/${match[1]}/products/category/${category}`;
}
