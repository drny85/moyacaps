"use client";

/**
 * Record a Handoff (ADR 0030) for one order or several: picked up or dropped off, when, and an
 * optional note. Used by the order page, the Ready to ship queue and the Pickup card.
 */
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { Loader2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { HandoffMethod } from "@convex/orders/labels";
import { AdminModal } from "@/components/admin/AdminModal";
import { inputClass, primaryBtn } from "./detail/Section";
import { fromLocalInput, summarizeHandoff, toLocalInput } from "@/lib/admin/handoffForm";

export type HandoffTarget = { id: string; orderNumber: string; customer?: string };

export function HandoffDialog({ open, orders, initial, onClose, onDone }: {
  open: boolean;
  orders: HandoffTarget[];
  /** Prefills the form: an existing Handoff to correct, or "picked up" from the Pickup card. */
  initial?: { method?: HandoffMethod; at?: number; note?: string };
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const t = useTranslations("admin.orders.handoff");
  const titleId = useId();
  const record = useMutation(api.orders.handoffs.recordHandoff);
  const [method, setMethod] = useState<HandoffMethod>("dropped_off");
  const [at, setAt] = useState("");
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset only when the dialog opens, never on a parent re-render.
  useEffect(() => {
    if (!open) return;
    setMethod(initial?.method ?? "dropped_off");
    setAt(toLocalInput(initial?.at ?? Date.now()));
    setNote(initial?.note ?? "");
    setSelected(new Set(orders.map((o) => o.id)));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const bulk = orders.length > 1;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    const ms = fromLocalInput(at);
    if (Number.isNaN(ms)) return setError(t("badTime"));
    if (selected.size === 0) return setError(t("noneSelected"));
    setBusy(true);
    setError(null);
    try {
      const { results } = await record({
        orderIds: [...selected] as Id<"orders">[],
        method,
        at: ms,
        ...(note.trim() && { note: note.trim() }),
      });
      const { marked, failures } = summarizeHandoff(results);
      if (failures.length > 0) {
        setError(failures.join(" "));
        if (marked > 0) onDone(t("marked", { count: marked }));
        return;
      }
      onDone(t("marked", { count: marked }));
      onClose();
    } catch (err) {
      if (!(err instanceof ConvexError)) console.error("Handoff failed", err);
      setError(err instanceof ConvexError && typeof err.data === "string" ? err.data : t("failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminModal isOpen={open} onClose={onClose} isProcessing={busy} labelledBy={titleId} maxWidthClass="max-w-md">
      <h2 id={titleId} className="font-display font-bold text-base text-zinc-950 dark:text-white">
        {t("title", { count: orders.length })}
      </h2>
      <p className="text-xs text-zinc-600 dark:text-zinc-400">{t("help")}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="space-y-3"
      >
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="sr-only">{t("method")}</legend>
          {(["dropped_off", "picked_up"] as const).map((m) => (
            <label
              key={m}
              className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                method === m
                  ? "border-zinc-900 dark:border-white bg-zinc-900/5 dark:bg-white/10 text-zinc-950 dark:text-white"
                  : "border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-400"
              }`}
            >
              <input type="radio" name="handoff-method" value={m} checked={method === m} onChange={() => setMethod(m)} />
              {t(`methods.${m}`)}
            </label>
          ))}
        </fieldset>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {t("when")}
          <input type="datetime-local" value={at} max={toLocalInput(Date.now())} onChange={(e) => setAt(e.target.value)} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
          {t("note")}
          <input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t("notePlaceholder")} className={`${inputClass} mt-1`} />
        </label>
        {bulk && (
          <ul className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-zinc-200 dark:border-white/10 p-2">
            {orders.map((o) => (
              <li key={o.id}>
                <label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                  <span className="font-mono font-semibold text-zinc-900 dark:text-white">{o.orderNumber}</span>
                  {o.customer && <span className="truncate text-zinc-500">{o.customer}</span>}
                </label>
              </li>
            ))}
          </ul>
        )}
        {error && <p role="alert" className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={busy} className="px-3.5 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.06]">
            {t("cancel")}
          </button>
          <button type="submit" disabled={busy || selected.size === 0} className={primaryBtn}>
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} {t("save", { count: selected.size })}
          </button>
        </div>
      </form>
    </AdminModal>
  );
}
