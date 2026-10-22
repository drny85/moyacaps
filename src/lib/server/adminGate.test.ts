import { describe, expect, it, vi } from "vitest";
import { adminGate } from "./adminGate";

const deps = (over: Partial<Parameters<typeof adminGate>[0]> = {}) => ({
  userId: "user_1",
  getConvexToken: async () => "jwt",
  amIAdmin: async () => true,
  ...over,
});

describe("adminGate", () => {
  it("sends signed-out visitors to sign in without asking Convex", async () => {
    const amIAdmin = vi.fn(async () => true);
    expect(await adminGate(deps({ userId: null, amIAdmin }))).toBe("sign_in");
    expect(amIAdmin).not.toHaveBeenCalled();
  });

  it("allows only when Convex confirms the token is an Administrator", async () => {
    expect(await adminGate(deps())).toBe("allow");
    expect(await adminGate(deps({ amIAdmin: async () => false }))).toBe("deny");
  });

  it("denies a session with no Convex token", async () => {
    expect(await adminGate(deps({ getConvexToken: async () => null }))).toBe("deny");
  });

  it("passes the session's Convex token to the admin check", async () => {
    const amIAdmin = vi.fn(async () => true);
    await adminGate(deps({ getConvexToken: async () => "jwt-abc", amIAdmin }));
    expect(amIAdmin).toHaveBeenCalledWith("jwt-abc");
  });
});
