"use client";

/** The Order Timeline (CONTEXT.md): every event and carrier scan, newest first. */
import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { History } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { toTimelineRow, type TimelineTone } from "@/lib/admin/orderTimeline";
import { Section } from "./Section";

const DOT: Record<TimelineTone, string> = {
  zinc: "bg-zinc-400",
  emerald: "bg-emerald-500",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  purple: "bg-purple-500",
};

export function TimelineSection({ orderId }: { orderId: Id<"orders"> }) {
  const t = useTranslations("admin.orderDetail.timeline");
  const locale = useLocale();
  const entries = useQuery(api.orders.timelineQueries.getOrderTimelineAdmin, { orderId });
  const rows = useMemo(() => entries?.map(toTimelineRow), [entries]);

  return (
    <Section title={t("title")} icon={<History className="w-4 h-4 text-moya-red" />}>
      {!rows ? (
        <p className="text-xs text-zinc-500">{t("loading")}</p>
      ) : (
        <ol className="relative space-y-3 border-l border-zinc-200 dark:border-white/10 ml-1.5">
          {rows.map((row) => (
            <li key={row.key} className="pl-4 relative text-xs">
              <span className={`absolute -left-[5px] top-1 w-2.5 h-2.5 rounded-full ring-2 ring-white dark:ring-[#0c0c14] ${DOT[row.tone]}`} aria-hidden />
              <p className="font-semibold text-zinc-900 dark:text-white">{row.title}</p>
              {row.details && <p className="text-zinc-600 dark:text-zinc-400 break-words">{row.details}</p>}
              <p className="font-mono text-[10px] text-zinc-500">
                {new Date(row.at).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}
                {row.meta && ` · ${row.meta}`}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
