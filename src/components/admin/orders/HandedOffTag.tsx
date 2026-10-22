"use client";

import { useTranslations } from "next-intl";
import { Truck } from "lucide-react";

/** Beside Ready to Ship once a Handoff is recorded: the status only moves on a carrier scan (ADR 0030). */
export function HandedOffTag() {
  const t = useTranslations("admin.orders");
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/20 text-[10px] font-semibold">
      <Truck className="w-3 h-3" /> {t("handoff.handedOff")}
    </span>
  );
}
