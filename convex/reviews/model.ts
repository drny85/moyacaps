/**
 * Product Review rules (ADR 0028, plan 0011): input validation, which Order lines let a
 * Customer review a variant, the public reviewer name, and the rating-stats arithmetic.
 * Review text is only ever trimmed, never sanitized; rendering escapes it. Pure; no ctx.
 */
import { ConvexError } from "convex/values";
import type { Doc } from "../_generated/dataModel";

export type ReviewStatus = "pending" | "published" | "rejected";

/** A product card shows its star rating only once this many reviews back it. */
export const CARD_RATING_MIN_COUNT = 3;
export const REVIEW_TITLE_MAX = 80;
export const REVIEW_BODY_MAX = 2000;
export const REJECT_REASON_MAX = 300;
/** How long after delivery a Customer is invited to review. */
export const REVIEW_INVITE_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

function trimmedOrUndefined(value: string | undefined, max: number, label: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > max) throw new ConvexError(`${label} must be at most ${max} characters.`);
  return trimmed;
}

/** Validates the rating (integer 1-5) and trims title and body; blank text becomes undefined. */
export function normalizeReviewInput(input: { rating: number; title?: string; body?: string }): {
  rating: number;
  title?: string;
  body?: string;
} {
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
    throw new ConvexError("Rating must be a whole number from 1 to 5.");
  }
  return {
    rating: input.rating,
    title: trimmedOrUndefined(input.title, REVIEW_TITLE_MAX, "Title"),
    body: trimmedOrUndefined(input.body, REVIEW_BODY_MAX, "Review"),
  };
}

/**
 * The Order lines of `variantId` a Customer may review: delivered, not cancelled, and not
 * fully refunded. Failed refunds never happened; pending ones are reserved, so they count.
 */
export function reviewableLines(
  order: Pick<Doc<"orders">, "items" | "fulfillmentStatus" | "cancelledAt">,
  refunds: Pick<Doc<"order_refunds">, "status" | "lines">[],
  variantId: string
): { lineIndex: number; colorway?: string; size?: string }[] {
  if (order.fulfillmentStatus !== "delivered" || order.cancelledAt) return [];

  const refunded = new Map<number, number>();
  for (const refund of refunds) {
    if (refund.status === "failed") continue;
    for (const line of refund.lines) {
      refunded.set(line.lineIndex, (refunded.get(line.lineIndex) ?? 0) + line.quantity);
    }
  }

  const lines: { lineIndex: number; colorway?: string; size?: string }[] = [];
  order.items.forEach((item, lineIndex) => {
    if (item.variantId !== variantId) return;
    if ((refunded.get(lineIndex) ?? 0) >= item.quantity) return;
    lines.push({ lineIndex, colorway: item.colorway, size: item.size });
  });
  return lines;
}

/** "Robert Melendez" -> "Robert M."; a single name stays; nothing -> "Verified Buyer". */
export function reviewerDisplayName(name: string | undefined): string {
  const parts = name?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (parts.length === 0) return "Verified Buyer";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${Array.from(parts[parts.length - 1])[0].toUpperCase()}.`;
}

type CountedShape = { status: ReviewStatus; rating: number; hidden: boolean };
const counted = (r: CountedShape | null) => (r && r.status === "published" && !r.hidden ? r : null);

/** What one review change adds to its product's stats; only published, unhidden reviews count. */
export function statsDelta(prev: CountedShape | null, next: CountedShape | null): { count: number; ratingSum: number } {
  const before = counted(prev);
  const after = counted(next);
  return {
    count: (after ? 1 : 0) - (before ? 1 : 0),
    ratingSum: (after?.rating ?? 0) - (before?.rating ?? 0),
  };
}

/** Average rating to one decimal; count must be above zero. */
export function roundedAverage(stats: { count: number; ratingSum: number }): number {
  return Math.round((stats.ratingSum / stats.count) * 10) / 10;
}

/** Average and count for a product card, or null while there are too few reviews to show. */
export function cardRating(stats: { count: number; ratingSum: number }): { average: number; count: number } | null {
  if (stats.count < CARD_RATING_MIN_COUNT) return null;
  return { average: roundedAverage(stats), count: stats.count };
}
