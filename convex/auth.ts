import { ConvexError } from "convex/values";
import { QueryCtx, MutationCtx } from "./_generated/server";

export const PRIMARY_ADMIN_EMAIL = "drny85@gmail.com";
export const PRIMARY_ADMIN_CLERK_ID = "user_3JSsegPcMNMPs5hqmqnpuy8ri6o";

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new ConvexError("Unauthorized: Staff authentication required.");
  }

  const email = identity.email?.toLowerCase() || "";
  const tokenIdentifier = identity.tokenIdentifier || "";
  const clerkId = identity.subject;
  const role = (identity as any).role;

  // 1. Fast-path check: primary email, primary clerk ID, or token claim
  const isPrimaryEmail = email === PRIMARY_ADMIN_EMAIL;
  const isPrimaryClerkId =
    tokenIdentifier.includes(PRIMARY_ADMIN_CLERK_ID) || clerkId === PRIMARY_ADMIN_CLERK_ID;
  const hasAdminRoleClaim = role === "admin";

  if (isPrimaryEmail || isPrimaryClerkId || hasAdminRoleClaim) {
    return identity;
  }

  // 2. Database verification: check users table by clerkId
  const userDoc = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .first();

  if (userDoc && userDoc.role === "admin" && !userDoc.deletedAt) {
    return identity;
  }

  throw new ConvexError(`Forbidden: Account ${email || tokenIdentifier} does not have administrator privileges.`);
}
