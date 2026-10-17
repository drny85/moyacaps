import { ConvexError } from "convex/values";
import { QueryCtx, MutationCtx } from "../_generated/server";

export const PRIMARY_ADMIN_EMAIL = "drny85@gmail.com";
export const PRIMARY_ADMIN_CLERK_ID = "user_3JSsegPcMNMPs5hqmqnpuy8ri6o";

/**
 * The caller's identity when they are an Administrator, else null. Never throws, so public
 * queries can use it to decide whether an admin-only option (e.g. hidden products) applies.
 */
export async function getAdminIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;

  const email = identity.email?.toLowerCase() || "";
  const tokenIdentifier = identity.tokenIdentifier || "";
  const clerkId = identity.subject;

  // SECURITY: admin fast-path is the hardcoded allowlist ONLY. A "role" claim inside the
  // session token can originate from client-writable publicMetadata and must never
  // confer privileges by itself — DB verification below is the authoritative check.
  const isPrimaryEmail = email === PRIMARY_ADMIN_EMAIL;
  const isPrimaryClerkId =
    tokenIdentifier.includes(PRIMARY_ADMIN_CLERK_ID) || clerkId === PRIMARY_ADMIN_CLERK_ID;

  if (isPrimaryEmail || isPrimaryClerkId) {
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
  return null;
}

export async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  return (await getAdminIdentity(ctx)) !== null;
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthorized: Staff authentication required.");
  }
  const admin = await getAdminIdentity(ctx);
  if (!admin) {
    const email = identity.email?.toLowerCase() || "";
    throw new ConvexError(
      `Forbidden: Account ${email || identity.tokenIdentifier || ""} does not have administrator privileges.`
    );
  }
  return admin;
}
