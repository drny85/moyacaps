import { readImageHeader } from "../../../convex/catalog/images/header";
import {
  MAX_IMAGE_BYTES,
  MIN_SHORT_SIDE,
  checkImageUpload,
  type ImageRole,
  type ImageRuleError,
} from "../../../convex/catalog/images/rules";

const HEADER_BYTES = 64 * 1024;

type UploadInput = { role: ImageRole; bytes: number; header: ReturnType<typeof readImageHeader> };

/** Client-side mirror of the server upload check; the server stays authoritative. */
export async function preflightImage(file: File, role: ImageRole): Promise<ImageRuleError | null> {
  return (await preflightReport(file, role)).error;
}

/** One row of the Crop Guide checklist (D8). */
export type PreflightCheck = { id: "type" | "size" | "shortSide" | "alpha"; pass: boolean };

/**
 * Pass/fail rows for the upload rules: type and size always; transparency for an Angle
 * Shot, the short side for every other role (the same split as `checkImageUpload`).
 */
export function preflightSummary({ role, bytes, header }: UploadInput): PreflightCheck[] {
  const checks: PreflightCheck[] = [
    { id: "type", pass: header !== null },
    { id: "size", pass: bytes <= MAX_IMAGE_BYTES },
  ];
  if (role === "angle") checks.push({ id: "alpha", pass: header?.hasAlpha === true });
  else checks.push({ id: "shortSide", pass: header !== null && Math.min(header.width, header.height) >= MIN_SHORT_SIDE });
  return checks;
}

export type PreflightReport = { checks: PreflightCheck[]; error: ImageRuleError | null; width?: number; height?: number };

/** Read the file's header once and report every rule plus the first failure. */
export async function preflightReport(file: File, role: ImageRole): Promise<PreflightReport> {
  const header = readImageHeader(new Uint8Array(await file.slice(0, HEADER_BYTES).arrayBuffer()));
  const input = { role, bytes: file.size, header };
  return { checks: preflightSummary(input), error: checkImageUpload(input), width: header?.width, height: header?.height };
}

const SERVER_CODES = [
  "unsupported_format", "too_large", "too_small", "needs_transparency",
  "invalid_slot", "too_many", "not_found", "invalid_order",
] as const;
export type ImageErrorCode = (typeof SERVER_CODES)[number] | "archived" | "needs_image" | "unknown";

/** Maps a thrown Convex error payload (`ConvexError.data`) to a message key. */
export function imageErrorCode(data: unknown): ImageErrorCode {
  if (data && typeof data === "object") {
    const { kind, code } = data as { kind?: unknown; code?: unknown };
    if (kind === "archived") return "archived";
    if (kind === "needs_image") return "needs_image";
    if (kind === "image_rule" && (SERVER_CODES as readonly unknown[]).includes(code)) return code as ImageErrorCode;
  }
  return "unknown";
}
