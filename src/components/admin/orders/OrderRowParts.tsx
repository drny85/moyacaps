"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { AlertTriangle, ListChecks, Printer } from "lucide-react";
import { OrderStatusPills } from "@/components/admin/OrderStatusPills";
import type { OrderRowVM } from "@/lib/admin/orderRow";
import { HandedOffTag } from "./HandedOffTag";

export type PackingProgress = { checkedUnits: number; totalUnits: number; complete: boolean };

/** Status pills plus the tags beside them: Handed off, a handoff warning, packing progress. Shared by the card and the table. */
export function OrderTags({ row, packing }: { row: OrderRowVM; packing?: PackingProgress }) {
  const t = useTranslations("admin.orders");
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <OrderStatusPills order={row.lifecycle} />
      {row.handedOff && <HandedOffTag />}
      {row.handoffFlag && (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 text-[10px] font-semibold">
          <AlertTriangle className="w-3 h-3" /> {t(`handoff.flag.${row.handoffFlag}`)}
        </span>
      )}
      {packing && packing.checkedUnits > 0 && (
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-semibold ${
            packing.complete
              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20"
              : "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20"
          }`}
        >
          <ListChecks className="w-3 h-3" /> {t("packing", { checked: packing.checkedUnits, total: packing.totalUnits })}
        </span>
      )}
    </div>
  );
}

/** Up to three item photos, overlapping. */
export function OrderThumbs({ thumbs }: { thumbs: string[] }) {
  return (
    <span className="flex -space-x-2 shrink-0">
      {thumbs.map((src, i) => (
        <span key={i} className="w-7 h-7 rounded-md bg-zinc-100 dark:bg-zinc-800 border border-white dark:border-black relative overflow-hidden">
          <Image src={src} alt="" fill sizes="28px" className="object-cover" />
        </span>
      ))}
    </span>
  );
}

/** The row's one quick action (D10): Buy label or Reship. It sits inside a link, so it stops the click. */
export function QuickAction({ row, onQuickAction }: { row: OrderRowVM; onQuickAction: (row: OrderRowVM) => void }) {
  const t = useTranslations("admin.orders");
  if (!row.quickAction) return null;
  const label = row.quickAction === "reship" ? t("reship") : row.addressMissing ? t("addressAndLabel") : t("buyLabel");
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onQuickAction(row);
      }}
      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 shadow-xs transition-colors whitespace-nowrap ${
        row.addressMissing
          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/30"
          : "bg-amber-500 hover:bg-amber-400 text-zinc-950"
      }`}
    >
      <Printer className="w-3.5 h-3.5" /> {label}
    </button>
  );
}
