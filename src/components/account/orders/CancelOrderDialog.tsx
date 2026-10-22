"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useAction } from "convex/react";
import { AlertTriangle, Loader2, XCircle } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { CustomerOrder } from "./types";

/** Modal for cancelling a cancellable Order and refunding it. Mount it only while open. */
export function CancelOrderDialog({
  order,
  onClose,
  onCancelled,
}: {
  order: CustomerOrder;
  onClose: () => void;
  onCancelled: (message: string) => void;
}) {
  const t = useTranslations("account");
  const cancelAndRefund = useAction(api.payments.refunds.cancelAndRefundOrder);
  const [cancelReason, setCancelReason] = useState("Ordered wrong colorway");
  const [isProcessingCancel, setIsProcessingCancel] = useState(false);

  const handleCancelOrder = async () => {
    try {
      setIsProcessingCancel(true);
      const data = await cancelAndRefund({
        orderId: order._id,
        reason: cancelReason,
      });

      onCancelled(data.message || "Order cancelled and refund initiated.");
      onClose();
    } catch (err) {
      alert((err instanceof Error && err.message) || "Failed to cancel order");
    } finally {
      setIsProcessingCancel(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md p-6 rounded-3xl bg-white dark:bg-[#0c0c14] border border-black/[0.08] dark:border-white/[0.08] shadow-2xl relative">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-white">
          {t("cancelConfirmTitle")}
        </h3>
        <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
          {t("cancelConfirmDesc")}
        </p>

        <div className="my-4 p-3.5 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] text-xs">
          <div className="flex justify-between font-mono">
            <span className="text-zinc-500">Order:</span>
            <span className="font-bold text-zinc-900 dark:text-white">#{order.orderNumber}</span>
          </div>
          <div className="flex justify-between font-mono mt-1">
            <span className="text-zinc-500">Refund Amount:</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400">
              ${Number(order.total).toFixed(2)} {order.currency}
            </span>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-[11px] font-mono text-zinc-500 mb-1">
            {t("cancelReasonLabel")}
          </label>
          <select
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border border-black/[0.08] dark:border-white/[0.08] text-xs font-mono text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-moya-red"
          >
            <option value="Ordered wrong colorway">{t("cancelReason1")}</option>
            <option value="Accidental duplicate order">{t("cancelReason2")}</option>
            <option value="Need to change delivery details">{t("cancelReason3")}</option>
            <option value="Changed my mind">{t("cancelReason4")}</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessingCancel}
            className="px-4 py-2 rounded-xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-xs font-display font-bold text-zinc-700 dark:text-zinc-300"
          >
            {t("keepOrderBtn")}
          </button>
          <button
            type="button"
            onClick={handleCancelOrder}
            disabled={isProcessingCancel}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-display font-bold flex items-center gap-1.5 shadow-lg shadow-rose-600/30 disabled:opacity-50"
          >
            {isProcessingCancel ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <XCircle className="w-3.5 h-3.5" />
            )}
            <span>{isProcessingCancel ? "Processing..." : t("confirmCancelBtn")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
