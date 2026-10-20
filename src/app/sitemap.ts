import type { MetadataRoute } from "next";
import { unstable_rethrow } from "next/navigation";
import { api } from "@convex/_generated/api";
import { queryForStaticRender } from "@/lib/server/convexStatic";
import { toCapVariant } from "@/lib/toCapVariant";
import { buildSitemap, NONE_LIVE } from "@/lib/seo/sitemap";
import { siteUrl } from "@/lib/seo/site";

// Static, regenerated hourly (ISR, ADR 0020), so new or hidden products reach Google without a redeploy.
export const revalidate = 3600;

/**
 * Live catalog and Category Status from Convex (ADR 0015, 0022). If Convex is unreachable,
 * Category Status is unknown, so list only the pages that can't 404 until the next revalidation.
 * An empty catalog is real (every category may be Coming Soon).
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
    console.error("sitemap: Convex catalog unavailable, listing ungated pages only", error);
  }
  return { products: [], launches: NONE_LIVE };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { products, launches } = await catalog();
  return buildSitemap(products, siteUrl(), new Date(), launches);
}
