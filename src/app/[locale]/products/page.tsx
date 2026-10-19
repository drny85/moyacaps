import { Suspense } from "react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShopView } from "@/components/shop/ShopView";
import { absoluteUrl, DEFAULT_OG_IMAGE, ogLocale, pageAlternates } from "@/lib/seo/site";

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

  // Category views are canonical pages; other filters collapse onto them.
  const alternates = pageAlternates(locale, `/products${cat ? `?category=${cat}` : ""}`);
  const title = cat === "caps" ? t("metaTitleCaps") : cat === "tees" ? t("metaTitleTees") : t("metaTitleAll");

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

export default function ShopPage() {
  return (
    <main className="min-h-screen">
      <Suspense>
        <ShopView />
      </Suspense>
    </main>
  );
}
