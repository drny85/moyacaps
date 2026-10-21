"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePaginatedQuery, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useSafeConvexAuth } from "@/lib/useSafeUser";
import { ReviewForm } from "./ReviewForm";
import { ReviewList } from "./ReviewList";
import { StarRating } from "./StarRating";
import { showWriteReview, type ColorwayNames } from "./reviewView";

const PAGE_SIZE = 10;

/**
 * Reviews section of the product page. Client-side only and below the fold, so the static
 * page's first paint is unaffected. The customer queries are skipped until Convex auth is
 * ready, and a signed-out visitor never triggers Clerk from here (ADR 0018).
 */
export function ProductReviews({
  variantId,
  productName,
  colorways,
}: {
  variantId: string;
  productName: string;
  colorways?: readonly ColorwayNames[];
}) {
  const t = useTranslations("Reviews");
  const locale = useLocale();
  const { isAuthenticated } = useSafeConvexAuth();
  const summary = useQuery(api.reviews.public.getRatingSummary, { variantId });
  const { results, status, loadMore } = usePaginatedQuery(
    api.reviews.public.getProductReviews,
    { variantId },
    { initialNumItems: PAGE_SIZE }
  );
  const mine = useQuery(api.reviews.customer.getMyReviewState, isAuthenticated ? { variantId } : "skip");
  const [formOpen, setFormOpen] = useState(false);

  const canWrite = showWriteReview(mine);
  const canEdit = !!mine?.review;
  const empty = status !== "LoadingFirstPage" && results.length === 0;
  // Nothing to show and nothing to do: keep the page free of an empty section
  if (empty && !canWrite && !canEdit) return null;

  return (
    <section className="mt-16 lg:mt-24" aria-labelledby="reviews-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="reviews-heading" className="font-poster text-4xl uppercase leading-none text-zinc-900 dark:text-white sm:text-5xl">
            {t("heading")}
          </h2>
          {summary && (
            <p className="mt-3 flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <StarRating value={summary.average} label={t("starsOf", { rating: summary.average })} />
              <span>{t("summary", { average: summary.average, count: summary.count })}</span>
            </p>
          )}
        </div>
        {(canWrite || canEdit) && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="rounded-xl bg-zinc-900 px-5 py-2.5 font-display text-sm font-bold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            {canEdit ? t("editReview") : t("writeReview")}
          </button>
        )}
      </div>

      {empty ? (
        <p className="mt-6 text-sm text-zinc-500">{t("noReviews")}</p>
      ) : (
        <div className="mt-4">
          <ReviewList reviews={results} colorways={colorways} locale={locale} />
          {status === "CanLoadMore" && (
            <button
              type="button"
              onClick={() => loadMore(PAGE_SIZE)}
              className="mt-4 rounded-xl border border-black/[0.12] px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red dark:border-white/[0.14] dark:text-white dark:hover:bg-white/10"
            >
              {t("loadMore")}
            </button>
          )}
        </div>
      )}

      {formOpen && (
        <ReviewForm variantId={variantId} productName={productName} existing={mine?.review ?? null} onClose={() => setFormOpen(false)} />
      )}
    </section>
  );
}
