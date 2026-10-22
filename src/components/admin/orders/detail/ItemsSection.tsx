"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { AlertTriangle, Check, ChevronRight, Lock, Minus, Package } from "lucide-react";
import type { PackingView } from "@convex/orders/packing";
import type { PackingLine } from "@/lib/admin/orderDetail";
import { Section } from "./Section";

/**
 * The lines to pack (D13a) and their Packing Checklist (plan 0012): each line counts its units
 * Checked against the units still to ship. Tap the count to Check one, `−` to undo one; tap the
 * item to open its Packing sheet.
 */
export function ItemsSection({ items, itemCount, checklist, pendingLine, onOpen, onCheck }: {
  items: PackingLine[];
  itemCount: number;
  /** Undefined while loading. */
  checklist: PackingView | null | undefined;
  /** The line whose tick is being saved. */
  pendingLine: number | null;
  onOpen: (line: PackingLine) => void;
  onCheck: (lineIndex: number, delta: 1 | -1) => void;
}) {
  const t = useTranslations("admin.orderDetail.items");
  const progress = checklist && checklist.totalUnits > 0
    ? t("progress", { checked: checklist.checkedUnits, total: checklist.totalUnits })
    : t("units", { count: itemCount });
  return (
    <Section
      title={t("title")}
      icon={<Package className="w-4 h-4 text-moya-red" />}
      action={<span className={`text-[11px] font-mono ${checklist?.complete ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-zinc-500"}`}>{progress}</span>}
    >
      <ul className="divide-y divide-zinc-100 dark:divide-white/[0.04] -mx-2">
        {items.map((line, index) => {
          const state = checklist?.lines[index];
          const gone = state !== undefined && state.remaining === 0 && state.overflow === 0;
          const done = state !== undefined && state.remaining > 0 && state.checked >= state.remaining;
          return (
            <li key={line.key} className="flex items-center gap-2 px-2 py-3">
              <button type="button" onClick={() => onOpen(line)} className={`flex-1 min-w-0 flex items-center gap-3.5 text-left rounded-xl hover:bg-zinc-50 dark:hover:bg-white/[0.03] transition-colors ${gone ? "opacity-50" : ""}`}>
                <div className="relative w-16 h-20 rounded-xl overflow-hidden bg-zinc-100 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/10 shrink-0">
                  {line.image ? <Image src={line.image} alt="" fill sizes="64px" className="object-cover" /> : <Package className="w-6 h-6 m-auto text-zinc-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold text-sm text-zinc-900 dark:text-white truncate ${gone ? "line-through" : ""}`}>{line.name}</p>
                  {line.colorway && <p className="text-xs text-zinc-700 dark:text-zinc-300">{line.colorway}{line.size ? ` · ${line.size}` : ""}</p>}
                  <p className="text-[11px] font-mono text-zinc-500 mt-0.5">{line.slug}</p>
                  <p className="text-[11px] font-mono text-zinc-500">{line.lineLabel}{line.quantity > 1 ? ` · ${t("each", { price: line.unitLabel })}` : ""}</p>
                  {gone && <p className="text-[11px] font-semibold text-zinc-500">{t("refunded")}</p>}
                  {state && state.overflow > 0 && (
                    <p className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {t("takeOut", { count: state.overflow })}
                    </p>
                  )}
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />
              </button>
              {state && !gone ? (
                <CheckControl
                  checked={state.checked}
                  remaining={state.remaining}
                  done={done}
                  editable={checklist?.editable ?? false}
                  pending={pendingLine === index}
                  onCheck={(delta) => onCheck(index, delta)}
                />
              ) : !state ? (
                <span className="text-2xl font-display font-bold text-zinc-950 dark:text-white tabular-nums shrink-0">×{line.quantity}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="flex items-center gap-1.5 text-[11px] text-zinc-500">
        {checklist && !checklist.editable && <Lock className="w-3 h-3" />}
        {checklist && !checklist.editable ? t("locked") : t("tapHint")}
      </p>
    </Section>
  );
}

/** `checked/remaining` as one big tap target, with `−` to undo one. Read-only once locked. */
function CheckControl({ checked, remaining, done, editable, pending, onCheck }: {
  checked: number;
  remaining: number;
  done: boolean;
  editable: boolean;
  pending: boolean;
  onCheck: (delta: 1 | -1) => void;
}) {
  const t = useTranslations("admin.orderDetail.items");
  const count = (
    <>
      {done && <Check className="w-4 h-4" />}
      <span className="tabular-nums">{checked}/{remaining}</span>
    </>
  );
  const tone = done
    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/40"
    : "bg-amber-500/10 text-zinc-950 dark:text-white border-amber-500/30";
  if (!editable) {
    return <span className={`shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl border text-lg font-display font-bold ${tone}`}>{count}</span>;
  }
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      {checked > 0 && (
        <button type="button" onClick={() => onCheck(-1)} disabled={pending} aria-label={t("uncheckOne")} className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.06] disabled:opacity-50">
          <Minus className="w-4 h-4" />
        </button>
      )}
      <button
        type="button"
        onClick={() => onCheck(1)}
        disabled={pending || checked >= remaining}
        aria-label={t("checkOne")}
        className={`min-w-[4.5rem] inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl border text-lg font-display font-bold transition-colors disabled:cursor-default ${tone} ${pending ? "opacity-60" : ""}`}
      >
        {count}
      </button>
    </div>
  );
}
