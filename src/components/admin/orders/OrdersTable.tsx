"use client";

import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ArrowUpDown, Clock } from "lucide-react";
import { Link, useRouter } from "@/i18n/routing";
import { sortDirection, toggleSort, type SortColumn } from "@/lib/admin/orderFilters";
import type { OrderRowVM } from "@/lib/admin/orderRow";
import type { DeskSort } from "@convex/orders/deskPage";
import { OrderTags, OrderThumbs, QuickAction, type PackingProgress } from "./OrderRowParts";

function SortHeader({ column, sort, onSort, align = "left" }: { column: SortColumn; sort: DeskSort; onSort: (s: DeskSort) => void; align?: "left" | "right" }) {
  const t = useTranslations("admin.orders.columns");
  const dir = sortDirection(sort, column);
  const Icon = dir === "asc" ? ArrowUp : dir === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <th scope="col" aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : "none"} className={`px-4 py-2.5 font-semibold ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={() => onSort(toggleSort(sort, column))}
        className={`inline-flex items-center gap-1 uppercase tracking-wide hover:text-zinc-900 dark:hover:text-white ${dir ? "text-zinc-900 dark:text-white" : ""}`}
      >
        {t(column)} <Icon className={`w-3 h-3 ${dir ? "" : "opacity-40"}`} />
      </button>
    </th>
  );
}

/**
 * The Orders desk on wide screens (plan 0013): one row per Order, sortable by Placed and Total.
 * The whole row opens the Order; the order number is the keyboard-reachable link.
 */
export function OrdersTable({
  rows,
  packing,
  sort,
  onSort,
  onQuickAction,
}: {
  rows: OrderRowVM[];
  packing: Map<string, PackingProgress>;
  sort: DeskSort;
  onSort: (s: DeskSort) => void;
  onQuickAction: (row: OrderRowVM) => void;
}) {
  const t = useTranslations("admin.orders");
  const router = useRouter();
  const head = "px-4 py-2.5 text-left font-semibold uppercase tracking-wide";
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0c0c14] shadow-xs">
      <table className="w-full text-xs">
        <thead className="bg-zinc-50 dark:bg-white/[0.03] text-[10px] text-zinc-500 dark:text-zinc-400">
          <tr>
            <th scope="col" className={head}>{t("columns.order")}</th>
            <SortHeader column="placed" sort={sort} onSort={onSort} />
            <th scope="col" className={head}>{t("columns.customer")}</th>
            <th scope="col" className={head}>{t("columns.status")}</th>
            <th scope="col" className={head}>{t("columns.items")}</th>
            <SortHeader column="total" sort={sort} onSort={onSort} align="right" />
            <th scope="col" className="px-4 py-2.5"><span className="sr-only">{t("columns.action")}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.05]">
          {rows.map((row) => (
            <tr key={row.id} onClick={() => router.push(row.href)} className="cursor-pointer hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors">
              <td className="px-4 py-3 whitespace-nowrap">
                <Link href={row.href} onClick={(e) => e.stopPropagation()} className="font-mono font-bold text-zinc-900 dark:text-white hover:underline">
                  {row.orderNumber}
                </Link>
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <div className="text-zinc-900 dark:text-white">{row.placedLabel}</div>
                <div className={`inline-flex items-center gap-1 text-[10px] font-mono ${row.overdue ? "text-rose-500 font-bold" : "text-zinc-500 dark:text-zinc-400"}`}>
                  {row.overdue && <Clock className="w-3 h-3" />}
                  {t(`age.${row.age.unit}`, { count: row.age.value })}
                </div>
              </td>
              <td className="px-4 py-3 max-w-[14rem] truncate font-medium text-zinc-900 dark:text-white">{row.customer || t("guest")}</td>
              <td className="px-4 py-3"><OrderTags row={row} packing={packing.get(row.id)} /></td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2 whitespace-nowrap text-zinc-600 dark:text-zinc-400">
                  <OrderThumbs thumbs={row.thumbs} />
                  {t("items", { count: row.itemCount })}
                </div>
              </td>
              <td className="px-4 py-3 text-right font-mono font-bold text-zinc-900 dark:text-white whitespace-nowrap">{row.totalLabel}</td>
              <td className="px-4 py-3 text-right"><QuickAction row={row} onQuickAction={onQuickAction} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
