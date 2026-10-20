/**
 * sitemap.xml entries. Only indexable, canonical, 200-status URLs belong here:
 * no redirects (`/`), no private areas, one entry per locale with full hreflang.
 */
import type { MetadataRoute } from "next";
import type { CapVariant } from "../../data/caps";
import { catalogCategory } from "../../../convex/catalog/model";
import type { CategoryLaunches } from "../launch";
import { routing } from "../../i18n/config";
import { languageAlternates, localizedUrl } from "./site";
import { productImageUrl } from "./jsonLd";

type Page = {
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]["changeFrequency"]>;
  priority: number;
  images?: string[];
};

/** Indexable storefront pages; category views are their own canonicals (see products/page.tsx). */
export const STATIC_PAGES: Page[] = [
  { path: "", changeFrequency: "daily", priority: 1.0 },
  { path: "/products", changeFrequency: "daily", priority: 0.9 },
  { path: "/products?category=caps", changeFrequency: "daily", priority: 0.8 },
  { path: "/products?category=tees", changeFrequency: "daily", priority: 0.8 },
  { path: "/try-on", changeFrequency: "monthly", priority: 0.6 },
  { path: "/about", changeFrequency: "yearly", priority: 0.5 },
  { path: "/track", changeFrequency: "yearly", priority: 0.3 },
  { path: "/terms", changeFrequency: "yearly", priority: 0.2 },
  { path: "/privacy", changeFrequency: "yearly", priority: 0.2 },
  { path: "/returns", changeFrequency: "yearly", priority: 0.2 },
];

const CATEGORY_PAGE: Record<string, keyof CategoryLaunches> = {
  "/products?category=caps": "headwear",
  "/products?category=tees": "apparel",
  "/try-on": "headwear",
};

/** No category Live: when Category Status is unknown, list nothing that might 404. */
export const NONE_LIVE: CategoryLaunches = { headwear: { status: "hidden" }, apparel: { status: "hidden" } };

export function buildSitemap(products: CapVariant[], base: string, now: Date, launches: CategoryLaunches): MetadataRoute.Sitemap {
  const isLive = (category: keyof CategoryLaunches) => launches[category].status === "live";
  const pages: Page[] = [
    // A category page, its products, and Try-On (caps only) are listed only while the category is Live (ADR 0022)
    ...STATIC_PAGES.filter((page) => !(page.path in CATEGORY_PAGE) || isLive(CATEGORY_PAGE[page.path])),
    ...products
      .filter((p) => p.isAvailable !== false && isLive(catalogCategory(p)))
      .map((p) => ({
        path: `/products/${p.id}`,
        changeFrequency: "weekly" as const,
        priority: 0.8,
        images: [productImageUrl(p, base)],
      })),
  ];

  return pages.flatMap((page) =>
    routing.locales.map((locale) => ({
      url: localizedUrl(locale, page.path, base),
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
      alternates: { languages: languageAlternates(page.path, base) },
      ...(page.images ? { images: page.images } : {}),
    }))
  );
}

