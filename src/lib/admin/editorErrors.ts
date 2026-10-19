import { ConvexError } from "convex/values";
import type { FieldError } from "../../../convex/catalog/rules";
import { imageErrorCode } from "./imageUpload";
import type { ImageErrorCode } from "./imageUpload";

/**
 * Maps product editor failures (client validation and `ConvexError.data` from
 * `createVariant`/`updateVariant`) to what the editor shows: errors under their
 * inputs, errors without an input at form level, and at most one banner.
 */

export type SkuCellStock = { colorway: string; size: string; stock: number };

export type EditorBanner =
  | { kind: "stale" }
  | { kind: "sku_in_stock"; cells: SkuCellStock[] }
  | { kind: "needs_image" }
  | { kind: "archived" }
  | { kind: "image_rule"; code: ImageErrorCode }
  | { kind: "message"; text: string }
  | { kind: "unknown" };

export type EditorFeedback = {
  fieldErrors: FieldError[];
  formErrors: FieldError[];
  banner: EditorBanner | null;
};

export const NO_FEEDBACK: EditorFeedback = { fieldErrors: [], formErrors: [], banner: null };

const EDITOR_FIELDS = new Set([
  "variantId",
  "nameEn",
  "nameEs",
  "category",
  "silhouette",
  "primaryHex",
  "secondaryHex",
  "priceUsd",
  "stock",
  "taxCode",
  "descriptionEn",
  "descriptionEs",
  "badgeTextEn",
  "badgeTextEs",
  "fabricEn",
  "fabricEs",
  "fitEn",
  "fitEs",
  "sizes",
  "defaultColorway",
  "colorways",
]);

const COLORWAY_FIELD_RE = /^colorways\[\d+\]\.(?:id|nameEn|nameEs|hex|borderHex)$/;

/** The input an error belongs to: per-size errors show under the size chips. */
export function editorFieldKey(field: string): string {
  return /^sizes\[\d+\]$/.test(field) ? "sizes" : field;
}

export function isEditorField(field: string): boolean {
  return EDITOR_FIELDS.has(field) || COLORWAY_FIELD_RE.test(field);
}

export function splitFieldErrors(errors: FieldError[]): EditorFeedback {
  const fieldErrors: FieldError[] = [];
  const formErrors: FieldError[] = [];
  for (const error of errors) {
    const field = editorFieldKey(error.field);
    if (isEditorField(field)) fieldErrors.push({ ...error, field });
    else formErrors.push(error);
  }
  return { fieldErrors, formErrors, banner: null };
}

function isSkuCell(value: unknown): value is SkuCellStock {
  if (!value || typeof value !== "object") return false;
  const { colorway, size, stock } = value as Record<string, unknown>;
  return typeof colorway === "string" && typeof size === "string" && typeof stock === "number";
}

function isFieldError(value: unknown): value is FieldError {
  if (!value || typeof value !== "object") return false;
  const { field, code } = value as Record<string, unknown>;
  return typeof field === "string" && typeof code === "string";
}

const banner = (b: EditorBanner): EditorFeedback => ({ ...NO_FEEDBACK, banner: b });

/** Feedback for a thrown save error; pass `ConvexError.data`, or `undefined` for any other error. */
export function editorFeedback(data: unknown): EditorFeedback {
  if (typeof data === "string") return banner({ kind: "message", text: data });
  if (!data || typeof data !== "object") return banner({ kind: "unknown" });
  const payload = data as Record<string, unknown>;
  switch (payload.kind) {
    case "validation":
      return splitFieldErrors(Array.isArray(payload.errors) ? payload.errors.filter(isFieldError) : []);
    case "stale":
      return banner({ kind: "stale" });
    case "sku_in_stock":
      return banner({ kind: "sku_in_stock", cells: Array.isArray(payload.cells) ? payload.cells.filter(isSkuCell) : [] });
    case "needs_image":
      return banner({ kind: "needs_image" });
    case "archived":
      return banner({ kind: "archived" });
    case "image_rule":
      return banner({ kind: "image_rule", code: imageErrorCode(data) });
    default:
      return banner({ kind: "unknown" });
  }
}

export function fieldErrorFor(feedback: EditorFeedback, field: string): FieldError | undefined {
  return feedback.fieldErrors.find((e) => e.field === field);
}

/** "black / M (3), sand / XL (1)": the cells that still hold stock. */
export function formatSkuCells(cells: SkuCellStock[], nameOf: (colorwayId: string) => string = (id) => id): string {
  return cells.map((c) => `${nameOf(c.colorway)} / ${c.size} (${c.stock})`).join(", ");
}

/** What a dialog with no inputs to mark shows: a message key under `admin.products`, or the server's own text. */
export type ErrorLine = { key: string; values?: Record<string, string> } | { text: string };

/** One line for any thrown save error (dialogs never render `ConvexError.data` itself). */
export function errorLine(err: unknown): ErrorLine {
  const feedback = editorFeedback(err instanceof ConvexError ? (err.data as unknown) : undefined);
  const firstError = feedback.fieldErrors[0] ?? feedback.formErrors[0];
  if (firstError) return { key: `errors.${firstError.code}` };
  const b = feedback.banner;
  switch (b?.kind) {
    case "message":
      return { text: b.text };
    case "stale":
    case "archived":
    case "needs_image":
      return { key: `errors.${b.kind}` };
    case "sku_in_stock":
      return { key: "errors.sku_in_stock", values: { cells: formatSkuCells(b.cells) } };
    case "image_rule":
      return { key: `images.errors.${b.code}` };
    default:
      return { key: "errors.unknown" };
  }
}
