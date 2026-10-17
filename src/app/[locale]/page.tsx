import type { Metadata } from "next";
import { HeroInteractive } from "@/components/hero/HeroInteractive";
import { DropRadar } from "@/components/drops/DropRadar";
import { AnatomyScroll } from "@/components/story/AnatomyScroll";
import { BrandStory } from "@/components/story/BrandStory";
import { CategoryTiles } from "@/components/hero/CategoryTiles";
import { FeaturedProducts } from "@/components/catalog/FeaturedProducts";
import { NycLookbook } from "@/components/story/NycLookbook";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://goodluckcaps.com").replace(/\/$/, "");
  const canonicalUrl = `${siteUrl}/${locale}`;

  const title =
    locale === "es"
      ? "Good Luck | Gorras Urbanas Exclusivas & Playeras Heavyweight — Serie 0880"
      : "Good Luck | 0880 Signature Streetwear Caps & Heavyweight Tees";

  const description =
    locale === "es"
      ? "Tienda oficial Good Luck. Gorras snapback con bordado 3D de alta densidad y playeras heavyweight 280-300 GSM en 11 diseños con probador virtual en modelo."
      : "Official store for Good Luck. Signature 3D puff embroidery caps and heavyweight 280-300 GSM graphic tees across 11 designs with interactive model lookbook studio.";

  const imageUrl = `${siteUrl}/og/home.jpg`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: `${siteUrl}/en`,
        es: `${siteUrl}/es`,
      },
    },
    openGraph: {
      type: "website",
      siteName: "Good Luck",
      title,
      description,
      url: canonicalUrl,
      locale: locale === "es" ? "es_ES" : "en_US",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: "Good Luck 0880 Signature Streetwear Collection",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
      creator: process.env.NEXT_PUBLIC_TWITTER_HANDLE || "@goodluckcaps",
    },
  };
}

/** Homepage order (ADR 0016): product first, story after. */
export default function HomePage() {
  return (
    <div className="flex flex-col gap-0 overflow-x-clip">
      <HeroInteractive />
      <CategoryTiles />
      <FeaturedProducts />
      <AnatomyScroll />
      <DropRadar />
      <NycLookbook />
      <BrandStory />
    </div>
  );
}
