import { revalidatePath } from "next/cache";
import { isValidRevalidateSecret } from "@/lib/server/revalidateSecret";

/**
 * Called by Convex (`settings/revalidate:revalidateStorefront`) when a Category Status
 * changes, so the static storefront updates now instead of within the 5-minute ISR window
 * (ADR 0020, ADR 0022).
 */
export async function POST(request: Request) {
  if (!isValidRevalidateSecret(request.headers.get("x-revalidate-secret"), process.env.REVALIDATE_SECRET)) {
    return new Response(null, { status: 401 });
  }
  revalidatePath("/[locale]", "layout");
  // sitemap.xml sits outside [locale]; without this it lists hidden products for up to an hour
  revalidatePath("/sitemap.xml");
  return new Response(null, { status: 204 });
}
