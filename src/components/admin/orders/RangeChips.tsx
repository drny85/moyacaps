"use client";

import { useTranslations } from "next-intl";
import { RANGES } from "@/lib/admin/orderFilters";
import type { Range } from "@/lib/admin/orderFilters";

const dateInput =
  "py-1 px-2 rounded-lg bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/10 text-xs text-zinc-900 dark:text-white";

/**
 * Today · 7d · 30d · All · Custom (D11, D17, plan 0013 Q4). Custom adds From and To days. When the
 * range does not apply (a Working Queue, or a search) the chips grey out and `disabledHint` says why.
 */
export function RangeChips({
  value,
  from,
  to,
  disabledHint,
  onChange,
  onDates,
}: {
  value: Range;
  from: string;
  to: string;
  disabledHint: string | null;
  onChange: (r: Range) => void;
  onDates: (dates: { from: string; to: string }) => void;
}) {
  const t = useTranslations("admin.orders.range");
  const disabled = disabledHint !== null;
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="radiogroup"
          aria-label={t("label")}
          aria-disabled={disabled}
          className={`flex gap-1 p-0.5 rounded-lg bg-zinc-100 dark:bg-white/[0.04] text-[11px] font-mono font-medium w-fit ${disabled ? "opacity-50" : ""}`}
        >
          {RANGES.map((range) => {
            const selected = range === value;
            return (
              <button
                key={range}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => onChange(range)}
                className={`px-2.5 py-1 rounded-md transition-colors disabled:cursor-not-allowed ${
                  selected ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                }`}
              >
                {t(range)}
              </button>
            );
          })}
        </div>
        {value === "custom" && !disabled && (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400">
            <label className="inline-flex items-center gap-1">
              {t("from")}
              <input type="date" value={from} max={to || undefined} onChange={(e) => onDates({ from: e.target.value, to })} className={dateInput} />
            </label>
            <label className="inline-flex items-center gap-1">
              {t("to")}
              <input type="date" value={to} min={from || undefined} onChange={(e) => onDates({ from, to: e.target.value })} className={dateInput} />
            </label>
          </div>
        )}
      </div>
      {disabledHint && <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{disabledHint}</p>}
    </div>
  );
}
