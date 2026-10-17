import { ConvexError } from "convex/values";
import type { UserIdentity } from "convex/server";
import type { Doc } from "../_generated/dataModel";
import type { ActionCtx, QueryCtx, MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Admin access, one source of truth (server and UI both ask Convex).
 *
 * An identity is an Administrator when it is on the allowlist below, or when its
 * `users` row has role "admin" and is not soft-deleted. Grant or revoke the row role
 * with `bun run set-admin` (users/functions:setUserRole).
 *
 * SECURITY: never read a "role" from the token or Clerk publicMetadata. Both can be
 * written from the client and must not confer privileges.
 */
export const PRIMARY_ADMIN_EMAIL = "drny85@gmail.com";
export const PRIMARY_ADMIN_CLERK_ID = "user_3JSsegPcMNMPs5hqmqnpuy8ri6o";

type AdminIdentity = Pick<UserIdentity, "subject" | "email">;
type AdminUserRow = Pick<Doc<"users">, "role" | "deletedAt"> | null | undefined;

/** Bootstrap admin: always an Administrator, even before a users row exists. */
export function isAllowlistedAdmin(identity: AdminIdentity): boolean {
  return (
    identity.subject === PRIMARY_ADMIN_CLERK_ID ||
    identity.email?.trim().toLowerCase() === PRIMARY_ADMIN_EMAIL
  );
}

/** Admin by users row: role "admin" and not soft-deleted. */
export function isAdminRow(user: AdminUserRow): boolean {
  return user?.role === "admin" && !user.deletedAt;
}

export function hasAdminAccess(identity: AdminIdentity | null, user: AdminUserRow): boolean {
  if (!identity) return false;
  return isAllowlistedAdmin(identity) || isAdminRow(user);
}

async function userRowFor(ctx: QueryCtx | MutationCtx, clerkId: string) {
  return await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .first();
}

/**
 * The caller's identity when they are an Administrator, else null. Never throws, so public
 * queries can use it to decide whether an admin-only option (e.g. hidden products) applies.
 */
export async function getAdminIdentity(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  if (isAllowlistedAdmin(identity)) return identity;
  return isAdminRow(await userRowFor(ctx, identity.subject)) ? identity : null;
}

export async function isAdmin(ctx: QueryCtx | MutationCtx): Promise<boolean> {
  return (await getAdminIdentity(ctx)) !== null;
}

function forbidden(identity: UserIdentity) {
  return new ConvexError(
    `Forbidden: Account ${identity.email || identity.tokenIdentifier} does not have administrator privileges.`
  );
}

const UNAUTHENTICATED = "Unauthorized: Staff authentication required.";

export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError(UNAUTHENTICATED);
  if (!(await getAdminIdentity(ctx))) throw forbidden(identity);
  return identity;
}

/** Actions have no ctx.db: the row check runs through users/functions:isAdminInternal. */
export async function isAdminInAction(ctx: Pick<ActionCtx, "auth" | "runQuery">): Promise<boolean> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return false;
  if (isAllowlistedAdmin(identity)) return true;
  return await ctx.runQuery(internal.users.functions.isAdminInternal, { clerkId: identity.subject });
}

export async function requireAdminInAction(ctx: Pick<ActionCtx, "auth" | "runQuery">) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new ConvexError(UNAUTHENTICATED);
  if (!(await isAdminInAction(ctx))) throw forbidden(identity);
  return identity;
}
