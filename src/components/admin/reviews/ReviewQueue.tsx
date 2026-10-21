"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useMutation, usePaginatedQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { AlertTriangle, MessageSquareText, RotateCw } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { QueryErrorBoundary } from "@/components/admin/QueryErrorBoundary";
import { EmptyState } from "@/components/admin/products/EmptyState";
import { StarRating } from "@/components/reviews/StarRating";
import { REJECT_REASON_MAX, TABS, rowActions, tabStatus } from "./reviewQueueModel";
import type { ReviewStatus } from "./reviewQueueModel";

const PAGE_SIZE = 20;

type Row = {
  _id: Id<"product_reviews">;
  productName: string;
  rating: number;
  title?: string;
  body?: string;
  displayName: string;
  boughtColorway?: string;
  boughtSize?: string;
  status: ReviewStatus;
  rejectReason?: string;
  hiddenAt?: number;
  createdAt: number;
  updatedAt: number;
};

type RejectTarget = { row: Row; kind: "reject" | "unpublish" };

function ReviewRow({
  row,
  busy,
  onPublish,
  onReject,
}: {
  row: Row;
  busy: boolean;
  onPublish: () => void;
  onReject: (kind: "reject" | "unpublish") => void;
}) {
  const t = useTranslations("admin.reviews");
  const format = useFormatter();
  const actions = rowActions(row);
  const bought = [row.boughtColorway, row.boughtSize].filter(Boolean).join(" / ");
  const date = (ms: number) => format.dateTime(ms, { dateStyle: "medium" });
  const btn = "px-3 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50";
  return (
    <li className="p-4 rounded-2xl bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-sm font-display font-bold text-zinc-950 dark:text-white">{row.productName}</span>
        <StarRating value={row.rating} label={t("stars", { rating: row.rating })} size={14} />
        {row.hiddenAt !== undefined && (
          <span className="px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-white/10 text-[10px] font-semibold text-zinc-700 dark:text-zinc-300">
            {t("deletedAccount")}
          </span>
        )}
      </div>
      {row.title && <p className="text-sm font-semibold text-zinc-900 dark:text-white">{row.title}</p>}
      {row.body && <p className="text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-line break-words">{row.body}</p>}
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        {t("by", { name: row.displayName })} · {t("created", { date: date(row.createdAt) })}
        {row.updatedAt !== row.createdAt && <> · {t("updated", { date: date(row.updatedAt) })}</>}
        {bought && <> · {t("bought", { item: bought })}</>}
      </p>
      {row.status === "rejected" && row.rejectReason && (
        <p className="text-xs text-rose-600 dark:text-rose-400 whitespace-pre-line break-words">{t("rejectReason", { reason: row.rejectReason })}</p>
      )}
      {actions.length > 0 && (
        <div className="flex gap-2 pt-1">
          {actions.includes("publish") && (
            <button type="button" disabled={busy} onClick={onPublish} className={`${btn} bg-moya-red hover:bg-moya-red-light text-white`}>
              {t("actions.publish")}
            </button>
          )}
          {actions.includes("reject") && (
            <button type="button" disabled={busy} onClick={() => onReject("reject")} className={`${btn} border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200`}>
              {t("actions.reject")}
            </button>
          )}
          {actions.includes("unpublish") && (
            <button type="button" disabled={busy} onClick={() => onReject("unpublish")} className={`${btn} border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200`}>
              {t("actions.unpublish")}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function ReviewList({ tab }: { tab: ReviewStatus }) {
  const t = useTranslations("admin.reviews");
  const tCommon = useTranslations("admin.common");
  const { results, status, loadMore } = usePaginatedQuery(
    api.reviews.admin.listReviewsAdmin,
    { status: tabStatus(tab) },
    { initialNumItems: PAGE_SIZE }
  );
  const publish = useMutation(api.reviews.admin.publishReview);
  const reject = useMutation(api.reviews.admin.rejectReview);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [target, setTarget] = useState<RejectTarget | null>(null);
  const [reason, setReason] = useState("");

  const run = async (action: () => Promise<unknown>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      await action();
      return true;
    } catch (err) {
      setError(err instanceof ConvexError ? String(err.data) : tCommon("actionFailed"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const closeDialog = () => {
    setTarget(null);
    setReason("");
    setError(null);
  };

  const rows = results as Row[];
  return (
    <div className="space-y-4">
      {error && !target && (
        <p role="alert" className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
        </p>
      )}
      {status === "LoadingFirstPage" ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((n) => <div key={n} className="h-28 rounded-2xl bg-zinc-100 dark:bg-white/[0.04] animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={<MessageSquareText className="w-8 h-8" />} title={t(`empty.${tab}`)} />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <ReviewRow
              key={row._id}
              row={row}
              busy={busy}
              onPublish={() => void run(() => publish({ reviewId: row._id }))}
              onReject={(kind) => {
                setError(null);
                setTarget({ row, kind });
              }}
            />
          ))}
        </ul>
      )}
      {status === "CanLoadMore" && (
        <button type="button" onClick={() => loadMore(PAGE_SIZE)} className="px-3.5 py-2 rounded-xl text-xs font-semibold border border-zinc-300 dark:border-white/15 text-zinc-800 dark:text-zinc-200">
          {t("loadMore")}
        </button>
      )}
      <ConfirmDialog
        open={target !== null}
        title={target?.kind === "unpublish" ? t("dialog.unpublishTitle") : t("dialog.rejectTitle")}
        body={target?.kind === "unpublish" ? t("dialog.unpublishBody") : t("dialog.rejectBody")}
        confirmLabel={target?.kind === "unpublish" ? t("actions.unpublish") : t("actions.reject")}
        destructive
        busy={busy}
        error={error}
        onClose={closeDialog}
        onConfirm={async () => {
          if (!target) return;
          const trimmed = reason.trim();
          const ok = await run(() => reject({ reviewId: target.row._id, ...(trimmed ? { reason: trimmed } : {}) }));
          if (ok) closeDialog();
        }}
      >
        <div className="space-y-1">
          <label htmlFor="review-reject-reason" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">{t("dialog.reasonLabel")}</label>
          <textarea
            id="review-reject-reason"
            value={reason}
            maxLength={REJECT_REASON_MAX}
            rows={3}
            onChange={(e) => setReason(e.target.value)}
            className="w-full p-2.5 text-xs rounded-xl bg-white dark:bg-[#07070b] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white"
          />
          <p className="text-[11px] text-right text-zinc-500 dark:text-zinc-400">{t("dialog.counter", { count: reason.length, max: REJECT_REASON_MAX })}</p>
        </div>
      </ConfirmDialog>
    </div>
  );
}

/** Admin Reviews (ADR 0028): the moderation queue, one tab per status. */
export function ReviewQueue() {
  const t = useTranslations("admin");
  const [tab, setTab] = useState<ReviewStatus>("pending");
  return (
    <div className="space-y-5 pb-24 sm:pb-12">
      <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-950 dark:text-white tracking-tight">{t("reviews.title")}</h1>
      <div role="tablist" className="flex gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-white/[0.04] w-fit">
        {TABS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              tab === s ? "bg-white dark:bg-white/10 text-zinc-950 dark:text-white shadow-xs" : "text-zinc-600 dark:text-zinc-400"
            }`}
          >
            {t(`reviews.tabs.${s}`)}
          </button>
        ))}
      </div>
      <QueryErrorBoundary
        fallback={(retry) => (
          <EmptyState title={t("common.queryFailed")}>
            <button type="button" onClick={retry} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold">
              <RotateCw className="w-3.5 h-3.5" /> {t("common.retry")}
            </button>
          </EmptyState>
        )}
      >
        <ReviewList key={tab} tab={tab} />
      </QueryErrorBoundary>
    </div>
  );
}
