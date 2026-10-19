import type { readImageHeader } from "./header";

export type ImageRole = "catalog" | "lifestyle" | "angle";
export type CapAngle = "front" | "left" | "back" | "right";
export type ImageRuleError = "unsupported_format" | "too_large" | "too_small" | "needs_transparency";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MIN_SHORT_SIDE = 800;

/** `bytes` is the full file size, not the length of the header slice. */
export function checkImageUpload(input: {
  role: ImageRole;
  bytes: number;
  header: ReturnType<typeof readImageHeader>;
}): ImageRuleError | null {
  const { role, bytes, header } = input;
  if (!header) return "unsupported_format";
  if (bytes > MAX_IMAGE_BYTES) return "too_large";
  if (role === "angle") return header.hasAlpha ? null : "needs_transparency";
  if (Math.min(header.width, header.height) < MIN_SHORT_SIDE) return "too_small";
  return null;
}
