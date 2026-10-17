import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShopView } from "@/components/shop/ShopView";

type Params = Promise<{ locale: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { locale } = await params;
  const { category } = await searchParams;
  const t = await getTranslations({ locale, namespace: "shop" });
  const cat = category === "caps" || category === "tees" ? category : null;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://goodluckcaps.com").replace(/\/$/, "");
  // Category views are canonical pages; other filters collapse onto them.
  const path = (l: string) => `${siteUrl}/${l}/products${cat ? `?category=${cat}` : ""}`;
  const title = cat === "caps" ? t("metaTitleCaps") : cat === "tees" ? t("metaTitleTees") : t("metaTitleAll");

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

export default function ShopPage() {
  return (
    <main className="min-h-screen">
      <Suspense>
        <ShopView />
      </Suspense>
    </main>
  );
}
