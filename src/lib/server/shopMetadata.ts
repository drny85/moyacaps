import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import type { ShopCategory } from "@/lib/shopRoutes";

/** Metadata for the Shop, per category; category views are canonical pages (ADR 0016) */
export async function shopMetadata(locale: string, category: ShopCategory | null): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "shop" });
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://goodluckcaps.com").replace(/\/$/, "");
  // Category views are canonical pages; other filters collapse onto them.
  const path = (l: string) => `${siteUrl}/${l}/products${category ? `?category=${category}` : ""}`;
  const title =
    category === "caps" ? t("metaTitleCaps") : category === "tees" ? t("metaTitleTees") : t("metaTitleAll");

  return {
    title,
    description: t("metaDescription"),
    alternates: {
      canonical: path(locale),
      languages: { en: path("en"), es: path("es") },
    },
    openGraph: {
      type: "website",
      siteName: "Good Luck",
      title,
      description: t("metaDescription"),
      url: path(locale),
      locale: locale === "es" ? "es_ES" : "en_US",
    },
  };
}
