import React from "react";
import type { CapVariant } from "@/data/caps";

interface ProductJsonLdProps {
  cap: CapVariant;
  locale: string;
}

export function ProductJsonLd({ cap, locale }: ProductJsonLdProps) {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://goodluckcaps.com").replace(/\/$/, "");
  const canonicalUrl = `${siteUrl}/${locale}/caps/${cap.id}`;
  const imageUrl = cap.image.startsWith("http")
    ? cap.image
    : `${siteUrl}${cap.image.startsWith("/") ? "" : "/"}${cap.image}`;

  const name = locale === "es" ? cap.nameEs : cap.nameEn;
  const isTee = cap.silhouette === "tee" || (cap as any).category === "apparel";
  const description = isTee
    ? (locale === "es"
        ? `Playera streetwear boxy heavyweight oficial Good Luck — ${name}. Algodón peinado de 280-300 GSM, corte drop-shoulder y serigrafía HD por $160 USD.`
        : `Official Good Luck Heavyweight Streetwear Boxy Tee — ${name}. 280-300 GSM combed cotton, drop-shoulder cut, and HD screen print for $160 USD.`)
    : (locale === "es"
        ? `Gorra oficial Good Luck — Edición 0880 — ${name}. Bordado 3D de alta densidad, diablos laterales y silueta ${cap.silhouette}.`
        : `Official Good Luck Cap — 0880 Edition — ${name}. High-density 3D puff embroidery, twin pitchfork devil flanks, and ${cap.silhouette} profile.`);

  const isOutOfStock = cap.stock <= 0;
  const price = cap.priceUsd;
  const currency = "USD";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: isTee ? `${name} | Good Luck Heavyweight Streetwear` : `${name} | Good Luck 0880 Edition`,
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
