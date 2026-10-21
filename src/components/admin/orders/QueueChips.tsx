"use client";

import { useTranslations } from "next-intl";
import { QUEUES } from "@/lib/admin/orderFilters";
import type { Queue } from "@/lib/admin/orderFilters";

export type QueueCounts = Partial<Record<Queue, number>>;

/** The seven queues (D11). Counts are shown for the two the sidebar badge knows. */
export function QueueChips({ value, counts, onChange }: { value: Queue; counts: QueueCounts; onChange: (q: Queue) => void }) {
  const t = useTranslations("admin.orders.queue");
  return (
    <div role="tablist" aria-label={t("label")} className="flex gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 text-xs font-medium">
      {QUEUES.map((queue) => {
        const selected = queue === value;
        const count = counts[queue] ?? 0;
        const hot = queue === "overdue" && count > 0;
        return (
          <button
            key={queue}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(queue)}
            className={`shrink-0 px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors flex items-center gap-1.5 ${
              selected
                ? hot
                  ? "bg-rose-500 text-white font-bold shadow-xs"
                  : "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold shadow-xs"
                : hot
                  ? "bg-rose-500/15 text-rose-700 dark:text-rose-400 hover:bg-rose-500/25 font-semibold"
                  : "bg-zinc-100 dark:bg-white/[0.04] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            <span>{t(queue)}</span>
            {count > 0 && (
              <span className={`px-1.5 rounded-full text-[10px] font-mono font-bold ${selected ? "bg-black/20" : hot ? "bg-rose-500 text-white" : "bg-amber-500 text-black"}`}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
