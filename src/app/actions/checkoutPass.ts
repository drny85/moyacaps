"use server";

import { headers } from "next/headers";
import { issueCheckoutPass } from "../../../convex/lib/checkoutPass";
import { clientIp } from "@/lib/server/clientIp";

/**
 * A guest's Checkout Pass (ADR 0029): lets createCheckoutSession rate-limit this client IP on
 * its own instead of in the bucket every guest shares. Null when CHECKOUT_PASS_SECRET is unset
 * or the request has no client IP; checkout then falls back to the shared bucket.
 */
export async function getCheckoutPass(): Promise<string | null> {
  const secret = process.env.CHECKOUT_PASS_SECRET;
  const ip = clientIp(await headers());
  if (!secret || !ip) return null;
  return await issueCheckoutPass(secret, ip, Date.now());
}
