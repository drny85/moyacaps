import { readImageHeader } from "../../../convex/catalog/images/header";
import { checkImageUpload, type ImageRole, type ImageRuleError } from "../../../convex/catalog/images/rules";

const HEADER_BYTES = 64 * 1024;

/** Client-side mirror of the server upload check; the server stays authoritative. */
export async function preflightImage(file: File, role: ImageRole): Promise<ImageRuleError | null> {
  const head = new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer());
  return checkImageUpload({ role, bytes: file.size, header: readImageHeader(head) });
}

const SERVER_CODES = [
  "unsupported_format", "too_large", "too_small", "needs_transparency",
  "invalid_slot", "too_many", "not_found", "invalid_order",
] as const;
export type ImageErrorCode = (typeof SERVER_CODES)[number] | "archived" | "unknown";

/** Maps a thrown Convex error payload (`ConvexError.data`) to a message key. */
export function imageErrorCode(data: unknown): ImageErrorCode {
  if (data && typeof data === "object") {
    const { kind, code } = data as { kind?: unknown; code?: unknown };
    if (kind === "archived") return "archived";
    if (kind === "image_rule" && (SERVER_CODES as readonly unknown[]).includes(code)) return code as ImageErrorCode;
  }
  return "unknown";
}
