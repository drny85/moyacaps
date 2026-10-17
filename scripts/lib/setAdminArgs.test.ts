import { describe, expect, it } from "vitest";
import { parseSetAdminArgs } from "./setAdminArgs";

describe("parseSetAdminArgs", () => {
  it("grants admin by email on dev by default", () => {
    expect(parseSetAdminArgs(["Staff@Example.com"])).toEqual({
      target: { email: "staff@example.com" },
      role: "admin",
      prod: false,
    });
  });

  it("treats user_ targets as Clerk IDs and honors --revoke and --prod", () => {
    expect(parseSetAdminArgs(["user_abc", "--revoke", "--prod"])).toEqual({
      target: { clerkId: "user_abc" },
      role: "customer",
      prod: true,
    });
  });

  it("rejects missing, extra, or malformed targets and unknown flags", () => {
    expect(() => parseSetAdminArgs([])).toThrow(/Usage/);
    expect(() => parseSetAdminArgs(["a@b.co", "c@d.co"])).toThrow(/Usage/);
    expect(() => parseSetAdminArgs(["not-an-email"])).toThrow(/Usage/);
    expect(() => parseSetAdminArgs(["a@b.co", "--force"])).toThrow(/Usage/);
  });
});
