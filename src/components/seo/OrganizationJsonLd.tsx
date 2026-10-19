import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/jsonLd";
import { siteUrl } from "@/lib/seo/site";
import { JsonLd } from "./JsonLd";

export function OrganizationJsonLd() {
  const base = siteUrl();
  return <JsonLd data={[organizationJsonLd(base), websiteJsonLd(base)]} />;
}
