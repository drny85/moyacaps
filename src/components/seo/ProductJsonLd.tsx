import React from "react";
import type { CapVariant } from "@/data/caps";

interface ProductJsonLdProps {
  cap: CapVariant;
  locale: string;
}

export function ProductJsonLd({ cap, locale }: ProductJsonLdProps) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://moyacaps.vercel.app").replace(/\/$/, "");
  const canonicalUrl = `${siteUrl}/${locale}/caps/${cap.id}`;
  const imageUrl = cap.image.startsWith("http")
    ? cap.image
    : `${siteUrl}${cap.image.startsWith("/") ? "" : "/"}${cap.image}`;

  const name = locale === "es" ? cap.nameEs : cap.nameEn;
  const description =
    locale === "es"
      ? `Gorra oficial Good Luck — Edición 0880 — ${name}. Bordado 3D de alta densidad, diablos laterales y silueta ${cap.silhouette}.`
      : `Official Good Luck Cap — 0880 Edition — ${name}. High-density 3D puff embroidery, twin pitchfork devil flanks, and ${cap.silhouette} profile.`;

  const isOutOfStock = cap.stock <= 0;
  const price = locale === "es" ? Math.round(cap.priceUsd * 18.5) : cap.priceUsd;
  const currency = locale === "es" ? "MXN" : "USD";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${name} | Good Luck 0880 Edition`,
    image: [imageUrl],
    description,
    sku: `GL-0880-${cap.id.toUpperCase()}`,
    mpn: `0880-${cap.id.toUpperCase()}`,
    brand: {
      "@type": "Brand",
      name: "Good Luck",
    },
    offers: {
      "@type": "Offer",
      url: canonicalUrl,
      priceCurrency: currency,
      price: price.toFixed(2),
      priceValidUntil: "2027-12-31",
      itemCondition: "https://schema.org/NewCondition",
      availability: isOutOfStock
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
      seller: {
        "@type": "Organization",
        name: "Good Luck",
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
