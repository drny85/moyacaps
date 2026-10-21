"use client";

import { useTranslations } from "next-intl";
import { CreditCard } from "lucide-react";
import type { OrderDetailVM } from "@/lib/admin/orderDetail";
import { Section } from "./Section";

export function MoneySection({ money }: { money: OrderDetailVM["money"] }) {
  const t = useTranslations("admin.orderDetail.money");
  const row = (label: string, value: string, tone = "text-zinc-600 dark:text-zinc-400") => (
    <div className={`flex justify-between text-xs ${tone}`}><span>{label}</span><span className="font-mono">{value}</span></div>
  );
  return (
    <Section title={t("title")} icon={<CreditCard className="w-4 h-4 text-moya-red" />}>
      <div className="space-y-1.5">
        {money.subtotalLabel && row(t("subtotal"), money.subtotalLabel)}
        {money.shippingLabel && row(t("shipping"), money.shippingLabel === "free" ? t("free") : money.shippingLabel)}
        {money.taxLabel && row(money.taxRate ? t("taxRate", { rate: money.taxRate }) : t("tax"), money.taxLabel)}
        {money.refundedLabel && row(t("refunded"), `−${money.refundedLabel}`, "text-rose-600 dark:text-rose-400 font-medium")}
        <div className="pt-2 border-t border-zinc-100 dark:border-white/[0.06] flex justify-between font-bold text-sm text-zinc-900 dark:text-white">
          <span>{money.paid ? t("totalPaid") : t("totalDue")}</span>
          <span className={`font-mono ${money.paid ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{money.totalLabel}</span>
        </div>
      </div>
    </Section>
  );
}
