/**
 * Schema.org structured data builders (Google rich results). Pure: callers pass the
 * site origin and clock so output is deterministic in tests.
 */
import type { CapVariant } from "../../data/caps";
import { isTee } from "../shop";
import { absoluteUrl, localizedUrl, SITE_NAME, siteUrl } from "./site";

type JsonLd = Record<string, unknown>;

export function organizationJsonLd(base: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: SITE_NAME,
    alternateName: "Good Luck Co.",
    url: base,
    logo: `${base}/brand/logo-512.png`,
    description: "Signature streetwear headwear crafted with high-density 3D puff embroidery and 0880 mythology.",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      availableLanguage: ["English", "Spanish"],
    },
  };
}

/** No SearchAction: the shop has no free-text search URL for Google's sitelinks search box. */
export function websiteJsonLd(base: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${base}/#website`,
    name: SITE_NAME,
    url: base,
    inLanguage: ["en", "es"],
    publisher: { "@id": `${base}/#organization` },
  };
}

export function productDescription(product: CapVariant, locale: string): string {
  const name = locale === "es" ? product.nameEs : product.nameEn;
  const price = `$${product.priceUsd} USD`;
  if (isTee(product)) {
    return locale === "es"
      ? `${name}: playera heavyweight de 280–300 GSM con corte boxy y serigrafía de alta densidad. ${price}.`
      : `${name}: 280–300 GSM heavyweight tee with a boxy cut and high-density screen print. ${price}.`;
  }
  return locale === "es"
    ? `${name}: gorra Good Luck 0880 con bordado 3D de alta densidad. ${price}.`
    : `${name}: Good Luck 0880 cap with high-density 3D puff embroidery. ${price}.`;
}

/** Product image for metadata and structured data: the Catalog Shot (ADR 0016), else the main image. */
export function productImageUrl(product: CapVariant, base: string = siteUrl()): string {
  return absoluteUrl(product.catalogShot ?? product.image, base);
}

export function productJsonLd(product: CapVariant, locale: string, base: string, now: Date): JsonLd {
  const name = locale === "es" ? product.nameEs : product.nameEn;
  const url = localizedUrl(locale, `/products/${product.id}`, base);
  const images = [product.catalogShot ?? product.image, ...(product.images ?? [])]
    .filter((src, i, all): src is string => !!src && all.indexOf(src) === i)
    .map((src) => absoluteUrl(src, base));
  const priceValidUntil = new Date(now);
  priceValidUntil.setUTCFullYear(priceValidUntil.getUTCFullYear() + 1);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name,
    url,
    image: images,
    description: productDescription(product, locale),
    sku: product.id,
    category: isTee(product) ? "Apparel & Accessories > Clothing > Shirts & Tops" : "Apparel & Accessories > Clothing Accessories > Hats",
    brand: { "@type": "Brand", name: SITE_NAME },
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "USD",
      price: product.priceUsd.toFixed(2),
      priceValidUntil: priceValidUntil.toISOString().slice(0, 10),
      itemCondition: "https://schema.org/NewCondition",
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@id": `${base}/#organization` },
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/** JSON for a `<script type="application/ld+json">`: `<` escaped so content cannot close the tag. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
