import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ShopCategory } from "@/lib/shopRoutes";
import { absoluteUrl, DEFAULT_OG_IMAGE, ogLocale, pageAlternates } from "@/lib/seo/site";

/** Metadata for the Shop, per category; category views are canonical pages (ADR 0016) */
export async function shopMetadata(locale: string, category: ShopCategory | null): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "shop" });
  // Category views are canonical pages; other filters collapse onto them.
  const alternates = pageAlternates(locale, `/products${category ? `?category=${category}` : ""}`);
  const title =
    category === "caps" ? t("metaTitleCaps") : category === "tees" ? t("metaTitleTees") : t("metaTitleAll");

  return {
    title,
    description: t("metaDescription"),
    alternates,
    openGraph: {
      type: "website",
      siteName: "Good Luck",
      title,
      description: t("metaDescription"),
      url: alternates.canonical,
      locale: ogLocale(locale),
      images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE), width: 1200, height: 630, alt: title }],
    },
  };
}
