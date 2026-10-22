/**
 * Packing Checklist rules (CONTEXT.md "Packing Checklist", "Checked"; plan 0012): the units an
 * Order still has to ship, ticked off one at a time while it can get a label. Units already
 * refunded are not on it. Pure; covered by packing.test.ts.
 */
import type { Doc } from "../_generated/dataModel";
import { labelHistory, type LabelSource } from "./labels";
import { labelAction, type StatusSource } from "./status";

export type PackingChecklist = NonNullable<Doc<"orders">["packingChecklist"]>;

export type PackingOrder = StatusSource &
  LabelSource & {
    items: { quantity: number }[];
    packingChecklist?: PackingChecklist;
  };

/** One line: units still to ship, units Checked, and Checked units since refunded (to take out of the box). */
export type PackingLineView = { remaining: number; checked: number; overflow: number };

export type PackingView = {
  editable: boolean;
  lines: PackingLineView[];
  checkedUnits: number;
  totalUnits: number;
  uncheckedUnits: number;
  complete: boolean;
};

/** The checklist can be ticked only while the Order can get a label (a first one, or a Reship). */
function isOpen(order: PackingOrder): boolean {
  return labelAction(order).action !== null;
}

/**
 * The stored checklist that applies: while open, only the one for the next label (a Reship
 * starts fresh); once closed, the last one kept as a record.
 */
function applicableChecklist(order: PackingOrder): PackingChecklist | undefined {
  const stored = order.packingChecklist;
  if (!stored) return undefined;
  if (isOpen(order) && stored.forLabel !== labelHistory(order).length) return undefined;
  return stored;
}

/** The Order's Packing Checklist, given the units refunded per line (`refundedQuantities`). */
export function packingView(order: PackingOrder, refunded: number[]): PackingView {
  const checked = applicableChecklist(order)?.checked ?? [];
  const lines = order.items.map((item, i) => {
    const remaining = Math.max(0, item.quantity - (refunded[i] ?? 0));
    const ticked = checked[i] ?? 0;
    return { remaining, checked: ticked, overflow: Math.max(0, ticked - remaining) };
  });
  const sum = (pick: (l: PackingLineView) => number) => lines.reduce((total, l) => total + pick(l), 0);
  const totalUnits = sum((l) => l.remaining);
  const uncheckedUnits = sum((l) => Math.max(0, l.remaining - l.checked));
  const checkedUnits = sum((l) => Math.min(l.checked, l.remaining));
  const complete = totalUnits > 0 && uncheckedUnits === 0 && sum((l) => l.overflow) === 0;
  return { editable: isOpen(order), lines, checkedUnits, totalUnits, uncheckedUnits, complete };
}

export type CheckPlan = { ok: true; checklist: PackingChecklist; completed: boolean } | { ok: false; error: string };

/**
 * Checks (`delta` 1) or un-checks (`delta` -1) one unit of a line. Only while the Order can get
 * a label. `completed` is true the first time this checklist has every unit Checked, so the
 * completion is logged once.
 */
export function planCheck(order: PackingOrder, refunded: number[], lineIndex: number, delta: 1 | -1, now: number): CheckPlan {
  if (!isOpen(order)) return { ok: false, error: "The Packing Checklist is locked: this order cannot get a label now." };
  if (!Number.isInteger(lineIndex) || lineIndex < 0 || lineIndex >= order.items.length) {
    return { ok: false, error: "This order has no such line." };
  }
  const line = packingView(order, refunded).lines[lineIndex];
  if (delta === 1 && line.checked >= line.remaining) {
    return { ok: false, error: "Every unit of this line is already Checked." };
  }
  if (delta === -1 && line.checked === 0) return { ok: false, error: "No unit of this line is Checked." };

  const current = applicableChecklist(order);
  const checked = order.items.map((_, i) => current?.checked[i] ?? 0);
  checked[lineIndex] += delta;
  const next: PackingChecklist = {
    forLabel: labelHistory(order).length,
    checked,
    ...(current?.completedAt !== undefined && { completedAt: current.completedAt }),
  };
  const completed = next.completedAt === undefined && packingView({ ...order, packingChecklist: next }, refunded).complete;
  return { ok: true, checklist: completed ? { ...next, completedAt: now } : next, completed };
}
