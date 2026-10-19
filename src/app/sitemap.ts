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

/**
 * Live catalog and Category Status from Convex (ADR 0015, 0022); the static catalog only if
 * Convex is unreachable. An empty catalog is real (every category may be Coming Soon).
 */
async function catalog() {
  try {
    const [rows, launches] = await Promise.all([
      queryForStaticRender(api.catalog.queries.getVariants, {}),
      queryForStaticRender(api.settings.functions.getStorefrontLaunch, {}),
    ]);
    return { products: rows.map(toCapVariant), launches };
  } catch (error) {
    unstable_rethrow(error);
    console.error("sitemap: Convex catalog unavailable, using static catalog", error);
  }
  return { products: CAP_VARIANTS, launches: undefined };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products, launches } = await catalog();
  return buildSitemap(products, siteUrl(), new Date(), launches);
}
