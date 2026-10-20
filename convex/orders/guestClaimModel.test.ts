import { describe, expect, it } from "vitest";
import { claimableEmail, isClaimable, normalizeEmail } from "./guestClaimModel";

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Ana.Diaz@Example.COM ")).toBe("ana.diaz@example.com");
  });

  it("treats empty and missing as no email", () => {
    expect(normalizeEmail("   ")).toBeUndefined();
    expect(normalizeEmail("")).toBeUndefined();
    expect(normalizeEmail(null)).toBeUndefined();
    expect(normalizeEmail(undefined)).toBeUndefined();
  });
});

describe("claimableEmail", () => {
  it("returns the normalized address once Clerk has verified it", () => {
    expect(claimableEmail("Ana@Example.com", true)).toBe("ana@example.com");
  });

  it("claims nothing unless verification is an explicit true", () => {
    expect(claimableEmail("ana@example.com", false)).toBeNull();
    expect(claimableEmail("ana@example.com", undefined)).toBeNull();
  });

  it("claims nothing without an email", () => {
    expect(claimableEmail("", true)).toBeNull();
    expect(claimableEmail(undefined, true)).toBeNull();
  });
});

describe("isClaimable", () => {
  it("only a guest Order is claimable", () => {
    expect(isClaimable({ clerkUserId: undefined })).toBe(true);
    expect(isClaimable({ clerkUserId: "" })).toBe(true);
    expect(isClaimable({ clerkUserId: "user_owner" })).toBe(false);
  });
});
