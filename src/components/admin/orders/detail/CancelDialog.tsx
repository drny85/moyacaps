"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { inputClass } from "./Section";

/** Cancel an Order (D13 danger zone): reason, and a Stripe refund when the Order can take one. */
export function CancelDialog({ open, refundable, busy, error, onConfirm, onClose }: {
  open: boolean;
  refundable: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: (input: { refundStripe: boolean; reason: string }) => Promise<boolean>;
  onClose: () => void;
}) {
  const t = useTranslations("admin.orderDetail.danger");
  const [reason, setReason] = useState("");
  const [refundStripe, setRefundStripe] = useState(true);
  useEffect(() => {
    if (open) {
      setReason("");
      setRefundStripe(true);
    }
  }, [open]);
  return (
    <ConfirmDialog
      open={open}
      title={t("cancelTitle")}
      body={t("cancelBody")}
      confirmLabel={t("confirm")}
      destructive
      busy={busy}
      error={error}
      onClose={onClose}
      onConfirm={async () => {
        // The Order is cancelled server-side even when the Stripe refund fails: close either way;
        // the page banner then points at the refunds panel to retry.
        await onConfirm({ refundStripe: refundable && refundStripe, reason });
        onClose();
      }}
    >
      <div className="space-y-3">
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">{t("reason")}
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className={`${inputClass} mt-1`} />
        </label>
        {refundable && (
          <label className="flex items-start gap-2 text-xs text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" checked={refundStripe} onChange={(e) => setRefundStripe(e.target.checked)} className="mt-0.5 accent-moya-red" />
            <span><span className="font-semibold block">{t("refundStripe")}</span><span className="text-zinc-500">{t("refundStripeHelp")}</span></span>
          </label>
        )}
      </div>
    </ConfirmDialog>
  );
}
