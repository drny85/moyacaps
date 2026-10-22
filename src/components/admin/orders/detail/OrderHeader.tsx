"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check, Copy, Printer, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/routing";
import { OrderStatusPills } from "@/components/admin/OrderStatusPills";
import { HandedOffTag } from "../HandedOffTag";
import type { OrderDetailVM } from "@/lib/admin/orderDetail";
import { secondaryBtn } from "./Section";

export function OrderHeader({ header }: { header: OrderDetailVM["header"] }) {
  const t = useTranslations("admin.orderDetail");
  const tOrders = useTranslations("admin.orders");
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(header.orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="space-y-3">
      <Link href="/admin/orders" className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
        <ArrowLeft className="w-3.5 h-3.5" /> {t("back")}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-mono font-bold text-xl sm:text-2xl text-zinc-950 dark:text-white">{header.orderNumber}</h1>
            <button type="button" onClick={copy} aria-label={t("labels.copy")} className="p-1 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-white">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            <OrderStatusPills order={header.lifecycle} />
            {header.handedOff && <HandedOffTag />}
          </div>
          <p className="text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
            {t("placed", { when: header.placedLabel })} · {tOrders(`age.${header.age.unit}`, { count: header.age.value })}
          </p>
        </div>
        <button type="button" onClick={() => window.print()} className={secondaryBtn}>
          <Printer className="w-3.5 h-3.5" /> {t("print")}
        </button>
      </div>
      {header.disputed && (
        <p role="alert" className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" /> {t("disputed")}
        </p>
      )}
    </div>
  );
}
