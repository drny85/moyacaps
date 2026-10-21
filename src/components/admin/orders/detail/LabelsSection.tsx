"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, ExternalLink, PackageCheck, Printer, Truck, Undo2 } from "lucide-react";
import type { ManualMove } from "@/lib/admin/orderActions";
import type { OrderDetailVM } from "@/lib/admin/orderDetail";
import { Section, secondaryBtn } from "./Section";

export function LabelsSection({ labels, manualMoves, showDeliverHere, onPrintLabel, onManualTracking, onMarkDelivered, onRevert }: {
  labels: OrderDetailVM["labels"];
  manualMoves: ManualMove[];
  /** Mark delivered lives in the Next card when it is the next action; here only as a fallback. */
  showDeliverHere: boolean;
  onPrintLabel: () => void;
  onManualTracking: () => void;
  onMarkDelivered: () => void;
  onRevert: () => void;
}) {
  const t = useTranslations("admin.orderDetail.labels");
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!labels.trackingNumber) return;
    void navigator.clipboard.writeText(labels.trackingNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Section title={t("title")} icon={<Truck className="w-4 h-4 text-moya-red" />}>
      <div className="space-y-2 text-xs text-zinc-700 dark:text-zinc-300">
        {labels.trackingNumber ? (
          <>
            <p><span className="text-zinc-500">{t("carrier")}:</span> <span className="font-semibold">{labels.carrier ?? "—"}</span></p>
            <p className="flex items-center gap-2 flex-wrap">
              <span className="text-zinc-500">{t("tracking")}:</span>
              <span className="font-mono font-semibold text-zinc-900 dark:text-white">{labels.trackingNumber}</span>
              <button type="button" onClick={copy} aria-label={t("copy")} className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:hover:text-white">{copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}</button>
              {labels.trackingUrl && <a href={labels.trackingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">{t("track")} <ExternalLink className="w-3 h-3" /></a>}
            </p>
          </>
        ) : (
          <p className="text-zinc-500">{t("none")}</p>
        )}
        {labels.manualOverride && <p className="text-[11px] text-purple-600 dark:text-purple-400">{t("override")}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {labels.labelUrl && <button type="button" onClick={onPrintLabel} className={secondaryBtn}><Printer className="w-3.5 h-3.5" /> {t("printLabel")}</button>}
        {showDeliverHere && manualMoves.includes("mark_delivered") && <button type="button" onClick={onMarkDelivered} className={secondaryBtn}><PackageCheck className="w-3.5 h-3.5" /> {t("markDelivered")}</button>}
        {manualMoves.includes("revert") && <button type="button" onClick={onRevert} className={secondaryBtn}><Undo2 className="w-3.5 h-3.5" /> {t("revert")}</button>}
      </div>
      <button type="button" onClick={onManualTracking} className="text-[11px] text-zinc-500 hover:text-zinc-900 dark:hover:text-white underline underline-offset-2">{t("manual")}</button>
    </Section>
  );
}
