/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { PRIMARY_ADMIN_EMAIL } from "../lib/auth";

const modules = import.meta.glob("/convex/**/*.ts");

async function seedUser(t: ReturnType<typeof convexTest>, clerkId: string, email: string) {
  await t.withIdentity({ subject: clerkId, email }).mutation(api.users.functions.syncCurrentUser, {});
}

describe("admin role (users/functions)", () => {
  it("amIAdmin is false when signed out and for customers", async () => {
    const t = convexTest(schema, modules);
    expect(await t.query(api.users.functions.amIAdmin, {})).toBe(false);
    await seedUser(t, "user_cust", "cust@example.com");
    expect(await t.withIdentity({ subject: "user_cust" }).query(api.users.functions.amIAdmin, {})).toBe(false);
  });

  it("amIAdmin is true for the allowlisted admin before any row exists", async () => {
    const t = convexTest(schema, modules);
    const admin = t.withIdentity({ subject: "user_owner", email: PRIMARY_ADMIN_EMAIL });
    expect(await admin.query(api.users.functions.amIAdmin, {})).toBe(true);
  });

  it("setUserRole grants by email and revokes by Clerk ID, and the change reaches every check", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "user_staff", "staff@example.com");
    const staff = t.withIdentity({ subject: "user_staff" });

    await t.mutation(internal.users.functions.setUserRole, { email: "Staff@Example.com", role: "admin" });
    expect(await staff.query(api.users.functions.amIAdmin, {})).toBe(true);
    expect(await t.query(internal.users.functions.isAdminInternal, { clerkId: "user_staff" })).toBe(true);
    await expect(staff.query(api.users.functions.getAllUsersAdmin, {})).resolves.toBeDefined();

    await t.mutation(internal.users.functions.setUserRole, { clerkId: "user_staff", role: "customer" });
    expect(await staff.query(api.users.functions.amIAdmin, {})).toBe(false);
    await expect(staff.query(api.users.functions.getAllUsersAdmin, {})).rejects.toThrow(/Forbidden/);
  });

  it("a soft-deleted admin row loses access", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "user_staff", "staff@example.com");
    await t.mutation(internal.users.functions.setUserRole, { clerkId: "user_staff", role: "admin" });
    await t.mutation(internal.users.functions.softDeleteUser, { clerkId: "user_staff" });
    expect(await t.query(internal.users.functions.isAdminInternal, { clerkId: "user_staff" })).toBe(false);
  });

  it("re-syncing never demotes a granted admin", async () => {
    const t = convexTest(schema, modules);
    await seedUser(t, "user_staff", "staff@example.com");
    await t.mutation(internal.users.functions.setUserRole, { clerkId: "user_staff", role: "admin" });
    await seedUser(t, "user_staff", "staff@example.com");
    expect(await t.query(internal.users.functions.isAdminInternal, { clerkId: "user_staff" })).toBe(true);
  });

  it("setUserRole refuses unknown users, ambiguous targets, and demoting the allowlisted admin", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(internal.users.functions.setUserRole, { email: "nobody@example.com", role: "admin" })
    ).rejects.toThrow(/No active user/);
    await expect(
      t.mutation(internal.users.functions.setUserRole, { role: "admin" })
    ).rejects.toThrow(/exactly one/);
    await seedUser(t, "user_owner", PRIMARY_ADMIN_EMAIL);
    await expect(
      t.mutation(internal.users.functions.setUserRole, { clerkId: "user_owner", role: "customer" })
    ).rejects.toThrow(/cannot be demoted/);
  });
});
