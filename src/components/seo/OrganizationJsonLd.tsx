import React from "react";

export function OrganizationJsonLd() {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://moyacaps.vercel.app").replace(/\/$/, "");

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Good Luck",
    alternateName: "Good Luck Co.",
    url: siteUrl,
    logo: `${siteUrl}/caps/negro-rojo.png`,
    description: "Signature streetwear headwear crafted with high-density 3D puff embroidery and 0880 mythology.",
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer concierge",
      availableLanguage: ["English", "Spanish"],
    },
  };

  const webSiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Good Luck",
    url: siteUrl,
    inLanguage: ["en", "es"],
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/en/caps/{search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteSchema) }}
      />
    </>
  );
}
