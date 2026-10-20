/**
 * Guest Order claims (ADR 0026): which email a signed-in Customer may claim guest Orders by,
 * and which Orders that claim attaches to their account. Pure; no ctx.
 */
import type { Doc } from "../_generated/dataModel";

/** Guest Orders one claim attaches; a later sign-in or webhook takes the rest. */
export const MAX_ORDERS_CLAIMED = 100;

/** The one stored form of an email: trimmed and lowercased, so the `by_customerEmail` index matches exactly. */
export function normalizeEmail(email: string | null | undefined): string | undefined {
  const normalized = email?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

/**
 * The email a Customer may claim guest Orders by: their own address, and only once Clerk has
 * verified it. Anything short of an explicit `true` (a token without the claim, a pending or
 * failed verification) claims nothing, so an unverified sign-up can never take another
 * person's Orders.
 */
export function claimableEmail(email: string | null | undefined, emailVerified: boolean | undefined): string | null {
  if (emailVerified !== true) return null;
  return normalizeEmail(email) ?? null;
}

/** A guest Order: no owner account yet. An Order that already has an owner is never reassigned. */
export function isClaimable(order: Pick<Doc<"orders">, "clerkUserId">): boolean {
  return !order.clerkUserId;
}
