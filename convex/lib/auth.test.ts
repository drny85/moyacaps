import { describe, expect, it, vi } from "vitest";
import {
  PRIMARY_ADMIN_CLERK_ID,
  PRIMARY_ADMIN_EMAIL,
  hasAdminAccess,
  isAdminInAction,
  isAdminRow,
  isAllowlistedAdmin,
  requireAdminInAction,
} from "./auth";

describe("isAllowlistedAdmin", () => {
  it("matches the Clerk ID or the email, case-insensitively", () => {
    expect(isAllowlistedAdmin({ subject: PRIMARY_ADMIN_CLERK_ID })).toBe(true);
    expect(isAllowlistedAdmin({ subject: "user_x", email: PRIMARY_ADMIN_EMAIL.toUpperCase() })).toBe(true);
    expect(isAllowlistedAdmin({ subject: "user_x", email: "someone@example.com" })).toBe(false);
  });

  it("does not match a Clerk ID that only contains the admin ID", () => {
    expect(isAllowlistedAdmin({ subject: `${PRIMARY_ADMIN_CLERK_ID}_evil` })).toBe(false);
  });
});

describe("isAdminRow / hasAdminAccess", () => {
  it("needs role admin and no soft delete", () => {
    expect(isAdminRow({ role: "admin" })).toBe(true);
    expect(isAdminRow({ role: "admin", deletedAt: 1 })).toBe(false);
    expect(isAdminRow({ role: "customer" })).toBe(false);
    expect(isAdminRow(null)).toBe(false);
  });

  it("denies anonymous callers even with an admin row", () => {
    expect(hasAdminAccess(null, { role: "admin" })).toBe(false);
    expect(hasAdminAccess({ subject: "user_x" }, { role: "admin" })).toBe(true);
  });
});

function actionCtx(identity: { subject: string; email?: string } | null, rowIsAdmin: boolean) {
  return {
    auth: { getUserIdentity: vi.fn(async () => identity as never) },
    runQuery: vi.fn(async () => rowIsAdmin as never),
  };
}

describe("isAdminInAction / requireAdminInAction", () => {
  it("skips the row lookup for the allowlisted admin", async () => {
    const ctx = actionCtx({ subject: PRIMARY_ADMIN_CLERK_ID }, false);
    expect(await isAdminInAction(ctx as never)).toBe(true);
    expect(ctx.runQuery).not.toHaveBeenCalled();
  });

  it("asks the users row for everyone else", async () => {
    expect(await isAdminInAction(actionCtx({ subject: "user_staff" }, true) as never)).toBe(true);
    expect(await isAdminInAction(actionCtx({ subject: "user_cust" }, false) as never)).toBe(false);
  });

  it("throws Unauthorized when signed out and Forbidden for customers", async () => {
    await expect(requireAdminInAction(actionCtx(null, false) as never)).rejects.toThrow(/Unauthorized/);
    await expect(
      requireAdminInAction(actionCtx({ subject: "user_cust" }, false) as never)
    ).rejects.toThrow(/Forbidden/);
  });
});
