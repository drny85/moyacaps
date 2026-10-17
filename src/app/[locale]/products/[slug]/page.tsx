import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { CAP_VARIANTS, type CapVariant } from "@/data/caps";
import { ProductDetailView } from "@/components/product/ProductDetailView";
import { toCapVariant } from "@/lib/toCapVariant";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";

export const dynamicParams = true;

async function getProductBySlug(slug: string): Promise<CapVariant | null> {
  try {
    const convexVariant = await fetchQuery(api.products.getProductBySlug, {
      slug,
      allowUnavailable: true,
    });
    if (convexVariant) {
      if (convexVariant.isAvailable === false) {
        return null;
      }
      return toCapVariant(convexVariant);
    }
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE" || err?.message?.includes("Dynamic server usage")) {
      throw err;
    }
    console.error(`Failed to fetch product ${slug} from Convex`, err);
  }

  // Offline fallback while Convex is unreachable; removed with the Phase 4 product page.
  const staticCap = CAP_VARIANTS.find((c) => c.id === slug);
  if (staticCap) return staticCap;

  return null;
}

export function generateStaticParams() {
  const params: { locale: string; slug: string }[] = [];
  for (const locale of routing.locales) {
    for (const cap of CAP_VARIANTS) {
      params.push({ locale, slug: cap.id });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const cap = await getProductBySlug(slug);

  if (!cap) {
    return {
      title: "Product Not Found | Good Luck",
    };
  }

  const name = locale === "es" ? cap.nameEs : cap.nameEn;
  const isTee = cap.silhouette === "tee" || (cap as any).category === "apparel";
  const title = isTee
    ? `${name} ($${cap.priceUsd} USD) | Good Luck Heavyweight Streetwear`
    : `${name} | Good Luck 0880 Edition`;
  const description = isTee
    ? (locale === "es"
        ? `Playera streetwear boxy heavyweight oficial Good Luck — ${name}. Algodón peinado de 280-300 GSM, corte drop-shoulder y serigrafía HD por $${cap.priceUsd} USD.`
        : `Official Good Luck Heavyweight Streetwear Boxy Tee — ${name}. 280-300 GSM combed cotton, drop-shoulder cut, and HD screen print for $${cap.priceUsd} USD.`)
    : (locale === "es"
        ? `Gorra oficial Good Luck — Edición 0880 — ${name}. Bordado 3D de alta densidad, diablos laterales y silueta ${cap.silhouette}.`
        : `Official Good Luck Cap — 0880 Edition — ${name}. High-density 3D puff embroidery, twin pitchfork devil flanks, and ${cap.silhouette} profile.`);

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://goodluckcaps.com").replace(/\/$/, "");
  const canonicalUrl = `${siteUrl}/${locale}/products/${slug}`;
  const imageUrl = cap.image.startsWith("http")
    ? cap.image
    : `${siteUrl}${cap.image.startsWith("/") ? "" : "/"}${cap.image}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: `${siteUrl}/en/products/${slug}`,
        es: `${siteUrl}/es/products/${slug}`,
      },
    },
    openGraph: {
      type: "website",
      siteName: "Good Luck",
      title: `${name} | Good Luck 0880 Edition`,
      description,
      url: canonicalUrl,
      locale: locale === "es" ? "es_ES" : "en_US",
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 800,
          alt: `${name} - Good Luck 0880`,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} | Good Luck 0880`,
      description,
      images: [imageUrl],
      creator: process.env.NEXT_PUBLIC_TWITTER_HANDLE || "@goodluckcaps",
    },
  };
}

import { ProductJsonLd } from "@/components/seo/ProductJsonLd";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug, locale } = await params;
  const cap = await getProductBySlug(slug);

  if (!cap) {
    notFound();
  }

  return (
    <main className="min-h-screen pt-4 pb-20">
      <ProductJsonLd cap={cap} locale={locale} />
      <ProductDetailView cap={cap} allCaps={CAP_VARIANTS} />
    </main>
  );
}
