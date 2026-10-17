import { describe, expect, it } from "vitest";
import { adminStatus } from "../lib/auth/adminStatus";

describe("adminStatus", () => {
  it("is loading while auth resolves", () => {
    expect(adminStatus({ isLoading: true, isAuthenticated: false }, undefined)).toEqual({
      isAdmin: false,
      isLoading: true,
    });
  });

  it("is a settled non-admin when signed out", () => {
    expect(adminStatus({ isLoading: false, isAuthenticated: false }, undefined)).toEqual({
      isAdmin: false,
      isLoading: false,
    });
  });

  it("waits for Convex before granting admin", () => {
    expect(adminStatus({ isLoading: false, isAuthenticated: true }, undefined)).toEqual({
      isAdmin: false,
      isLoading: true,
    });
  });

  it("follows the Convex answer once it arrives", () => {
    const auth = { isLoading: false, isAuthenticated: true };
    expect(adminStatus(auth, true)).toEqual({ isAdmin: true, isLoading: false });
    expect(adminStatus(auth, false)).toEqual({ isAdmin: false, isLoading: false });
  });
});
