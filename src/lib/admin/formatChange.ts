/** Pure formatting for audit-history values; the History panel only renders the result. */

export interface FormatContext {
  locale: string;
  yes: string;
  no: string;
}

export interface HistoryChange {
  field: string;
  from: unknown;
  to: unknown;
}

const MAX_LENGTH = 60;
const EMPTY = "—";

function truncate(text: string): string {
  return text.length > MAX_LENGTH ? `${text.slice(0, MAX_LENGTH - 1)}…` : text;
}

export function formatValue(field: string, value: unknown, ctx: FormatContext): string {
  if (value === null || value === undefined) return EMPTY;
  if (typeof value === "boolean") return value ? ctx.yes : ctx.no;
  if (field === "dropDate" && typeof value === "number") {
    return new Date(value).toLocaleString(ctx.locale);
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return truncate(value);
  return truncate(JSON.stringify(value) ?? EMPTY);
}

export function formatChange(change: HistoryChange, ctx: FormatContext): string {
  return `${change.field}: ${formatValue(change.field, change.from, ctx)} → ${formatValue(change.field, change.to, ctx)}`;
}
