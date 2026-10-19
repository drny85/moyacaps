import type { MetadataRoute } from "next";
import { unstable_rethrow } from "next/navigation";
import { api } from "@convex/_generated/api";
import { CAP_VARIANTS } from "@/data/caps";
import { queryForStaticRender } from "@/lib/server/convexStatic";
import { toCapVariant } from "@/lib/toCapVariant";
import { buildSitemap } from "@/lib/seo/sitemap";
import { siteUrl } from "@/lib/seo/site";

// Static, regenerated hourly (ISR, ADR 0020), so new or hidden products reach Google without a redeploy.
export const revalidate = 3600;

/** Live catalog from Convex (ADR 0015); the static catalog only if Convex is unreachable. */
async function catalog() {
  try {
    const rows = await queryForStaticRender(api.catalog.queries.getVariants, {});
    if (rows.length > 0) return rows.map(toCapVariant);
  } catch (error) {
    unstable_rethrow(error);
    console.error("sitemap: Convex catalog unavailable, using static catalog", error);
  }
  return CAP_VARIANTS;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemap(await catalog(), siteUrl(), new Date());
}
