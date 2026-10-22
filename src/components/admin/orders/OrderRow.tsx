"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { AlertTriangle, ChevronRight, Clock, Printer, Truck } from "lucide-react";
import { Link } from "@/i18n/routing";
import { OrderStatusPills } from "@/components/admin/OrderStatusPills";
import type { OrderRowVM } from "@/lib/admin/orderRow";

/** One Order as a card (D10): glance info plus the single quick action the state machine allows. */
export function OrderRow({ row, onQuickAction }: { row: OrderRowVM; onQuickAction: (row: OrderRowVM) => void }) {
  const t = useTranslations("admin.orders");
  const quickLabel = row.quickAction === "reship" ? t("reship") : row.addressMissing ? t("addressAndLabel") : t("buyLabel");
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
            <OrderStatusPills order={row.lifecycle} />
            {(row.handedOff || row.handoffFlag) && (
              <div className="flex items-center gap-1.5 flex-wrap text-[10px] font-semibold">
                {row.handedOff && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20">
                    <Truck className="w-3 h-3" /> {t("handoff.handedOff")}
                  </span>
                )}
                {row.handoffFlag && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                    <AlertTriangle className="w-3 h-3" /> {t(`handoff.flag.${row.handoffFlag}`)}
                  </span>
                )}
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 min-w-0">
              <span className="font-medium text-zinc-900 dark:text-white truncate">{row.customer || t("guest")}</span>
              <span aria-hidden>·</span>
              <span className="font-mono font-bold text-zinc-900 dark:text-white shrink-0">{row.totalLabel}</span>
              <span aria-hidden>·</span>
              <span className="shrink-0">{t("items", { count: row.itemCount })}</span>
              <span className="flex -space-x-2 shrink-0">
                {row.thumbs.map((src, i) => (
                  <span key={i} className="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-white dark:border-black relative overflow-hidden">
                    <Image src={src} alt="" fill sizes="28px" className="object-cover" />
                  </span>
                ))}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {row.quickAction && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  onQuickAction(row);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-xs transition-colors ${
                  row.addressMissing
                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
                    : "bg-amber-500 hover:bg-amber-400 text-zinc-950"
                }`}
              >
                <Printer className="w-3.5 h-3.5" /> {quickLabel}
              </button>
            )}
            <ChevronRight className="w-4 h-4 text-zinc-400" />
          </div>
        </div>
      </Link>
    </li>
  );
}
