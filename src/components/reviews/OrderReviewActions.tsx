"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useSafeConvexAuth } from "@/lib/useSafeUser";
import { ReviewForm } from "./ReviewForm";
import { deepLinkTarget, reviewFormMode } from "./reviewView";

type OrderLine = { variantId?: string; name: string };

/**
 * "Write a review" / "Edit review" per product of a delivered Order on the account page.
 * `?review=<orderNumber>` (the link in the review-invite email) scrolls here and opens the
 * form for the first product. Wrap in Suspense: it reads the search params.
 */
export function OrderReviewActions({
  orderId,
  orderNumber,
  items,
}: {
  orderId: Id<"orders">;
  orderNumber: string | number;
  items: readonly OrderLine[];
}) {
  const t = useTranslations("Reviews");
  const { isAuthenticated } = useSafeConvexAuth();
  const reviewable = useQuery(api.reviews.customer.getMyReviewableItems, isAuthenticated ? { orderId } : "skip");
  const targeted = useSearchParams().get("review") === String(orderNumber);
  const [openVariant, setOpenVariant] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const deepLinked = useRef(false);

  // One entry per product, even when the Order bought it on several lines
  const products = new Map<string, { reviewed: boolean; name: string }>();
  for (const r of reviewable ?? []) {
    if (products.has(r.variantId)) continue;
    products.set(r.variantId, { reviewed: r.reviewed, name: items.find((i) => i.variantId === r.variantId)?.name ?? r.variantId });
  }
  const target = deepLinkTarget([...products].map(([variantId, p]) => ({ variantId, reviewed: p.reviewed })));

  useEffect(() => {
    if (!targeted || deepLinked.current || reviewable === undefined) return;
    deepLinked.current = true;
    rootRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    if (target) setOpenVariant(target);
  }, [targeted, reviewable, target]);

  if (products.size === 0) return null;
  const open = openVariant ? products.get(openVariant) : undefined;

  return (
    <div ref={rootRef} className="flex flex-wrap gap-2">
      {[...products].map(([variantId, p]) => (
        <button
          key={variantId}
          type="button"
          onClick={() => setOpenVariant(variantId)}
          className="rounded-xl border border-black/[0.08] bg-black/[0.03] px-3.5 py-1.5 text-left text-xs font-display font-bold text-zinc-800 transition-colors hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-zinc-200 dark:hover:bg-white/10"
        >
          {p.reviewed ? t("editReview") : t("writeReview")}: {p.name}
        </button>
      ))}
      {openVariant && open && (
        <OpenForm variantId={openVariant} productName={open.name} onClose={() => setOpenVariant(null)} />
      )}
    </div>
  );
}

function OpenForm({ variantId, productName, onClose }: { variantId: string; productName: string; onClose: () => void }) {
  const state = useQuery(api.reviews.customer.getMyReviewState, { variantId });
  if (state === undefined) return null;
  // This page lists only reviewable lines, so this is normally create or edit; the same rule
  // as the product page still applies if eligibility changed since the list loaded.
  const mode = reviewFormMode({ canReview: state.canReview, hasReview: state.review !== null });
  if (!mode) return null;
  return <ReviewForm variantId={variantId} productName={productName} existing={state.review} mode={mode} onClose={onClose} />;
}
