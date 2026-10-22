"use client";

import { useTranslations } from "next-intl";
import { ArrowUpDown } from "lucide-react";
import { DESK_SORTS, type DeskSort } from "@convex/orders/deskPage";

/** The table's sort on narrow screens, where there are no column headers to click (plan 0013 Q9). */
export function SortSelect({ value, onChange }: { value: DeskSort; onChange: (s: DeskSort) => void }) {
  const t = useTranslations("admin.orders.sort");
  return (
    <label className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400">
      <ArrowUpDown className="w-3.5 h-3.5" />
      <span className="sr-only">{t("label")}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as DeskSort)}
        className="py-1 pl-2 pr-6 rounded-lg bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white"
      >
        {DESK_SORTS.map((s) => (
          <option key={s} value={s}>
            {t(s)}
          </option>
        ))}
      </select>
    </label>
  );
}
