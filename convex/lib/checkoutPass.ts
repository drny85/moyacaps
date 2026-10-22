/**
 * Checkout Pass (security review M2): a short-lived token the Next.js server issues to a guest,
 * so createCheckoutSession can rate-limit guests per client IP. Convex actions see no client
 * IP; the Next.js server does. The pass carries a keyed hash of the IP (never the IP itself),
 * when it was issued, and an HMAC over both with CHECKOUT_PASS_SECRET, which only the Next.js
 * server and Convex hold. A browser cannot mint a pass for another bucket.
 *
 * Format: `<guestKey>.<issuedAtMs>.<signature>`, all hex except the timestamp.
 */
import { isValidSharedSecret } from "./secrets";

/** How long a pass is accepted after issue. The pass is fetched right before the Pay click. */
export const CHECKOUT_PASS_TTL_MS = 2 * 60_000;
/** Server clocks (Vercel, Convex) may disagree a little; a pass "from the future" within this is fine. */
const CLOCK_SKEW_MS = 30_000;
/** Hex characters of the IP hash kept as the rate-limit key: 128 bits. */
const GUEST_KEY_LENGTH = 32;

async function hmacHex(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The rate-limit key for a client IP: keyed, so the stored key does not reveal the IP. */
export async function guestKeyForIp(secret: string, ip: string): Promise<string> {
  return (await hmacHex(secret, `ip:${ip}`)).slice(0, GUEST_KEY_LENGTH);
}

export async function issueCheckoutPass(secret: string, ip: string, now: number): Promise<string> {
  const guestKey = await guestKeyForIp(secret, ip);
  const issuedAt = String(Math.floor(now));
  return `${guestKey}.${issuedAt}.${await hmacHex(secret, `pass:${guestKey}.${issuedAt}`)}`;
}

/**
 * The pass's guest key when it is well-formed, signed with `secret` and fresh; else null.
 * A missing secret or pass never verifies.
 */
export async function verifyCheckoutPass(
  pass: string | undefined,
  secret: string | undefined,
  now: number
): Promise<string | null> {
  if (!pass || !secret) return null;
  const parts = pass.split(".");
  if (parts.length !== 3) return null;
  const [guestKey, issuedAt, signature] = parts;
  if (!/^[0-9a-f]+$/.test(guestKey) || guestKey.length !== GUEST_KEY_LENGTH) return null;
  if (!/^\d{1,15}$/.test(issuedAt)) return null;
  const age = now - Number(issuedAt);
  if (age > CHECKOUT_PASS_TTL_MS || age < -CLOCK_SKEW_MS) return null;
  const expected = await hmacHex(secret, `pass:${guestKey}.${issuedAt}`);
  return isValidSharedSecret(signature, expected) ? guestKey : null;
}
