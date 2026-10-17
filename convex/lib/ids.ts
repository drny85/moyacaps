/**
 * Shared identifier helpers for order/tracking number generation.
 * Pure module: safe to import from both Convex functions and "use node" actions.
 */

/**
 * Cryptographically-random digit string for order/tracking identifiers.
 * Falls back to Math.random only if webcrypto is unavailable.
 */
export function randomDigitString(length: number): string {
  let out = "";
  const cryptoObj = (globalThis as any).crypto;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(length);
    cryptoObj.getRandomValues(bytes);
    for (let i = 0; i < length; i++) out += (bytes[i] % 10).toString();
  } else {
    for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}
