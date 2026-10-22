import { describe, expect, it } from "vitest";
import { CHECKOUT_PASS_TTL_MS, guestKeyForIp, issueCheckoutPass, verifyCheckoutPass } from "./checkoutPass";

const SECRET = "test-checkout-pass-secret";
const NOW = 1_800_000_000_000;

describe("checkout pass", () => {
  it("verifies a fresh pass to its IP's guest key, without carrying the IP", async () => {
    const pass = await issueCheckoutPass(SECRET, "203.0.113.7", NOW);
    expect(pass).not.toContain("203.0.113.7");
    expect(await verifyCheckoutPass(pass, SECRET, NOW + 1_000)).toBe(await guestKeyForIp(SECRET, "203.0.113.7"));
  });

  it("gives different IPs different keys and the same IP the same key", async () => {
    const a = await guestKeyForIp(SECRET, "203.0.113.7");
    expect(await guestKeyForIp(SECRET, "203.0.113.7")).toBe(a);
    expect(await guestKeyForIp(SECRET, "203.0.113.8")).not.toBe(a);
  });

  it("rejects an expired pass and one issued too far in the future", async () => {
    const pass = await issueCheckoutPass(SECRET, "203.0.113.7", NOW);
    expect(await verifyCheckoutPass(pass, SECRET, NOW + CHECKOUT_PASS_TTL_MS)).not.toBeNull();
    expect(await verifyCheckoutPass(pass, SECRET, NOW + CHECKOUT_PASS_TTL_MS + 1)).toBeNull();
    expect(await verifyCheckoutPass(pass, SECRET, NOW - 31_000)).toBeNull();
  });

  it("rejects a pass signed with another secret", async () => {
    const pass = await issueCheckoutPass("other-secret", "203.0.113.7", NOW);
    expect(await verifyCheckoutPass(pass, SECRET, NOW)).toBeNull();
  });

  it("rejects a pass whose key or timestamp was swapped", async () => {
    const pass = await issueCheckoutPass(SECRET, "203.0.113.7", NOW);
    const [, issuedAt, signature] = pass.split(".");
    const otherKey = await guestKeyForIp(SECRET, "198.51.100.1");
    expect(await verifyCheckoutPass(`${otherKey}.${issuedAt}.${signature}`, SECRET, NOW)).toBeNull();
    const [guestKey] = pass.split(".");
    expect(await verifyCheckoutPass(`${guestKey}.${NOW + 1}.${signature}`, SECRET, NOW)).toBeNull();
  });

  it("rejects a missing pass, a missing secret and malformed passes", async () => {
    const pass = await issueCheckoutPass(SECRET, "203.0.113.7", NOW);
    expect(await verifyCheckoutPass(undefined, SECRET, NOW)).toBeNull();
    expect(await verifyCheckoutPass(pass, undefined, NOW)).toBeNull();
    expect(await verifyCheckoutPass("", SECRET, NOW)).toBeNull();
    expect(await verifyCheckoutPass("a.b", SECRET, NOW)).toBeNull();
    expect(await verifyCheckoutPass(`${pass}.extra`, SECRET, NOW)).toBeNull();
    expect(await verifyCheckoutPass(pass.replace(/^./, "Z"), SECRET, NOW)).toBeNull();
  });
});
