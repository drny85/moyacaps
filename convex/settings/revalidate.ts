/**
 * Asks the Next.js site to rebuild its static storefront pages now (ADR 0022). Best effort:
 * a failure is logged and ISR catches up within 5 minutes (ADR 0020).
 */
import { v } from "convex/values";
import { internalAction } from "../_generated/server";

export const revalidateStorefront = internalAction({
  args: {},
  returns: v.null(),
  handler: async () => {
    const siteUrl = process.env.NEXT_PUBLIC_APP_URL;
    const secret = process.env.REVALIDATE_SECRET;
    if (!siteUrl || !secret) {
      console.warn("revalidateStorefront: NEXT_PUBLIC_APP_URL or REVALIDATE_SECRET is not set; relying on ISR");
      return null;
    }
    try {
      const response = await fetch(`${siteUrl.replace(/\/$/, "")}/api/revalidate`, {
        method: "POST",
        headers: { "x-revalidate-secret": secret },
      });
      if (!response.ok) console.error(`revalidateStorefront: site answered ${response.status}`);
    } catch (error) {
      console.error("revalidateStorefront: request failed", error);
    }
    return null;
  },
});
