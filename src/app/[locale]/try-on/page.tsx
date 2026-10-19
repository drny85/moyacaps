import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { api } from "@convex/_generated/api";
import { queryForStaticRender } from "@/lib/server/convexStatic";
import { isTryOnAvailable } from "@/lib/launch";
import { TryOnStudio } from "@/components/tryon/TryOnStudio";
import { absoluteUrl, DEFAULT_OG_IMAGE, ogLocale, pageAlternates } from "@/lib/seo/site";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "tryOn" });
  const alternates = pageAlternates(locale, "/try-on");
  const title = t("metaTitle");
  const description = t("metaDescription");

  return {
    title,
    description,
    alternates,
    openGraph: {
      title,
      description,
      url: alternates.canonical,
      type: "website",
      siteName: "Good Luck",
      locale: ogLocale(locale),
      images: [{ url: absoluteUrl(DEFAULT_OG_IMAGE), width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function TryOnPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  // Try-On is caps only: it is gone while Caps are not Live (ADR 0022).
  if (!isTryOnAvailable(await queryForStaticRender(api.settings.functions.getStorefrontLaunch, {}))) notFound();
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
