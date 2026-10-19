/**
 * Shared-secret check for `/api/revalidate` (ADR 0022). Compares in constant time over the
 * longer length so a mismatch's position and length do not leak through timing.
 */
export function isValidRevalidateSecret(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const length = Math.max(provided.length, expected.length);
  let diff = provided.length ^ expected.length;
  for (let i = 0; i < length; i++) {
    diff |= (provided.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  }
  return diff === 0;
}
