import { describe, expect, it } from "vitest";
import { checkoutRateLimitError, checkoutRateLimitKey } from "./checkoutRateLimit";

describe("checkoutRateLimitKey", () => {
  it("keys signed-in buyers by subject, guests by verified pass key, else the shared bucket", () => {
    expect(checkoutRateLimitKey("user_1")).toEqual({ name: "checkoutPerBuyer", key: "user:user_1" });
    expect(checkoutRateLimitKey("user_1", "abc")).toEqual({ name: "checkoutPerBuyer", key: "user:user_1" });
    expect(checkoutRateLimitKey(undefined, "abc")).toEqual({ name: "checkoutPerGuestIp", key: "ip:abc" });
    expect(checkoutRateLimitKey(undefined, null)).toEqual({ name: "checkoutAnonymous", key: undefined });
    expect(checkoutRateLimitKey(undefined)).toEqual({ name: "checkoutAnonymous", key: undefined });
  });
});

describe("checkoutRateLimitError", () => {
  it("rounds the wait up to whole minutes, at least one, in the cart's language", () => {
    expect(checkoutRateLimitError(5_000, "en")).toBe("Too many checkout attempts. Try again in 1 min.");
    expect(checkoutRateLimitError(61_000, "en")).toBe("Too many checkout attempts. Try again in 2 min.");
    expect(checkoutRateLimitError(0, "es")).toBe("Demasiados intentos de pago. Intenta de nuevo en 1 min.");
  });
});
