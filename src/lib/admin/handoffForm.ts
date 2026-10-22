/**
 * The Handoff dialog's form rules (ADR 0030): the time field is the Administrator's local clock,
 * and a bulk Handoff reports which orders it could not mark. Pure; covered by handoffForm.test.ts.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** A `datetime-local` value (YYYY-MM-DDTHH:MM) for `ms` in local time. */
export function toLocalInput(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Epoch ms of a `datetime-local` value, or NaN when malformed. */
export function fromLocalInput(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return NaN;
  return new Date(`${value}:00`).getTime();
}

export type HandoffResult = { orderNumber: string; ok: boolean; error?: string };

/** How many orders were marked, and a line per one that was refused. */
export function summarizeHandoff(results: HandoffResult[]): { marked: number; failures: string[] } {
  return {
    marked: results.filter((r) => r.ok).length,
    failures: results.filter((r) => !r.ok).map((r) => `${r.orderNumber || "?"}: ${r.error ?? "not marked"}`),
  };
}
