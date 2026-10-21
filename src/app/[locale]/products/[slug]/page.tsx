import { Suspense, cache } from "react";
import { notFound, unstable_rethrow } from "next/navigation";
import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { api } from "@convex/_generated/api";
import { routing } from "@/i18n/routing";
import { queryForStaticRender } from "@/lib/server/convexStatic";
import { toCapVariant } from "@/lib/toCapVariant";
import { isTee } from "@/lib/shop";
import { ProductView } from "@/components/product/ProductView";
import { ProductJsonLd } from "@/components/seo/ProductJsonLd";
import { productDescription, productImageUrl } from "@/lib/seo/jsonLd";
import { ogLocale, pageAlternates } from "@/lib/seo/site";

type Params = Promise<{ locale: string; slug: string }>;

/**
 * Static, regenerated every 5 minutes (ISR, ADR 0020). Slugs added later render on first
 * request and are then cached too. Price and SKU stock stay live through ProductView's
 * Convex subscription.
 */
export const revalidate = 300;
export const dynamicParams = true;

export async function generateStaticParams() {
  const variants = await queryForStaticRender(api.catalog.queries.getVariants, {});
  return routing.locales.flatMap((locale) => variants.map((v) => ({ locale, slug: v.variantId })));
}

/** One Convex read per render, shared by metadata and the page (ADR 0015: Convex is the only catalog). */
const getProduct = cache(async (slug: string) => {
  const doc = await queryForStaticRender(api.catalog.queries.getProductBySlug, { slug });
  return doc ?? null;
});

/** Shipping rate for the Offer's structured data; without it the Offer just omits shipping details. */
async function getShipping() {
  try {
    return await queryForStaticRender(api.settings.functions.getStoreSettings, {});
  } catch (error) {
    unstable_rethrow(error);
    return undefined;
  }
}

/** Rating summary plus latest reviews for the Product's structured data; none (or a failed read) omits the markup. */
async function getReviews(slug: string) {
  try {
    const [summary, latest] = await Promise.all([
      queryForStaticRender(api.reviews.public.getRatingSummary, { variantId: slug }),
      queryForStaticRender(api.reviews.public.getProductReviews, { variantId: slug, paginationOpts: { numItems: 5, cursor: null } }),
    ]);
    return summary ? { summary, latest: latest.page } : undefined;
  } catch (error) {
    unstable_rethrow(error);
    return undefined;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const doc = await getProduct(slug);
  if (!doc) return { title: "Product not found | Good Luck", robots: { index: false } };

  const product = toCapVariant(doc);
  const tee = isTee(product);
  const name = locale === "es" ? product.nameEs : product.nameEn;
  const title = tee ? `${name} | Good Luck heavyweight tees` : `${name} | Good Luck 0880 caps`;
  const description = productDescription(product, locale);
  const alternates = pageAlternates(locale, `/products/${slug}`);
  const imageUrl = productImageUrl(product);

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
      images: [{ url: imageUrl, width: 1600, height: 2000, alt: name }],
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

export default async function ProductPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const [doc, shipping, reviews] = await Promise.all([getProduct(slug), getShipping(), getReviews(slug)]);
  if (!doc) notFound();

  return (
    <main className="min-h-screen">
      <ProductJsonLd cap={toCapVariant(doc)} locale={locale} shipping={shipping} reviews={reviews} />
      <Suspense>
        <ProductView initial={doc} />
      </Suspense>
    </main>
  );
}
