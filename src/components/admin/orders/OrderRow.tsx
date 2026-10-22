"use client";

import { useTranslations } from "next-intl";
import { ChevronRight, Clock } from "lucide-react";
import { Link } from "@/i18n/routing";
import type { OrderRowVM } from "@/lib/admin/orderRow";
import { OrderTags, OrderThumbs, QuickAction, type PackingProgress } from "./OrderRowParts";

/** One Order as a card on narrow screens (D10); wide screens get OrdersTable. */
export function OrderRow({ row, packing, onQuickAction }: { row: OrderRowVM; packing?: PackingProgress; onQuickAction: (row: OrderRowVM) => void }) {
  const t = useTranslations("admin.orders");
  return (
    <li>
      <Link
        href={row.href}
        className="block p-3.5 rounded-2xl bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] shadow-xs hover:border-zinc-300 dark:hover:border-white/15 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-sm text-zinc-900 dark:text-white">{row.orderNumber}</span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-mono ${row.overdue ? "text-rose-500 font-bold" : "text-zinc-500 dark:text-zinc-400"}`}>
                {row.overdue && <Clock className="w-3 h-3" />}
                {t(`age.${row.age.unit}`, { count: row.age.value })}
              </span>
            </div>
            <OrderTags row={row} packing={packing} />
            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 min-w-0">
              <span className="font-medium text-zinc-900 dark:text-white truncate">{row.customer || t("guest")}</span>
              <span aria-hidden>·</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white shrink-0">{row.totalLabel}</span>
              <span aria-hidden>·</span>
              <span className="shrink-0">{t("items", { count: row.itemCount })}</span>
              <OrderThumbs thumbs={row.thumbs} />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <QuickAction row={row} onQuickAction={onQuickAction} />
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </div>
        </div>
      </Link>
    </li>
  );
}
