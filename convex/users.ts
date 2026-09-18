import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin, PRIMARY_ADMIN_EMAIL, PRIMARY_ADMIN_CLERK_ID } from "./auth";

/**
 * Just-In-Time (JIT) sync called by client upon authentication.
 * Mirrors the current Clerk user into the Convex users table immediately.
 */
export const syncCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const clerkId = identity.subject;
    const email = identity.email?.toLowerCase() || "";
    const name = identity.name || (identity.givenName ? `${identity.givenName} ${identity.familyName ?? ""}`.trim() : undefined);
    const imageUrl = identity.pictureUrl || (identity as any).imageUrl || undefined;
    const phone = identity.phoneNumber || undefined;

    // Determine role: primary admin or token role claim
    const isAdmin =
      email === PRIMARY_ADMIN_EMAIL ||
      clerkId === PRIMARY_ADMIN_CLERK_ID ||
      (identity as any).role === "admin";

    const role = isAdmin ? "admin" : "customer";

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: email || existing.email,
        name: name ?? existing.name,
        imageUrl: imageUrl ?? existing.imageUrl,
        phone: phone ?? existing.phone,
        role,
        deletedAt: undefined, // restore if previously deleted
        updatedAt: now,
      });
      return existing._id;
    }

    const id = await ctx.db.insert("users", {
      clerkId,
      email,
      name,
      role,
      imageUrl,
      phone,
      createdAt: now,
      updatedAt: now,
    });

    return id;
  },
});

/**
 * Upsert user called by webhook handler or administrative backfill scripts.
 */
export const upsertUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    role: v.string(), // "admin" | "customer"
    imageUrl: v.optional(v.string()),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email.toLowerCase(),
        name: args.name ?? existing.name,
        role: args.role,
        imageUrl: args.imageUrl ?? existing.imageUrl,
        phone: args.phone ?? existing.phone,
        deletedAt: undefined,
        updatedAt: now,
      });
      return { id: existing._id, action: "updated" };
    }

    const id = await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email.toLowerCase(),
      name: args.name,
      role: args.role,
      imageUrl: args.imageUrl,
      phone: args.phone,
      createdAt: now,
      updatedAt: now,
    });

    return { id, action: "created" };
  },
});

/**
 * Soft delete user called by webhook handler when user is deleted in Clerk.
 */
export const softDeleteUser = mutation({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (user) {
      await ctx.db.patch(user._id, {
        deletedAt: Date.now(),
        updatedAt: Date.now(),
      });
      return { success: true };
    }

    return { success: false, reason: "User not found" };
  },
});

/**
 * Query user document by Clerk ID.
 */
export const getUserByClerkId = query({
  args: {
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user || user.deletedAt) {
      return null;
    }

    return user;
  },
});

/**
 * Admin query to inspect all registered users and collectors.
 */
export const getAllUsersAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("users").order("desc").collect();
  },
});
