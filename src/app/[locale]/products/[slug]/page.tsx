import { Suspense, cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { toCapVariant } from "@/lib/toCapVariant";
import { isTee } from "@/lib/shop";
import { ProductView } from "@/components/product/ProductView";
import { ProductJsonLd } from "@/components/seo/ProductJsonLd";

type Params = Promise<{ locale: string; slug: string }>;

/** One Convex read per request, shared by metadata and the page (ADR 0015: Convex is the only catalog). */
const getProduct = cache(async (slug: string) => {
  const doc = await fetchQuery(api.catalog.queries.getProductBySlug, { slug });
  return doc ?? null;
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const doc = await getProduct(slug);
  if (!doc) return { title: "Product not found | Good Luck" };

  const product = toCapVariant(doc);
  const tee = isTee(product);
  const name = locale === "es" ? product.nameEs : product.nameEn;
  const title = tee ? `${name} | Good Luck heavyweight tees` : `${name} | Good Luck 0880 caps`;
  const description = tee
    ? locale === "es"
      ? `${name}: playera heavyweight de 280–300 GSM con corte boxy y serigrafía de alta densidad. $${product.priceUsd} USD.`
      : `${name}: 280–300 GSM heavyweight tee with a boxy cut and high-density screen print. $${product.priceUsd} USD.`
    : locale === "es"
      ? `${name}: gorra Good Luck 0880 con bordado 3D de alta densidad. $${product.priceUsd} USD.`
      : `${name}: Good Luck 0880 cap with high-density 3D puff embroidery. $${product.priceUsd} USD.`;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://goodluckcaps.com").replace(/\/$/, "");
  const url = (l: string) => `${siteUrl}/${l}/products/${slug}`;
  const shot = product.catalogShot ?? product.image;
  const imageUrl = shot.startsWith("http") ? shot : `${siteUrl}${shot.startsWith("/") ? "" : "/"}${shot}`;

  return {
    title,
    description,
    alternates: { canonical: url(locale), languages: { en: url("en"), es: url("es") } },
    openGraph: {
      type: "website",
      siteName: "Good Luck",
      title,
      description,
      url: url(locale),
      locale: locale === "es" ? "es_ES" : "en_US",
      images: [{ url: imageUrl, width: 1600, height: 2000, alt: name }],
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

export default async function ProductPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const doc = await getProduct(slug);
  if (!doc) notFound();

  return (
    <main className="min-h-screen">
      <ProductJsonLd cap={toCapVariant(doc)} locale={locale} />
      <Suspense>
        <ProductView initial={doc} />
      </Suspense>
    </main>
  );
}
