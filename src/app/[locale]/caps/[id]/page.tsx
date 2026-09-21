import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { CAP_VARIANTS, type CapVariant } from "@/data/caps";
import { ProductDetailView } from "@/components/product/ProductDetailView";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";

export const dynamicParams = true;

async function getCapById(id: string): Promise<CapVariant | null> {
  try {
    const convexVariant = await fetchQuery(api.products.getVariantById, {
      variantId: id,
      allowUnavailable: true,
    });
    if (convexVariant) {
      if (convexVariant.isAvailable === false) {
        return null;
      }
      return {
        id: convexVariant.variantId,
        nameEn: convexVariant.nameEn,
        nameEs: convexVariant.nameEs,
        silhouette: (convexVariant.silhouette as "snapback" | "trucker") || "snapback",
        primaryHex: convexVariant.primaryHex,
        secondaryHex: convexVariant.secondaryHex,
        image: convexVariant.image,
        stock: convexVariant.stock,
        priceUsd: convexVariant.priceUsd,
        isFeatured: convexVariant.isFeatured,
        tagEn: convexVariant.isFeatured ? "Signature Edition" : undefined,
        tagEs: convexVariant.isFeatured ? "Edición Insignia" : undefined,
      };
    }
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE" || err?.message?.includes("Dynamic server usage")) {
      throw err;
    }
    console.error(`Failed to fetch variant ${id} from Convex`, err);
  }

  const staticCap = CAP_VARIANTS.find((c) => c.id === id);
  if (staticCap) return staticCap;

  return null;
}

export function generateStaticParams() {
  const params: { locale: string; id: string }[] = [];
  for (const locale of routing.locales) {
    for (const cap of CAP_VARIANTS) {
      params.push({ locale, id: cap.id });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { locale, id } = await params;
  const cap = await getCapById(id);

  if (!cap) {
    return {
      title: "Cap Not Found | Moya Caps",
    };
  }

  const name = locale === "es" ? cap.nameEs : cap.nameEn;
  const description =
    locale === "es"
      ? `Gorra oficial Moya Caps 0880 Good Luck — ${name}. Bordado 3D de alta densidad, diablos laterales y silueta ${cap.silhouette}.`
      : `Official Moya Caps 0880 Good Luck Cap — ${name}. High-density 3D puff embroidery, twin pitchfork devil flanks, and ${cap.silhouette} profile.`;

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://moyacaps.vercel.app").replace(/\/$/, "");
  const canonicalUrl = `${siteUrl}/${locale}/caps/${id}`;
  const imageUrl = cap.image.startsWith("http")
    ? cap.image
    : `${siteUrl}${cap.image.startsWith("/") ? "" : "/"}${cap.image}`;

  return {
    title: `${name} | Moya Caps 0880 Good Luck Edition`,
    description,
    alternates: {
      canonical: canonicalUrl,
      languages: {
        en: `${siteUrl}/en/caps/${id}`,
        es: `${siteUrl}/es/caps/${id}`,
      },
    },
    openGraph: {
      type: "website",
      siteName: "Moya Caps",
      title: `${name} | Moya Caps 0880 Good Luck Edition`,
      description,
      url: canonicalUrl,
      locale: locale === "es" ? "es_ES" : "en_US",
      images: [
        {
          url: imageUrl,
          width: 800,
          height: 800,
          alt: `${name} - Moya Caps 0880`,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${name} | Moya Caps 0880`,
      description,
      images: [imageUrl],
      creator: "@moyacaps",
    },
  };
}

export default async function CapDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id } = await params;
  const cap = await getCapById(id);

  if (!cap) {
    notFound();
  }

  return (
    <main className="min-h-screen pt-4 pb-20">
      <ProductDetailView cap={cap} allCaps={CAP_VARIANTS} />
    </main>
  );
}
