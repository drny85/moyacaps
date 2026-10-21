/**
 * Schema.org structured data builders (Google rich results). Pure: callers pass the
 * site origin and clock so output is deterministic in tests.
 */
import type { ShippingSettings } from "../../../convex/settings/model";
import type { CapVariant } from "../../data/caps";
import { SUPPORT_EMAIL } from "../legal";
import { customDescription } from "../productCopy";
import { isTee } from "../shop";
import { absoluteUrl, INSTAGRAM_URL, localizedUrl, SITE_NAME, siteUrl } from "./site";

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
    description:
      "New York streetwear brand. 0880 is Dominican street slang for “nobody saw anything,” the unwritten code of silence. Signature 0880 caps with high-density 3D puff embroidery and heavyweight graphic tees.",
    areaServed: "US",
    sameAs: [INSTAGRAM_URL],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: SUPPORT_EMAIL,
      availableLanguage: ["English", "Spanish"],
    },
    hasMerchantReturnPolicy: returnPolicyJsonLd("en", base),
  };
}

/**
 * The Return Policy page as schema.org: all sales are final, so returns are not permitted.
 * Refunds for undelivered packages and refunds or exchanges for defective items are not
 * returns in schema.org's sense, so only the linked page describes them.
 */
export function returnPolicyJsonLd(locale: string, base: string): JsonLd {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "US",
    returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
    merchantReturnLink: localizedUrl(locale, "/returns", base),
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

/** Administrator's description when set, else the generated copy. */
export function productDescription(product: CapVariant, locale: string): string {
  const custom = customDescription(product, locale);
  if (custom) return custom;
  const name = locale === "es" ? product.nameEs : product.nameEn;
  const price = `$${product.priceUsd} USD`;
  if (isTee(product)) {
    // Weight varies by tee, so quote this tee's own fabric line rather than a store-wide GSM figure
    const fabric = (locale === "es" ? product.fabricEs : product.fabricEn)?.trim();
    return locale === "es"
      ? `${name}: playera heavyweight con corte boxy y serigrafía de alta densidad.${fabric ? ` ${fabric}.` : ""} ${price}.`
      : `${name}: heavyweight tee with a boxy cut and high-density screen print.${fabric ? ` ${fabric}.` : ""} ${price}.`;
  }
  return locale === "es"
    ? `${name}: gorra Good Luck 0880 con bordado 3D de alta densidad. ${price}.`
    : `${name}: Good Luck 0880 cap with high-density 3D puff embroidery. ${price}.`;
}

/** Product image for metadata and structured data: the Catalog Shot (ADR 0016), else the main image. */
export function productImageUrl(product: CapVariant, base: string = siteUrl()): string {
  return absoluteUrl(product.catalogShot ?? product.image, base);
}

/**
 * One flat US rate, as the Terms and product page state it: ships within 24 hours, Standard
 * arrives in 2–5 business days. The free-on-N-items rule has no schema.org form, so the page
 * text carries it.
 */
function shippingDetailsJsonLd(shipping: ShippingSettings): JsonLd {
  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: shipping.flatShippingFeeUsd.toFixed(2), currency: "USD" },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: 2, maxValue: 5, unitCode: "DAY" },
    },
  };
}

/** `shipping` comes from store settings; without it the offer carries no shipping details. */
export function productJsonLd(product: CapVariant, locale: string, base: string, now: Date, shipping?: ShippingSettings): JsonLd {
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
      ...(shipping ? { shippingDetails: shippingDetailsJsonLd(shipping) } : {}),
      hasMerchantReturnPolicy: returnPolicyJsonLd(locale, base),
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
