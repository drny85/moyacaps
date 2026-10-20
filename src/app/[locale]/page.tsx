import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { absoluteUrl, DEFAULT_OG_IMAGE, ogLocale, pageAlternates } from "@/lib/seo/site";
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
  const alternates = pageAlternates(locale);

  const title =
    locale === "es"
      ? "Good Luck | Gorras Urbanas Exclusivas & Playeras Heavyweight — Serie 0880"
      : "Good Luck | 0880 Signature Streetwear Caps & Heavyweight Tees";

  const description =
    locale === "es"
      ? "Tienda oficial de Good Luck, marca de streetwear de Nueva York. Gorras snapback 0880 con bordado 3D de alta densidad y playeras heavyweight con estampado de alta densidad. Envíos en EE. UU."
      : "Official store of Good Luck, a New York streetwear brand. Signature 0880 snapback caps with high-density 3D puff embroidery and heavyweight graphic tees. Ships across the US.";

  const imageUrl = absoluteUrl(DEFAULT_OG_IMAGE);

  return {
    title,
    description,
    alternates,
    openGraph: {
      type: "website",
      siteName: "Good Luck",
      title,
      description,
      url: alternates.canonical,
      locale: ogLocale(locale),
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
      // Only a real X account: x.com/goodluckcaps does not exist
      ...(process.env.NEXT_PUBLIC_TWITTER_HANDLE ? { creator: process.env.NEXT_PUBLIC_TWITTER_HANDLE } : {}),
    },
  };
}

/** Homepage order (ADR 0016): product first, story after. */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
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
