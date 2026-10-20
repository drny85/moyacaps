"use client";

/**
 * Money back on the admin order page (plan 0008): every refund recorded for the Order, and the
 * actions that add one — refund lines, record a Return, give a Goodwill Refund, retry a refund
 * Stripe did not answer. Payment Status itself follows Stripe's webhook.
 */
import React, { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { formatCents, refundBlock, returnWindowClosesAt } from "@convex/payments/refundModel";
import { statusAxes } from "@convex/orders/status";
import { RefundDialog } from "./RefundDialog";
import { REFUND_KIND_LABELS, REFUND_STATUS_LABELS, type RefundMode } from "@/lib/refundForm";
import { Gift, Loader2, PackageOpen, RotateCcw, Undo2 } from "lucide-react";

const STATUS_TONES: Record<Doc<"order_refunds">["status"], string> = {
  pending: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  issued: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  failed: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
};

interface OrderRefundsPanelProps {
  order: Doc<"orders">;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}

export function OrderRefundsPanel({ order, onMessage, onError }: OrderRefundsPanelProps) {
  const ledger = useQuery(api.payments.refundLedger.listOrderRefunds, { orderId: order._id }) ?? [];
  const retryRefund = useAction(api.payments.refunds.retryRefund);
  const [mode, setMode] = useState<RefundMode | null>(null);
  const [retrying, setRetrying] = useState<Id<"order_refunds"> | null>(null);

  const blocked = refundBlock(order);
  const { fulfillmentStatus } = statusAxes(order);
  const shipped = ["label_purchased", "in_transit", "delivered"].includes(fulfillmentStatus);
  const closesAt = returnWindowClosesAt(order);
  const returnOpen = shipped && closesAt !== undefined && Date.now() <= closesAt;

  const retry = async (refundId: Id<"order_refunds">) => {
    setRetrying(refundId);
    try {
      const outcome = await retryRefund({ refundId });
      if (outcome.status === "issued") onMessage(`Refund of ${formatCents(outcome.amountCents)} issued.`);
      else onError(`Refund still ${outcome.status}: ${outcome.error ?? "no answer from Stripe"}`);
    } catch (err: any) {
      onError(err?.data ?? err?.message ?? "Retry failed.");
    } finally {
      setRetrying(null);
    }
  };

  const actionClass =
    "px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

  return (
    <div className="p-5 rounded-2xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0c0c14] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
          <Undo2 className="w-4 h-4 text-rose-500" /> Refunds & Returns
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setMode("line")}
            disabled={Boolean(blocked)}
            title={blocked}
            className={`${actionClass} border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10`}
          >
            <Undo2 className="w-3.5 h-3.5" /> Refund lines
          </button>
          <button
            onClick={() => setMode("return")}
            disabled={Boolean(blocked) || !returnOpen}
            title={blocked ?? (returnOpen ? undefined : "Only a shipped Order inside its 30-day Return window")}
            className={`${actionClass} border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5`}
          >
            <PackageOpen className="w-3.5 h-3.5" /> Record Return
          </button>
          <button
            onClick={() => setMode("goodwill")}
            disabled={Boolean(blocked)}
            title={blocked}
            className={`${actionClass} border-zinc-300 dark:border-white/15 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/5`}
          >
            <Gift className="w-3.5 h-3.5" /> Goodwill
          </button>
        </div>
      </div>

      {blocked && <p className="text-[11px] text-zinc-500">{blocked}</p>}

      {ledger.length === 0 ? (
        <p className="text-xs text-zinc-500">No refunds recorded for this order.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-white/10">
          {ledger.map((row) => (
            <li key={row._id} className="py-2.5 flex flex-wrap items-start justify-between gap-2 text-xs">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-white">{REFUND_KIND_LABELS[row.kind]}</span>
                  <span className={`px-1.5 py-0.5 rounded-md border text-[10px] font-bold uppercase ${STATUS_TONES[row.status]}`}>
                    {REFUND_STATUS_LABELS[row.status]}
                  </span>
                </div>
                <div className="text-zinc-500">
                  {row.lines.map((line) => `${line.quantity}× ${order.items[line.lineIndex]?.name ?? "line"}${line.restock ? " (restock)" : ""}`).join(", ")}
                  {row.shippingCents > 0 && `${row.lines.length > 0 ? ", " : ""}shipping`}
                  {row.reason && ` — ${row.reason}`}
                </div>
                {row.error && <div className="text-rose-500">{row.error}</div>}
                <div className="text-[10px] text-zinc-400 font-mono">
                  {new Date(row.createdAt).toLocaleString()}
                  {row.stripeRefundId && ` · ${row.stripeRefundId}`}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-zinc-900 dark:text-white">{formatCents(row.amountCents)}</span>
                {row.status === "pending" && (
                  <button
                    onClick={() => retry(row._id)}
                    disabled={retrying !== null}
                    className={`${actionClass} border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10`}
                  >
                    {retrying === row._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    Retry
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <RefundDialog order={order} ledger={ledger} mode={mode} onClose={() => setMode(null)} onDone={onMessage} />
    </div>
  );
}

export default OrderRefundsPanel;
