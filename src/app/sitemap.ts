import type { MetadataRoute } from "next";
import { unstable_rethrow } from "next/navigation";
import { fetchQuery } from "convex/nextjs";
import { api } from "@convex/_generated/api";
import { CAP_VARIANTS } from "@/data/caps";
import { toCapVariant } from "@/lib/toCapVariant";
import { buildSitemap } from "@/lib/seo/sitemap";
import { siteUrl } from "@/lib/seo/site";

// Rendered per request from the live catalog, so new or hidden products reach Google without a redeploy.
export const dynamic = "force-dynamic";

/** Live catalog from Convex (ADR 0015); the static catalog only if Convex is unreachable. */
async function catalog() {
  try {
    const rows = await fetchQuery(api.catalog.queries.getVariants, {});
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
