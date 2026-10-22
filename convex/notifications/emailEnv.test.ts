import { describe, expect, it } from "vitest";
import { emailBaseUrl, isSendableEmail } from "./emailEnv";

describe("emailBaseUrl", () => {
  it("strips trailing slashes and falls back to production", () => {
    expect(emailBaseUrl("https://staging.example.com//")).toBe("https://staging.example.com");
    expect(emailBaseUrl("https://goodluckcaps.com")).toBe("https://goodluckcaps.com");
    expect(emailBaseUrl(undefined)).toBe("https://goodluckcaps.com");
    expect(emailBaseUrl("  ")).toBe("https://goodluckcaps.com");
  });
});

describe("isSendableEmail", () => {
  it("accepts one plain address", () => {
    expect(isSendableEmail("ana@example.com")).toBe(true);
    expect(isSendableEmail(" ana@example.com ")).toBe(true);
  });

  it("rejects blanks, missing parts and address lists", () => {
    for (const bad of [undefined, null, "", "ana", "ana@", "@example.com", "ana@example", "a@b.com,c@d.com", "a b@c.com"]) {
      expect(isSendableEmail(bad)).toBe(false);
    }
  });
});
