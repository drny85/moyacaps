import { useTranslations } from "next-intl";
import { StarRating } from "./StarRating";
import { boughtNote, type ColorwayNames } from "./reviewView";

export type PublicReview = {
  _id: string;
  rating: number;
  title?: string;
  body?: string;
  locale: "en" | "es";
  displayName: string;
  boughtColorway?: string;
  boughtSize?: string;
  publishedAt: number;
};

/**
 * Presentational list of Published reviews. Review text is user input: it is only ever
 * rendered as React text children (escaped), with line breaks kept by CSS.
 */
export function ReviewList({
  reviews,
  colorways,
  locale,
}: {
  reviews: readonly PublicReview[];
  colorways?: readonly ColorwayNames[];
  locale: string;
}) {
  const t = useTranslations("Reviews");
  return (
    <ul className="divide-y divide-black/[0.08] dark:divide-white/[0.08]">
      {reviews.map((r) => {
        const note = boughtNote(r, colorways, locale);
        return (
          <li key={r._id} className="py-5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <StarRating value={r.rating} label={t("starsOf", { rating: r.rating })} />
              {r.title && <h3 className="font-display text-[15px] font-semibold text-zinc-900 dark:text-white">{r.title}</h3>}
            </div>
            {r.body && (
              <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{r.body}</p>
            )}
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              {r.displayName}
              {" · "}
              <time dateTime={new Date(r.publishedAt).toISOString()}>
                {new Date(r.publishedAt).toLocaleDateString(locale === "es" ? "es-MX" : "en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
              </time>
              {note && ` · ${t("bought", { detail: note })}`}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
