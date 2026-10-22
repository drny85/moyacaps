"use client";

import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { pageBounds } from "@/lib/admin/orderFilters";

const btn =
  "inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:bg-zinc-50 dark:hover:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed";

/** "1–50 of 312" with Previous and Next (plan 0013 Q5). The buttons appear only when there is more than one page. */
export function Pager({ page, pageCount, pageSize, total, onPage }: { page: number; pageCount: number; pageSize: number; total: number; onPage: (page: number) => void }) {
  const t = useTranslations("admin.orders.pager");
  const { first, last } = pageBounds(page, pageSize, total);
  return (
    <nav aria-label={t("label")} className="flex items-center justify-between gap-3">
      <span className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">{t("range", { first, last, total })}</span>
      {pageCount > 1 && (
        <div className="flex gap-2">
          <button type="button" className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
            <ChevronLeft className="w-3.5 h-3.5" /> {t("prev")}
          </button>
          <button type="button" className={btn} disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
            {t("next")} <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </nav>
  );
}
