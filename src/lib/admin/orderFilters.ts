/** Orders desk filters (plan 0009 D11, D17): queue, range and search, kept in the URL. */

export const QUEUES = ["needs_packing", "overdue", "awaiting_payment", "shipped", "problems", "done", "all"] as const;
export type Queue = (typeof QUEUES)[number];

export const RANGES = ["today", "7d", "30d", "all"] as const;
export type Range = (typeof RANGES)[number];

export type OrderFilters = { queue: Queue; range: Range; q: string };

export const DEFAULT_ORDER_FILTERS: OrderFilters = { queue: "all", range: "30d", q: "" };

/** Rows the desk query returns at most; "All" shows a note at this size instead of paginating. */
export const ORDERS_LIMIT = 250;

const DAY_MS = 24 * 60 * 60 * 1000;

function oneOf<T extends string>(values: readonly T[], raw: string | null): T | undefined {
  return raw !== null && (values as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

/** Junk or missing values fall back to the defaults; `q` is kept as typed. */
export function filtersFromSearchParams(sp: URLSearchParams): OrderFilters {
  return {
    queue: oneOf(QUEUES, sp.get("queue")) ?? DEFAULT_ORDER_FILTERS.queue,
    range: oneOf(RANGES, sp.get("range")) ?? DEFAULT_ORDER_FILTERS.range,
    q: sp.get("q") ?? "",
  };
}

/** Defaults are omitted so the plain `/admin/orders` URL stays plain. */
export function filtersToSearchParams(f: OrderFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.queue !== DEFAULT_ORDER_FILTERS.queue) sp.set("queue", f.queue);
  if (f.range !== DEFAULT_ORDER_FILTERS.range) sp.set("range", f.range);
  if (f.q !== "") sp.set("q", f.q);
  return sp;
}

export function hasActiveFilters(f: OrderFilters): boolean {
  return f.queue !== DEFAULT_ORDER_FILTERS.queue || f.range !== DEFAULT_ORDER_FILTERS.range || f.q !== "";
}

/**
 * The earliest `createdAt` a range admits, or undefined for all time. "today" starts at the
 * Administrator's local midnight (`tzOffsetMinutes` as `Date#getTimezoneOffset`).
 */
export function sinceFor(range: Range, now: number, tzOffsetMinutes: number): number | undefined {
  switch (range) {
    case "today": {
      const shift = tzOffsetMinutes * 60_000;
      const local = now - shift;
      return local - (local % DAY_MS) + shift;
    }
    case "7d":
      return now - 7 * DAY_MS;
    case "30d":
      return now - 30 * DAY_MS;
    case "all":
      return undefined;
  }
}

/** Queues of finished work, where a date range makes sense. Working queues and searches look through all time. */
const RANGED_QUEUES: readonly Queue[] = ["shipped", "done", "all"];

export function rangeApplies(f: OrderFilters): boolean {
  return f.q === "" && RANGED_QUEUES.includes(f.queue);
}

/** The `since` bound to send: the range's, or none when the range does not apply. */
export function effectiveSince(f: OrderFilters, now: number, tzOffsetMinutes: number): number | undefined {
  return rangeApplies(f) ? sinceFor(f.range, now, tzOffsetMinutes) : undefined;
}

/** Where an old `?order=` bookmark goes now that the drawer is gone: the Order's own page. */
export function legacyOrderParamHref(sp: URLSearchParams): string | null {
  const raw = (sp.get("order") ?? "").trim().toUpperCase().replace(/^#/, "");
  if (raw === "") return null;
  const orderNumber = /^(GL|MC)-/.test(raw) ? raw : `GL-${raw}`;
  return `/admin/orders/${orderNumber}`;
}
