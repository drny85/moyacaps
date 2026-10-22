import { describe, expect, it } from "vitest";
import { checkoutCustomerEmail, resolveCheckoutLocale, resolveCheckoutOrigin } from "./checkoutOrigin";

const APP = "https://goodluckcaps.com/";

describe("resolveCheckoutOrigin", () => {
  it("keeps our own origins", () => {
    expect(resolveCheckoutOrigin("https://goodluckcaps.com", APP)).toBe("https://goodluckcaps.com");
    expect(resolveCheckoutOrigin("https://www.goodluckcaps.com", APP)).toBe("https://www.goodluckcaps.com");
    expect(resolveCheckoutOrigin("https://moyacaps.vercel.app", APP)).toBe("https://moyacaps.vercel.app");
    expect(resolveCheckoutOrigin("https://moyacaps-git-fix-x-drny85s-projects.vercel.app", APP)).toBe(
      "https://moyacaps-git-fix-x-drny85s-projects.vercel.app"
    );
    expect(resolveCheckoutOrigin("http://localhost:3000", APP)).toBe("http://localhost:3000");
    expect(resolveCheckoutOrigin("https://staging.example.com", "https://staging.example.com")).toBe("https://staging.example.com");
  });

  it("replaces anything else with the site URL", () => {
    expect(resolveCheckoutOrigin("https://evil.example", APP)).toBe("https://goodluckcaps.com");
    expect(resolveCheckoutOrigin("https://goodluckcaps.com.evil.example", APP)).toBe("https://goodluckcaps.com");
    expect(resolveCheckoutOrigin("https://moyacaps-evil.vercel.app", APP)).toBe("https://goodluckcaps.com");
    expect(resolveCheckoutOrigin("https://moyacaps-x-someone-else.vercel.app", APP)).toBe("https://goodluckcaps.com");
    expect(resolveCheckoutOrigin("javascript:alert(1)", APP)).toBe("https://goodluckcaps.com");
    expect(resolveCheckoutOrigin("not a url", APP)).toBe("https://goodluckcaps.com");
  });

  it("drops any path smuggled into the origin", () => {
    expect(resolveCheckoutOrigin("https://goodluckcaps.com/@evil.example", APP)).toBe("https://goodluckcaps.com");
  });

  it("falls back to production when the site URL is unset or invalid", () => {
    expect(resolveCheckoutOrigin("https://evil.example", undefined)).toBe("https://goodluckcaps.com");
    expect(resolveCheckoutOrigin("https://evil.example", "nope")).toBe("https://goodluckcaps.com");
  });
});

describe("resolveCheckoutLocale", () => {
  it("allows en and es only", () => {
    expect(resolveCheckoutLocale("es")).toBe("es");
    expect(resolveCheckoutLocale("en")).toBe("en");
    expect(resolveCheckoutLocale("../../evil")).toBe("en");
  });
});

describe("checkoutCustomerEmail", () => {
  it("prefers the token's verified email over what the browser sent", () => {
    expect(checkoutCustomerEmail({ email: "Me@Example.com", emailVerified: true }, "victim@example.com")).toBe("me@example.com");
  });

  it("falls back to a well-formed browser email, else none", () => {
    expect(checkoutCustomerEmail({ email: "me@example.com", emailVerified: false }, " Ana@Example.com ")).toBe("ana@example.com");
    expect(checkoutCustomerEmail(null, "ana@example.com")).toBe("ana@example.com");
    expect(checkoutCustomerEmail(null, "not-an-email")).toBeUndefined();
    expect(checkoutCustomerEmail(null, "a@b.com,c@d.com")).toBeUndefined();
    expect(checkoutCustomerEmail(null, undefined)).toBeUndefined();
  });
});
