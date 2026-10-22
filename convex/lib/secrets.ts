/**
 * Shared-secret check for webhooks and internal endpoints (`/api/revalidate`, `/shippo-webhook`).
 * Compares in constant time over the longer length so a mismatch's position and length do not
 * leak through timing. A missing secret on either side never matches.
 */
export function isValidSharedSecret(provided: string | null | undefined, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const length = Math.max(provided.length, expected.length);
  let diff = provided.length ^ expected.length;
  for (let i = 0; i < length; i++) {
    diff |= (provided.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return diff === 0;
}
