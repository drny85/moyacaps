import { ConvexError } from "convex/values";
import { CARD_RATING_MIN_COUNT, REVIEW_ERRORS } from "../../../convex/reviews/model";

export type ColorwayNames = { id: string; nameEn: string; nameEs: string };
export type RatingSummary = { average: number; count: number };

/** "Black / L" for a tee review (colorway name in the viewer's language, raw id as fallback); null for caps. */
export function boughtNote(
  review: { boughtColorway?: string; boughtSize?: string },
  colorways: readonly ColorwayNames[] | undefined,
  locale: string
): string | null {
  const parts: string[] = [];
  if (review.boughtColorway) {
    const match = colorways?.find((c) => c.id === review.boughtColorway);
    parts.push(match ? (locale === "es" ? match.nameEs : match.nameEn) : review.boughtColorway);
  }
  if (review.boughtSize) parts.push(review.boughtSize);
  return parts.length > 0 ? parts.join(" / ") : null;
}

/** Product cards show stars only once enough reviews back the average. */
export function shouldShowCardRating(rating: RatingSummary | undefined | null): rating is RatingSummary {
  return !!rating && rating.count >= CARD_RATING_MIN_COUNT;
}

/** Which product the `?review=` deep link opens: the first not yet reviewed, or none. */
export function deepLinkTarget(products: readonly { variantId: string; reviewed: boolean }[]): string | null {
  return products.find((p) => !p.reviewed)?.variantId ?? null;
}

export type ReviewFormMode = "create" | "edit" | "readOnly";

/**
 * How the review form opens. Editing re-checks eligibility on the server (ADR 0028), so a
 * Customer whose delivered line is gone (refunded, cancelled) can only view and delete.
 */
export function reviewFormMode({ canReview, hasReview }: { canReview: boolean; hasReview: boolean }): ReviewFormMode | null {
  if (hasReview) return canReview ? "edit" : "readOnly";
  return canReview ? "create" : null;
}

/** Reviews message keys for the known server errors. */
const ERROR_KEYS: Record<string, "errorSignIn" | "errorAccount" | "errorNotEligible"> = {
  [REVIEW_ERRORS.signIn]: "errorSignIn",
  [REVIEW_ERRORS.signInToManage]: "errorSignIn",
  [REVIEW_ERRORS.accountDeleted]: "errorAccount",
  [REVIEW_ERRORS.notEligible]: "errorNotEligible",
};

/**
 * What to show for a failed save or delete: a localized message for a known server error, the
 * server's own text for any other ConvexError string, else the generic "error" message.
 */
export function reviewErrorKey(err: unknown): { key: "error" | "errorSignIn" | "errorAccount" | "errorNotEligible" } | { text: string } {
  if (err instanceof ConvexError && typeof err.data === "string") {
    const key = ERROR_KEYS[err.data];
    return key ? { key } : { text: err.data };
  }
  return { key: "error" };
}
