/**
 * The admin refund dialog's form, turned into the request the server plans (convex/payments/
 * refundModel.ts). The dialog previews the same planners the server runs, so the amount shown
 * is the amount sent. Pure; covered by refundForm.test.ts.
 */
import type { LineRequest, RefundKind, RefundStatus, ReturnReason } from "@convex/payments/refundModel";

export type RefundMode = "line" | "return" | "goodwill";

/** One order line in the form: how many units to refund (0 = none) and whether to Restock them. */
export type LineDraft = { quantity: number; restock: boolean };

export type RefundDraft = {
  lines: LineDraft[];
  includeShipping: boolean;
  returnReason: ReturnReason;
  unwornWithTags: boolean;
  goodwillDollars: string;
  note: string;
};

export function emptyDraft(lineCount: number): RefundDraft {
  return {
    lines: Array.from({ length: lineCount }, () => ({ quantity: 0, restock: false })),
    includeShipping: false,
    returnReason: "unwanted",
    unwornWithTags: false,
    goodwillDollars: "",
    note: "",
  };
}

/** The lines the Administrator picked, in order. */
export function lineRequests(draft: RefundDraft): LineRequest[] {
  return draft.lines.flatMap((line, lineIndex) =>
    line.quantity > 0 ? [{ lineIndex, quantity: line.quantity, restock: line.restock }] : []
  );
}

/** "12.5" → 1250 cents; anything that is not a positive amount → 0 (the planner refuses it). */
export function dollarsToCents(input: string): number {
  const amount = Number(input.trim());
  return Number.isFinite(amount) && amount > 0 ? Math.round(amount * 100) : 0;
}

export type AdminRefundRequest =
  | { kind: "line"; lines: LineRequest[]; includeShipping: boolean }
  | { kind: "return"; lines: LineRequest[]; reason: ReturnReason; unwornWithTags: boolean }
  | { kind: "goodwill"; amountCents: number; reason: string };

export function buildRefundRequest(mode: RefundMode, draft: RefundDraft): AdminRefundRequest {
  switch (mode) {
    case "line":
      return { kind: "line", lines: lineRequests(draft), includeShipping: draft.includeShipping };
    case "return":
      return { kind: "return", lines: lineRequests(draft), reason: draft.returnReason, unwornWithTags: draft.unwornWithTags };
    case "goodwill":
      return { kind: "goodwill", amountCents: dollarsToCents(draft.goodwillDollars), reason: draft.note };
  }
}

/** Units the Administrator asked to put back in stock: the High-Friction Confirmation lists them. */
export function restockSummary(draft: RefundDraft, itemNames: string[]): string[] {
  return lineRequests(draft)
    .filter((line) => line.restock)
    .map((line) => `${line.quantity}× ${itemNames[line.lineIndex] ?? `line ${line.lineIndex + 1}`}`);
}

export const REFUND_KIND_LABELS: Record<RefundKind, string> = {
  line: "Line refund",
  return: "Return",
  goodwill: "Goodwill Refund",
  cancellation: "Cancellation refund",
};

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  pending: "Pending",
  issued: "Issued",
  failed: "Failed",
};

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  unwanted: "Changed mind (Customer pays return shipping)",
  defective: "Defective (we pay return shipping, never restocked)",
  wrong_item: "Wrong item sent (we pay return shipping)",
};
