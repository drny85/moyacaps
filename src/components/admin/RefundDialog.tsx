"use client";

/**
 * Admin refund dialog (plan 0008 "Money back"): refund chosen lines (optionally shipping),
 * record a Return, or give a Goodwill Refund. Restock is a per-line checkbox. Submitting goes
 * through a High-Friction Confirmation Safeguard step that states the amount and every unit
 * going back to stock. The preview runs the same planner the server runs.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import {
  customerPaysReturnShipping,
  formatCents,
  planGoodwillRefund,
  planLineRefund,
  planReturn,
  refundedQuantities,
  restockBlock,
  returnWindowClosesAt,
  RETURN_REASONS,
  type ReturnReason,
} from "@convex/payments/refundModel";
import { AdminModal } from "./AdminModal";
import {
  buildRefundRequest,
  emptyDraft,
  restockSummary,
  RETURN_REASON_LABELS,
  type RefundDraft,
  type RefundMode,
} from "@/lib/refundForm";
import { AlertTriangle, Loader2, PackagePlus, Undo2 } from "lucide-react";

const TITLES: Record<RefundMode, string> = {
  line: "Refund lines",
  return: "Record a Return",
  goodwill: "Goodwill Refund",
};

interface RefundDialogProps {
  order: Doc<"orders">;
  ledger: Doc<"order_refunds">[];
  mode: RefundMode | null;
  onClose: () => void;
  onDone: (message: string) => void;
}

const newRequestId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

export function RefundDialog({ order, ledger, mode, onClose, onDone }: RefundDialogProps) {
  const refundOrder = useAction(api.payments.refunds.refundOrder);
  const [draft, setDraft] = useState<RefundDraft>(() => emptyDraft(order.items.length));
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [requestId, setRequestId] = useState(newRequestId);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A fresh form and request id each time the dialog opens: a double click inside one
  // submission reuses the id, so it refunds once.
  useEffect(() => {
    if (!mode) return;
    setDraft(emptyDraft(order.items.length));
    setStep("edit");
    setRequestId(newRequestId());
    setError(null);
  }, [mode, order.items.length]);

  const refunded = useMemo(() => refundedQuantities(order, ledger), [order, ledger]);
  const preview = useMemo(() => {
    if (!mode) return null;
    const request = buildRefundRequest(mode, draft);
    switch (request.kind) {
      case "line":
        return planLineRefund(order, ledger, request);
      case "return":
        return planReturn(order, ledger, request, Date.now());
      case "goodwill":
        return planGoodwillRefund(order, ledger, request);
    }
  }, [mode, draft, order, ledger]);

  if (!mode) return null;

  const noRestock = mode === "goodwill" ? "A Goodwill Refund never restocks." : restockBlock(order);
  const restockLines = restockSummary(draft, order.items.map((item) => item.name));
  const closesAt = mode === "return" ? returnWindowClosesAt(order) : undefined;

  const setLine = (index: number, patch: Partial<RefundDraft["lines"][number]>) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((line, i) => (i === index ? { ...line, ...patch } : line)) }));

  const submit = async () => {
    if (!preview?.ok) return;
    setIsProcessing(true);
    setError(null);
    try {
      const outcome = await refundOrder({
        orderId: order._id,
        requestId,
        request: buildRefundRequest(mode, draft),
        ...(mode !== "goodwill" && draft.note.trim() && { note: draft.note.trim() }),
      });
      if (outcome.status === "issued") {
        onDone(`${TITLES[mode]}: ${formatCents(outcome.amountCents)} refunded through Stripe.`);
        onClose();
      } else if (outcome.status === "pending") {
        setError(`Stripe did not answer (${outcome.error}). The refund is pending: retry it from the refunds panel.`);
      } else {
        setError(`Stripe refused the refund: ${outcome.error}`);
      }
    } catch (err: any) {
      setError(err?.data ?? err?.message ?? "Refund failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AdminModal isOpen onClose={onClose} isProcessing={isProcessing} labelledBy="refund-dialog-title" maxWidthClass="max-w-xl">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 flex items-center justify-center shrink-0">
          <Undo2 className="w-5 h-5" />
        </div>
        <div>
          <h3 id="refund-dialog-title" className="font-display font-bold text-lg text-zinc-900 dark:text-white">
            {step === "confirm" ? `Confirm: ${TITLES[mode]}` : TITLES[mode]}
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Order #{order.orderNumber} · paid {formatCents(Math.round(order.total * 100))}
          </p>
        </div>
      </div>

      {step === "edit" && (
        <div className="space-y-4 text-xs">
          {mode !== "goodwill" && (
            <table className="w-full">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="text-left font-semibold pb-2">Line</th>
                  <th className="text-right font-semibold pb-2">Refund qty</th>
                  <th className="text-right font-semibold pb-2">Restock</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, index) => {
                  const left = item.quantity - refunded[index];
                  const line = draft.lines[index];
                  return (
                    <tr key={index} className="border-t border-zinc-200 dark:border-white/10">
                      <td className="py-2 pr-2 text-zinc-800 dark:text-zinc-200">
                        {item.name}
                        {item.size ? ` · ${item.size}` : ""}
                        <span className="block text-[10px] text-zinc-500">
                          ${item.price.toFixed(2)} × {item.quantity} · {left} left to refund
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        <input
                          type="number"
                          min={0}
                          max={left}
                          step={1}
                          disabled={left === 0}
                          value={line?.quantity ?? 0}
                          onChange={(e) => setLine(index, { quantity: Math.max(0, Math.min(left, Math.floor(Number(e.target.value) || 0))) })}
                          className="w-16 px-2 py-1 rounded-lg border border-zinc-200 dark:border-white/10 bg-white dark:bg-black/30 text-right font-mono"
                          aria-label={`Units of ${item.name} to refund`}
                        />
                      </td>
                      <td className="py-2 text-right">
                        <input
                          type="checkbox"
                          disabled={Boolean(noRestock) || !line?.quantity || (mode === "return" && draft.returnReason === "defective")}
                          checked={Boolean(line?.restock)}
                          onChange={(e) => setLine(index, { restock: e.target.checked })}
                          aria-label={`Restock ${item.name}`}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {mode === "line" && (order.shippingFee ?? 0) > 0 && (
            <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
              <input
                type="checkbox"
                checked={draft.includeShipping}
                onChange={(e) => setDraft((d) => ({ ...d, includeShipping: e.target.checked }))}
              />
              Also refund shipping (${(order.shippingFee ?? 0).toFixed(2)} plus its tax)
            </label>
          )}

          {mode === "return" && (
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Why it came back</span>
                <select
                  value={draft.returnReason}
                  onChange={(e) => {
                    const returnReason = e.target.value as ReturnReason;
                    setDraft((d) => ({
                      ...d,
                      returnReason,
                      // A defective item is unsellable: never restocked.
                      lines: returnReason === "defective" ? d.lines.map((l) => ({ ...l, restock: false })) : d.lines,
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-black/30"
                >
                  {RETURN_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {RETURN_REASON_LABELS[reason]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={draft.unwornWithTags}
                  onChange={(e) => setDraft((d) => ({ ...d, unwornWithTags: e.target.checked }))}
                />
                I inspected the items: unworn, tags on
              </label>
              <p className="text-[11px] text-zinc-500">
                {customerPaysReturnShipping(draft.returnReason)
                  ? "The Customer pays return shipping."
                  : "We pay return shipping: send the Customer a prepaid label."}{" "}
                The original shipping fee is not refunded.
                {closesAt !== undefined && ` Return window closes ${new Date(closesAt).toLocaleDateString()}.`}
              </p>
            </div>
          )}

          {mode === "goodwill" && (
            <label className="block space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Amount (USD)</span>
              <input
                type="number"
                min={0.01}
                step={0.01}
                value={draft.goodwillDollars}
                onChange={(e) => setDraft((d) => ({ ...d, goodwillDollars: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-black/30 font-mono"
              />
            </label>
          )}

          <label className="block space-y-1">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
              {mode === "goodwill" ? "Reason (required)" : "Note (optional)"}
            </span>
            <input
              type="text"
              value={draft.note}
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-black/30"
            />
          </label>

          {noRestock && mode !== "goodwill" && <p className="text-[11px] text-zinc-500">{noRestock}</p>}

          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 flex items-center justify-between">
            <span className="text-zinc-500">Refund amount</span>
            <span className="font-mono font-bold text-base text-zinc-900 dark:text-white">
              {preview?.ok ? formatCents(preview.plan.amountCents) : "—"}
            </span>
          </div>
          {preview && !preview.ok && <p className="text-[11px] text-rose-500">{preview.error}</p>}
        </div>
      )}

      {step === "confirm" && preview?.ok && (
        <div className="space-y-3 text-xs">
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <strong>{formatCents(preview.plan.amountCents)}</strong> goes back to the Customer's card through Stripe. This
              cannot be undone.
            </div>
          </div>
          {restockLines.length > 0 ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 flex gap-2">
              <PackagePlus className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                Restock once Stripe accepts the refund: <strong>{restockLines.join(", ")}</strong>.
              </div>
            </div>
          ) : (
            <p className="text-zinc-500">No units go back to stock.</p>
          )}
        </div>
      )}

      {error && <p className="text-xs text-rose-500">{error}</p>}

      <div className="flex justify-end gap-2 pt-2">
        <button
          onClick={step === "confirm" ? () => setStep("edit") : onClose}
          disabled={isProcessing}
          className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300"
        >
          {step === "confirm" ? "Back" : "Cancel"}
        </button>
        {step === "edit" ? (
          <button
            onClick={() => setStep("confirm")}
            disabled={!preview?.ok}
            className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold disabled:opacity-40"
          >
            Review refund
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-2 disabled:opacity-60"
          >
            {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Refund {preview?.ok ? formatCents(preview.plan.amountCents) : ""}
          </button>
        )}
      </div>
    </AdminModal>
  );
}

export default RefundDialog;
