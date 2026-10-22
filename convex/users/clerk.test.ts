import { describe, expect, it } from "vitest";
import { roleFor, toUserUpsert } from "./clerk";
import { PRIMARY_ADMIN_CLERK_ID, PRIMARY_ADMIN_EMAIL } from "../lib/auth";

describe("toUserUpsert", () => {
  it("uses the primary email, not the first one, and lowercases it", () => {
    const upsert = toUserUpsert({
      id: "user_1",
      primary_email_address_id: "e2",
      email_addresses: [
        { id: "e1", email_address: "old@example.com" },
        { id: "e2", email_address: " Jane@Example.COM " },
      ],
      first_name: "Jane",
      last_name: "Doe",
      image_url: "https://img.clerk.com/jane",
    });

    expect(upsert).toEqual({
      clerkId: "user_1",
      email: "jane@example.com",
      emailVerified: false,
      name: "Jane Doe",
      role: "customer",
      imageUrl: "https://img.clerk.com/jane",
      phone: undefined,
    });
  });

  it("reports the primary email verified only when Clerk says so", () => {
    const user = (status?: string) =>
      toUserUpsert({
        id: "user_3",
        primary_email_address_id: "e2",
        email_addresses: [
          { id: "e1", email_address: "other@example.com", verification: { status: "verified" } },
          { id: "e2", email_address: "jane@example.com", verification: status ? { status } : null },
        ],
      });

    expect(user("verified").emailVerified).toBe(true);
    expect(user("unverified").emailVerified).toBe(false);
    expect(user().emailVerified).toBe(false);
  });

  it("falls back to the first email and primary phone", () => {
    const upsert = toUserUpsert({
      id: "user_2",
      email_addresses: [{ id: "e1", email_address: "a@b.co" }],
      primary_phone_number_id: "p2",
      phone_numbers: [
        { id: "p1", phone_number: "+15550001" },
        { id: "p2", phone_number: "+15550002" },
      ],
    });

    expect(upsert.email).toBe("a@b.co");
    expect(upsert.phone).toBe("+15550002");
    expect(upsert.name).toBeUndefined();
  });

  it("returns an empty email for phone-only accounts", () => {
    expect(toUserUpsert({ id: "user_3", email_addresses: [] }).email).toBe("");
  });

  it("never grants admin from client-writable metadata", () => {
    const payload = { id: "user_4", public_metadata: { role: "admin" } } as never;
    expect(toUserUpsert(payload).role).toBe("customer");
  });
});

describe("roleFor", () => {
  it("grants admin only to the allowlist", () => {
    expect(roleFor(PRIMARY_ADMIN_EMAIL, "user_x", true)).toBe("admin");
    expect(roleFor("someone@example.com", PRIMARY_ADMIN_CLERK_ID, false)).toBe("admin");
    expect(roleFor("someone@example.com", "user_x", true)).toBe("customer");
  });

  it("does not grant admin to an unverified admin email", () => {
    expect(roleFor(PRIMARY_ADMIN_EMAIL, "user_x", false)).toBe("customer");
    expect(roleFor(PRIMARY_ADMIN_EMAIL, "user_x", undefined)).toBe("customer");
  });
});
