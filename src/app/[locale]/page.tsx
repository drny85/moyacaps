import type { Metadata } from "next";
import { HeroInteractive } from "@/components/hero/HeroInteractive";
import { DropRadar } from "@/components/drops/DropRadar";
import { CapGrid } from "@/components/catalog/CapGrid";
import { AnatomyParallax } from "@/components/story/AnatomyParallax";
import { BrandStory } from "@/components/story/BrandStory";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://moyacaps.vercel.app").replace(/\/$/, "");
  const canonicalUrl = `${siteUrl}/${locale}`;

  const title =
    locale === "es"
      ? "Good Luck | Gorras Urbanas Exclusivas — Serie 0880"
      : "Good Luck | 0880 Signature Streetwear Caps";

  const description =
    locale === "es"
      ? "Tienda oficial Good Luck. Bordado 3D de alta densidad, emblemática herradura de la suerte y diablos con tridente en 16 combinaciones de color exclusivas."
      : "Official store for Good Luck. Heavyweight 3D puff embroidery, iconic horseshoe-clover emblem, and devil pitchfork flanks in 16 exclusive colorways.";

  const imageUrl = `${siteUrl}/caps/negro-rojo.png`;

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

export default function HomePage() {
  return (
    <div className="flex flex-col gap-0 overflow-hidden">
      <AnatomyParallax />
      <HeroInteractive />
      <DropRadar />
      <CapGrid />
      <BrandStory />
    </div>
  );
}
