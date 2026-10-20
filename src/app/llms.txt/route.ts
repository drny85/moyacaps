import { unstable_rethrow } from "next/navigation";
import { api } from "@convex/_generated/api";
import { queryForStaticRender } from "@/lib/server/convexStatic";
import { toCapVariant } from "@/lib/toCapVariant";
import { buildLlmsTxt } from "@/lib/seo/llms";
import { siteUrl } from "@/lib/seo/site";

// Static, regenerated hourly like sitemap.xml (ISR, ADR 0020).
export const revalidate = 3600;

/** Live catalog, Category Status and shipping from Convex; the store brief alone if Convex is unreachable. */
async function storeFacts() {
  try {
    const [rows, launches, shipping] = await Promise.all([
      queryForStaticRender(api.catalog.queries.getVariants, {}),
      queryForStaticRender(api.settings.functions.getStorefrontLaunch, {}),
      queryForStaticRender(api.settings.functions.getStoreSettings, {}),
    ]);
    return { products: rows.map(toCapVariant), launches, shipping };
  } catch (error) {
    unstable_rethrow(error);
    console.error("llms.txt: Convex unavailable, serving the store brief only", error);
  }
  return { products: [], launches: undefined, shipping: undefined };
}

export async function GET() {
  const body = buildLlmsTxt({ ...(await storeFacts()), base: siteUrl() });
  return new Response(body, { headers: { "Content-Type": "text/markdown; charset=utf-8" } });
}
