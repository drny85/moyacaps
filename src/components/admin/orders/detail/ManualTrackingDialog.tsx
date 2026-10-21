"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { AdminModal } from "@/components/admin/AdminModal";
import { inputClass, primaryBtn } from "./Section";

const CARRIERS = ["USPS", "UPS", "FedEx", "DHL"];

/** Carrier and Tracking Number typed by hand (D15): for a label bought outside the store. */
export function ManualTrackingDialog({ open, initial, busy, onSave, onClose }: {
  open: boolean;
  initial: { carrier?: string; trackingNumber?: string };
  busy: boolean;
  onSave: (input: { carrier: string; trackingNumber: string }) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslations("admin.orderDetail.labels");
  const titleId = useId();
  const [carrier, setCarrier] = useState(initial.carrier ?? "USPS");
  const [trackingNumber, setTrackingNumber] = useState(initial.trackingNumber ?? "");
  useEffect(() => {
    if (open) {
      setCarrier(initial.carrier ?? "USPS");
      setTrackingNumber(initial.trackingNumber ?? "");
    }
  }, [open, initial]);
  return (
    <AdminModal isOpen={open} onClose={onClose} isProcessing={busy} labelledBy={titleId} maxWidthClass="max-w-md">
      <h2 id={titleId} className="font-display font-bold text-base text-zinc-950 dark:text-white">{t("manualTitle")}</h2>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">{t("manualHelp")}</p>
      <form onSubmit={async (e) => { e.preventDefault(); if (await onSave({ carrier, trackingNumber })) onClose(); }} className="space-y-3">
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">{t("carrier")}
          <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className={`${inputClass} mt-1`}>{CARRIERS.map((c) => <option key={c}>{c}</option>)}</select>
        </label>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">{t("tracking")}
          <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className={`${inputClass} mt-1 font-mono`} />
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06]">{t("cancel")}</button>
          <button type="submit" disabled={busy} className={primaryBtn}>{busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {t("manualSave")}</button>
        </div>
      </form>
    </AdminModal>
  );
}
