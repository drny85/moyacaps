import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo/site";

const PRIVATE = ["/admin", "/checkout", "/account", "/unsubscribe"];

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  // Private areas also send `noindex` from their layouts; this keeps crawl budget off them.
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE.flatMap((p) => [p, `/*${p}`]) }],
    sitemap: `${base}/sitemap.xml`,
  };
}
