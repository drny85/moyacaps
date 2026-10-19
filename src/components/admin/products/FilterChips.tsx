"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, Star, X } from "lucide-react";
import { CATEGORIES } from "@convex/catalog/rules";
import { STATUS_FILTERS, STOCK_FILTERS, hasActiveFilters } from "@/lib/admin/productFilters";
import type { ProductFilters } from "@/lib/admin/productFilters";

const chipClass = (active: boolean) =>
  `shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
    active
      ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent"
      : "bg-white dark:bg-white/[0.03] text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-white/10 hover:border-zinc-400 dark:hover:border-white/30"
  }`;

function Chip({ active, count, onClick, children }: { active: boolean; count?: number; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={chipClass(active)}>
      {children}
      {count !== undefined && <span className={`font-mono text-[10px] ${active ? "opacity-70" : "text-zinc-500"}`}>{count}</span>}
    </button>
  );
}

const Divider = () => <span aria-hidden className="shrink-0 w-px h-5 bg-zinc-200 dark:bg-white/10" />;

/**
 * The grid's filter chips (D4). Stateless: one value per group, clicking the active chip
 * clears it. `count(patch)` is how many Products the grid would show with that chip on,
 * or undefined when the loaded rows cannot tell (archived rows load only under Archived).
 */
export function FilterChips({
  filters,
  onChange,
  onClear,
  count,
}: {
  filters: ProductFilters;
  onChange: (patch: Partial<ProductFilters>) => void;
  onClear: () => void;
  count: (patch: Partial<ProductFilters>) => number | undefined;
}) {
  const t = useTranslations("admin.products.filters");

  return (
    <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-2 overflow-x-auto sm:flex-wrap pb-1 [scrollbar-width:none]" role="toolbar" aria-label={t("label")}>
      {CATEGORIES.map((c) => (
        <Chip key={c} active={filters.category === c} count={count({ category: c })} onClick={() => onChange({ category: filters.category === c ? undefined : c })}>
          {t(`category.${c}`)}
        </Chip>
      ))}
      <Divider />
      {STATUS_FILTERS.map((s) => (
        <Chip key={s} active={filters.status === s} count={count({ status: s })} onClick={() => onChange({ status: filters.status === s ? undefined : s })}>
          {t(`status.${s}`)}
        </Chip>
      ))}
      <Divider />
      {STOCK_FILTERS.map((s) => (
        <Chip key={s} active={filters.stock === s} count={count({ stock: s })} onClick={() => onChange({ stock: filters.stock === s ? undefined : s })}>
          {t(`stock.${s}`)}
        </Chip>
      ))}
      <Divider />
      <Chip active={Boolean(filters.featured)} count={count({ featured: true })} onClick={() => onChange({ featured: !filters.featured || undefined })}>
        <Star className="w-3 h-3" />
        {t("featured")}
      </Chip>
      <Chip active={Boolean(filters.attention)} count={count({ attention: true })} onClick={() => onChange({ attention: !filters.attention || undefined })}>
        <AlertTriangle className="w-3 h-3" />
        {t("attention")}
      </Chip>
      {hasActiveFilters(filters) && (
        <button type="button" onClick={onClear} className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-semibold text-moya-red hover:bg-moya-red/10">
          <X className="w-3 h-3" />
          {t("clear")}
        </button>
      )}
    </div>
  );
}
