import { describe, expect, it } from "vitest";
import { resolveAdminRecipient } from "./adminRecipient";

const FALLBACK = "owner@example.com";

describe("resolveAdminRecipient", () => {
  it("uses ADMIN_NOTIFICATION_EMAIL when it is one valid address", () => {
    expect(resolveAdminRecipient("orders@goodluckcaps.com", FALLBACK)).toEqual({
      email: "orders@goodluckcaps.com",
      fromEnv: true,
    });
    expect(resolveAdminRecipient("  orders@goodluckcaps.com  ", FALLBACK).email).toBe("orders@goodluckcaps.com");
  });

  it("falls back when the variable is missing or blank", () => {
    expect(resolveAdminRecipient(undefined, FALLBACK)).toEqual({ email: FALLBACK, fromEnv: false });
    expect(resolveAdminRecipient("   ", FALLBACK)).toEqual({ email: FALLBACK, fromEnv: false });
  });

  it("falls back on a malformed value or a list, which Resend would reject as one recipient", () => {
    expect(resolveAdminRecipient("orders", FALLBACK).fromEnv).toBe(false);
    expect(resolveAdminRecipient("a@x.com, b@x.com", FALLBACK).fromEnv).toBe(false);
    expect(resolveAdminRecipient("a@x.com;b@x.com", FALLBACK).fromEnv).toBe(false);
  });
});
