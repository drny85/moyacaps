import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";
import { TryOnStudio } from "@/components/tryon/TryOnStudio";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tryOn" });
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://goodluckcaps.com").replace(/\/$/, "");
  const title = t("metaTitle");
  const description = t("metaDescription");

  return {
    title,
    description,
    alternates: {
      canonical: `${siteUrl}/${locale}/try-on`,
      languages: { en: `${siteUrl}/en/try-on`, es: `${siteUrl}/es/try-on` },
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}/${locale}/try-on`,
      type: "website",
      siteName: "Good Luck",
      images: [{ url: `${siteUrl}/og/home.jpg`, width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function TryOnPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tryOn" });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-10 lg:px-8">
      <Link
        href="/products?category=caps"
        className="mb-6 inline-flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("back")}
      </Link>
      <TryOnStudio />
    </div>
  );
}
