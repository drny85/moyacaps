import { CARD_RATING_MIN_COUNT } from "../../../convex/reviews/model";

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

/** The "Write a review" button: only a signed-in Customer with a delivered line, and no review yet. */
export function showWriteReview(state: { canReview: boolean; review: unknown } | undefined | null): boolean {
  return !!state && state.canReview && !state.review;
}

/** Which product the `?review=` deep link opens: the first not yet reviewed, or none. */
export function deepLinkTarget(products: readonly { variantId: string; reviewed: boolean }[]): string | null {
  return products.find((p) => !p.reviewed)?.variantId ?? null;
}
