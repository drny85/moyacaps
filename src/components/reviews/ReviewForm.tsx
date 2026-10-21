"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { X } from "lucide-react";
import { api } from "@convex/_generated/api";
import { REVIEW_BODY_MAX, REVIEW_TITLE_MAX } from "../../../convex/reviews/model";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { StarInput, StarRating } from "./StarRating";
import { reviewErrorKey, type ReviewFormMode } from "./reviewView";

export type MyReview = {
  status: "pending" | "published" | "rejected";
  rejectReason?: string;
  rating: number;
  title?: string;
  body?: string;
};

const FIELD =
  "w-full rounded-xl border border-black/[0.12] bg-white px-3.5 py-2.5 text-sm text-zinc-900 outline-none focus-visible:ring-2 focus-visible:ring-moya-red dark:border-white/[0.14] dark:bg-zinc-900 dark:text-white";

/**
 * Modal to write, edit or delete the signed-in Customer's review of one Product. In "readOnly"
 * mode (a review exists but the Customer is no longer eligible) it shows the review and offers
 * only Delete, since the server would refuse an edit.
 */
export function ReviewForm({
  variantId,
  productName,
  existing,
  mode,
  onClose,
}: {
  variantId: string;
  productName: string;
  existing: MyReview | null;
  mode: ReviewFormMode;
  onClose: () => void;
}) {
  const t = useTranslations("Reviews");
  const locale = useLocale() === "es" ? "es" : "en";
  const submit = useMutation(api.reviews.customer.submitReview);
  const remove = useMutation(api.reviews.customer.deleteMyReview);
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [body, setBody] = useState(existing?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(panelRef, true, closeRef);
  useLockBodyScroll(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      onClose();
    } catch (err) {
      const message = reviewErrorKey(err);
      setError("text" in message ? message.text : t(message.key));
      setBusy(false);
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1) return setError(t("ratingRequired"));
    void run(() => submit({ variantId, rating, title: title.trim() || undefined, body: body.trim() || undefined, locale }));
  };

  const onDelete = () => {
    if (window.confirm(t("deleteConfirm"))) void run(() => remove({ variantId }));
  };

  const errorLine = error && (
    <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
      {error}
    </p>
  );
  const deleteButton = existing && (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      className="text-sm font-medium text-rose-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red disabled:opacity-60 dark:text-rose-400"
    >
      {t("delete")}
    </button>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-black/[0.08] bg-white p-6 shadow-2xl dark:border-white/[0.08] dark:bg-[#0c0c14] sm:rounded-3xl"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-4 top-4 rounded-xl p-2 text-zinc-400 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red dark:hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
        <h2 id={`${id}-title`} className="font-display text-lg font-bold text-zinc-900 dark:text-white">
          {t("formTitle")}
        </h2>
        <p className="mb-4 text-sm text-zinc-500">{productName}</p>

        {existing && (
          <p
            role="status"
            className={`mb-4 rounded-xl px-3.5 py-2.5 text-sm ${
              existing.status === "rejected"
                ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                : existing.status === "pending"
                  ? "bg-amber-500/10 text-amber-800 dark:text-amber-300"
                  : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {existing.status === "pending"
              ? t("statusPending")
              : existing.status === "rejected"
                ? existing.rejectReason
                  ? t("statusRejectedReason", { reason: existing.rejectReason })
                  : t("statusRejected")
                : mode === "readOnly"
                  ? t("statusPublished")
                  : `${t("statusPublished")}. ${t("reviewedNote")}`}
          </p>
        )}

        {mode === "readOnly" && existing ? (
          <div className="flex flex-col gap-4">
            <StarRating value={existing.rating} label={t("starsOf", { rating: existing.rating })} />
            {existing.title && <p className="font-display text-sm font-bold text-zinc-900 dark:text-white">{existing.title}</p>}
            {existing.body && <p className="whitespace-pre-line text-sm text-zinc-700 dark:text-zinc-300">{existing.body}</p>}
            <p className="text-sm text-zinc-500">{t("readOnlyNote")}</p>
            {errorLine}
            <div>{deleteButton}</div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <StarInput
              name={`${id}-rating`}
              value={rating}
              onChange={setRating}
              legend={t("ratingLabel")}
              optionLabel={(n) => t("starCount", { count: n })}
            />
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-900 dark:text-white">
              {t("titleLabel")}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={REVIEW_TITLE_MAX}
                className={FIELD}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium text-zinc-900 dark:text-white">
              {t("bodyLabel")}
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={REVIEW_BODY_MAX}
                rows={5}
                className={FIELD}
              />
              <span className="text-xs font-normal text-zinc-500">{t("charsLeft", { count: REVIEW_BODY_MAX - body.length })}</span>
            </label>

            {errorLine}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-zinc-900 px-5 py-2.5 font-display text-sm font-bold text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-moya-red disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
              >
                {busy ? t("saving") : existing ? t("update") : t("submit")}
              </button>
              {deleteButton}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
