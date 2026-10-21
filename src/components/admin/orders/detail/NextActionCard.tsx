"use client";

import { useLocale, useTranslations } from "next-intl";
import { AlertTriangle, Clock, PackageCheck, Printer, RotateCcw } from "lucide-react";
import type { NextAction } from "@/lib/admin/orderActions";
import { primaryBtn } from "./Section";

/** The one primary button on the page (D14), or why there is none. */
export function NextActionCard({ action, busy, onBuyLabel, onReship, onMarkDelivered }: {
  action: NextAction;
  busy: boolean;
  onBuyLabel: () => void;
  onReship: () => void;
  onMarkDelivered: () => void;
}) {
  const t = useTranslations("admin.orderDetail.next");
  const locale = useLocale();
  if (action.kind === "none" && !action.reason) return null;

  const shell = (tone: "amber" | "rose" | "zinc", body: React.ReactNode) => (
    <div className={`rounded-2xl border p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 ${
      tone === "amber" ? "bg-amber-500/10 border-amber-500/30" : tone === "rose" ? "bg-rose-500/10 border-rose-500/30" : "bg-zinc-100 dark:bg-white/[0.04] border-zinc-200 dark:border-white/[0.06]"
    }`}>{body}</div>
  );
  const label = (text: string) => <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600 dark:text-zinc-400 block">{t("eyebrow")}</span>;

  switch (action.kind) {
    case "buy_label":
      return shell("amber", <>
        <div>{label("")}<span className="text-sm font-display font-bold text-zinc-950 dark:text-white">{action.addressMissing ? t("addressAndLabel") : t("buyLabel")}</span></div>
        <button type="button" onClick={onBuyLabel} disabled={busy} className={primaryBtn}><Printer className="w-4 h-4" /> {action.addressMissing ? t("addressAndLabel") : t("buyLabel")}</button>
      </>);
    case "resolve_exception":
      return shell("rose", <>
        <div>{label("")}<span className="text-sm font-display font-bold text-zinc-950 dark:text-white">{t("resolve")}</span>
          <a href="#refunds" className="block text-xs text-rose-600 dark:text-rose-400 hover:underline mt-0.5">{t("refundInstead")}</a></div>
        {action.reship && <button type="button" onClick={onReship} disabled={busy} className={primaryBtn}><RotateCcw className="w-4 h-4" /> {t("reship")}</button>}
      </>);
    case "mark_delivered":
      return shell("zinc", <>
        <div>{label("")}<span className="text-sm font-display font-bold text-zinc-950 dark:text-white">{t("inTransit")}</span>
          <span className="block text-xs text-zinc-600 dark:text-zinc-400 mt-0.5">{t("scansMoveIt")}</span></div>
        <button type="button" onClick={onMarkDelivered} disabled={busy} className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600/15 hover:bg-purple-600/25 text-purple-700 dark:text-purple-300 border border-purple-500/30 text-xs font-semibold"><PackageCheck className="w-4 h-4" /> {t("markDelivered")}</button>
      </>);
    case "await_payment":
      return shell("zinc", <div className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300"><Clock className="w-4 h-4 text-amber-500" />
        {action.holdExpiresAt ? t("holdExpires", { when: new Date(action.holdExpiresAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }) }) : t("awaitingPayment")}</div>);
    case "none":
      return shell("rose", <div className="flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300"><AlertTriangle className="w-4 h-4 shrink-0" /> {action.reason}</div>);
  }
}
