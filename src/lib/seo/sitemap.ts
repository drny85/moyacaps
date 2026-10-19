/**
 * sitemap.xml entries. Only indexable, canonical, 200-status URLs belong here:
 * no redirects (`/`), no private areas, one entry per locale with full hreflang.
 */
import type { MetadataRoute } from "next";
import type { CapVariant } from "../../data/caps";
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
  { path: "/track", changeFrequency: "yearly", priority: 0.3 },
];

export function buildSitemap(products: CapVariant[], base: string, now: Date): MetadataRoute.Sitemap {
  const pages: Page[] = [
    ...STATIC_PAGES,
    ...products
      .filter((p) => p.isAvailable !== false)
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

