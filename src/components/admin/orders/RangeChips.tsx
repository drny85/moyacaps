"use client";

import { useTranslations } from "next-intl";
import { RANGES } from "@/lib/admin/orderFilters";
import type { Range } from "@/lib/admin/orderFilters";

/** Today · 7d · 30d · All (D11, D17). */
export function RangeChips({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const t = useTranslations("admin.orders.range");
  return (
    <div role="radiogroup" aria-label={t("label")} className="flex gap-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-white/[0.04] text-[11px] font-mono font-medium w-fit">
      {RANGES.map((range) => {
        const selected = range === value;
        return (
          <button
            key={range}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(range)}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              selected ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            {t(range)}
          </button>
        );
      })}
    </div>
  );
}
