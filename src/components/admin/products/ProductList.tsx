"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Search } from "lucide-react";
import { CATEGORIES } from "@convex/catalog/rules";
import type { ResolvedVariant } from "@/lib/admin/productForm";
import { DEFAULT_FILTERS, filterProducts, silhouetteOptions, withFilterCategory } from "@/lib/admin/productFilters";
import type { AvailabilityFilter } from "@/lib/admin/productFilters";
import { ProductRow } from "./ProductRow";
import type { ProductRowHandlers } from "./ProductRow";

const pill = (active: boolean, activeClass = "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-semibold shadow-xs") =>
  `px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
    active ? activeClass : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
  }`;

function PillGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100/80 dark:bg-white/[0.04]">{children}</div>;
}

/** Search, category/silhouette/availability/archived filters and the product table. */
export function ProductList({
  rows,
  locale,
  showArchived,
  onShowArchived,
  updatingStockId,
  flashStockId,
  handlers,
}: {
  rows: ResolvedVariant[] | undefined;
  locale: string;
  showArchived: boolean;
  onShowArchived: (show: boolean) => void;
  updatingStockId: string | null;
  flashStockId: string | null;
  handlers: ProductRowHandlers;
}) {
  const t = useTranslations("admin.products");
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const visible = rows ? filterProducts(rows, filters) : [];
  const setAvailability = (availability: AvailabilityFilter) => setFilters({ ...filters, availability });

  return (
    <>
      <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-4 shadow-xs flex flex-col gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-600 dark:text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filters.query}
            onChange={(e) => setFilters({ ...filters, query: e.target.value })}
            placeholder={t("searchPlaceholder")}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-moya-red"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PillGroup>
            <button onClick={() => setFilters(withFilterCategory(filters, "all"))} className={pill(filters.category === "all")}>
              {t("filterAllCategories")}
            </button>
            {CATEGORIES.map((c) => (
              <button key={c} onClick={() => setFilters(withFilterCategory(filters, c))} className={pill(filters.category === c)}>
                {t(`categories.${c}`)}
              </button>
            ))}
          </PillGroup>

          <PillGroup>
            <button onClick={() => setFilters({ ...filters, silhouette: "all" })} className={pill(filters.silhouette === "all")}>
              {t("filterAllSilhouettes")}
            </button>
            {silhouetteOptions(filters.category).map((s) => (
              <button key={s} onClick={() => setFilters({ ...filters, silhouette: s })} className={pill(filters.silhouette === s)}>
                {t(s)}
              </button>
            ))}
          </PillGroup>

          <PillGroup>
            <button onClick={() => setAvailability("all")} className={pill(filters.availability === "all")}>
              {t("filterAllStatus")}
            </button>
            <button onClick={() => setAvailability("available")} className={pill(filters.availability === "available", "bg-emerald-600 text-white font-semibold shadow-xs")}>
              <Eye className="w-3 h-3" />
              <span>{t("filterAvailableOnly")}</span>
            </button>
            <button onClick={() => setAvailability("unavailable")} className={pill(filters.availability === "unavailable", "bg-amber-600 text-white font-semibold shadow-xs")}>
              <EyeOff className="w-3 h-3" />
              <span>{t("filterUnavailableOnly")}</span>
            </button>
          </PillGroup>

          <label className="flex items-center gap-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={showArchived} onChange={(e) => onShowArchived(e.target.checked)} />
            <span>{t("showArchived")}</span>
          </label>
        </div>
      </div>

      <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl overflow-hidden shadow-xs">
        {!rows ? (
          <div className="p-12 text-center text-xs font-mono text-zinc-600 dark:text-zinc-400 animate-pulse">{t("loading")}</div>
        ) : visible.length === 0 ? (
          <div className="p-12 text-center text-zinc-600 dark:text-zinc-400 text-xs">{t("noMatches")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-100 dark:border-white/[0.06] bg-zinc-50/70 dark:bg-white/[0.02] text-zinc-600 dark:text-zinc-400 font-mono uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-4">{t("columns.image")}</th>
                  <th className="py-3 px-4">{t("columns.product")}</th>
                  <th className="py-3 px-4">{t("columns.palette")}</th>
                  <th className="py-3 px-4">{t("columns.silhouette")}</th>
                  <th className="py-3 px-4">{t("columns.price")}</th>
                  <th className="py-3 px-4">{t("columns.stock")}</th>
                  <th className="py-3 px-4 text-center">{t("availability")}</th>
                  <th className="py-3 px-4 text-center">{t("columns.featured")}</th>
                  <th className="py-3 px-4 text-center">{t("columns.drop")}</th>
                  <th className="py-3 px-4 text-right">{t("columns.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                {visible.map((row) => (
                  <ProductRow
                    key={row.variantId}
                    row={row}
                    locale={locale}
                    isUpdating={updatingStockId === row.variantId}
                    isFlashing={flashStockId === row.variantId}
                    handlers={handlers}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
