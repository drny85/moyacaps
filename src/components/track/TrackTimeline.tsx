"use client";

/** The Customer's Order Timeline (CONTEXT.md): package milestones, newest first. */
import { useLocale, useTranslations } from "next-intl";
import { History } from "lucide-react";
import type { CustomerTimelineEntry } from "@convex/orders/timeline";

/** The message key for an entry: a Handoff reads differently picked up or dropped off. */
const messageKey = (entry: CustomerTimelineEntry) =>
  entry.kind === "handed_off" ? `handed_off_${entry.method ?? "dropped_off"}` : entry.kind;

export function TrackTimeline({ entries }: { entries: CustomerTimelineEntry[] }) {
  const t = useTranslations("track.timeline");
  const locale = useLocale();
  if (entries.length === 0) return null;
  return (
    <div className="p-4 rounded-2xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
        <History className="w-3.5 h-3.5" /> {t("title")}
      </h3>
      <ol className="space-y-2.5 border-l border-black/[0.08] dark:border-white/10 ml-1.5">
        {entries.map((entry, i) => (
          <li key={`${entry.kind}-${entry.at}-${i}`} className="pl-4 relative text-xs">
            <span
              aria-hidden
              className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ${i === 0 ? "bg-blue-500" : "bg-zinc-300 dark:bg-zinc-600"}`}
            />
            <p className={`font-semibold ${i === 0 ? "text-zinc-900 dark:text-white" : "text-zinc-700 dark:text-zinc-300"}`}>
              {t(messageKey(entry), { carrier: entry.carrier ?? "USPS" })}
            </p>
            <p className="font-mono text-[10px] text-zinc-500">
              {new Date(entry.at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
              {entry.location && ` · ${entry.location}`}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
