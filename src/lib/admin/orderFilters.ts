/** Orders desk filters (plan 0009 D11, D17; plan 0013): queue, range, search, sort and page, kept in the URL. */
import { DEFAULT_DESK_SORT, DESK_SORTS, type DeskSort } from "../../../convex/orders/deskPage";

export const QUEUES = ["needs_packing", "overdue", "ready_to_ship", "awaiting_payment", "shipped", "problems", "done", "all"] as const;
export type Queue = (typeof QUEUES)[number];

export const RANGES = ["today", "7d", "30d", "all", "custom"] as const;
export type Range = (typeof RANGES)[number];

/** `from` and `to` are local days (YYYY-MM-DD), both inclusive; used only when `range` is "custom". */
export type OrderFilters = { queue: Queue; range: Range; q: string; sort: DeskSort; page: number; from: string; to: string };

export const DEFAULT_ORDER_FILTERS: OrderFilters = { queue: "all", range: "30d", q: "", sort: DEFAULT_DESK_SORT, page: 1, from: "", to: "" };

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function oneOf<T extends string>(values: readonly T[], raw: string | null): T | undefined {
  return raw !== null && (values as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

const day = (raw: string | null) => (raw !== null && DAY_RE.test(raw) ? raw : "");

/** Junk or missing values fall back to the defaults; `q` is kept as typed. */
export function filtersFromSearchParams(sp: URLSearchParams): OrderFilters {
  const page = Number(sp.get("page"));
  return {
    queue: oneOf(QUEUES, sp.get("queue")) ?? DEFAULT_ORDER_FILTERS.queue,
    range: oneOf(RANGES, sp.get("range")) ?? DEFAULT_ORDER_FILTERS.range,
    q: sp.get("q") ?? "",
    sort: oneOf(DESK_SORTS, sp.get("sort")) ?? DEFAULT_ORDER_FILTERS.sort,
    page: Number.isInteger(page) && page > 1 ? page : 1,
    from: day(sp.get("from")),
    to: day(sp.get("to")),
  };
}

/** Defaults are omitted so the plain `/admin/orders` URL stays plain; custom days only with the custom range. */
export function filtersToSearchParams(f: OrderFilters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.queue !== DEFAULT_ORDER_FILTERS.queue) sp.set("queue", f.queue);
  if (f.range !== DEFAULT_ORDER_FILTERS.range) sp.set("range", f.range);
  if (f.range === "custom" && f.from) sp.set("from", f.from);
  if (f.range === "custom" && f.to) sp.set("to", f.to);
  if (f.q !== "") sp.set("q", f.q);
  if (f.sort !== DEFAULT_ORDER_FILTERS.sort) sp.set("sort", f.sort);
  if (f.page > 1) sp.set("page", String(f.page));
  return sp;
}

/** Applies a change. Anything but a page change goes back to page 1 (plan 0013 Q10). */
export function nextFilters(current: OrderFilters, patch: Partial<OrderFilters>): OrderFilters {
  return { ...current, ...patch, page: patch.page ?? 1 };
}

/** The filters narrow the list (sort and page only reorder or move through it). */
export function hasActiveFilters(f: OrderFilters): boolean {
  return f.queue !== DEFAULT_ORDER_FILTERS.queue || f.range !== DEFAULT_ORDER_FILTERS.range || f.q !== "";
}

/**
 * The earliest `createdAt` a preset range admits, or undefined for all time (and for "custom",
 * see dateWindow). "today" starts at the Administrator's local midnight (`tzOffsetMinutes` as
 * `Date#getTimezoneOffset`).
 */
export function sinceFor(range: Range, now: number, tzOffsetMinutes: number): number | undefined {
  switch (range) {
    case "today":
      return localMidnight(now, tzOffsetMinutes);
    case "7d":
      return now - 7 * DAY_MS;
    case "30d":
      return now - 30 * DAY_MS;
    case "all":
    case "custom":
      return undefined;
  }
}

function localMidnight(at: number, tzOffsetMinutes: number): number {
  const shift = tzOffsetMinutes * 60_000;
  const local = at - shift;
  return local - (local % DAY_MS) + shift;
}

/** Epoch ms of local midnight starting `yyyyMmDd`. */
function startOfLocalDay(yyyyMmDd: string, tzOffsetMinutes: number): number {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return Date.UTC(y, m - 1, d) + tzOffsetMinutes * 60_000;
}

/** History Queues (CONTEXT.md): finished work, narrowed by a date range. Working Queues show every Order. */
const HISTORY_QUEUES: readonly Queue[] = ["shipped", "done", "all"];

export const isHistoryQueue = (queue: Queue): boolean => HISTORY_QUEUES.includes(queue);

/** The range narrows the list: a History Queue and no search (a search looks through all time). */
export function rangeApplies(f: OrderFilters): boolean {
  return f.q === "" && isHistoryQueue(f.queue);
}

/**
 * The `createdAt` bounds to send: since is inclusive, until exclusive. Custom days cover whole
 * local days, either way round; a missing custom day leaves that side open.
 */
export function dateWindow(f: OrderFilters, now: number, tzOffsetMinutes: number): { since?: number; until?: number } {
  if (!rangeApplies(f)) return {};
  if (f.range !== "custom") {
    const since = sinceFor(f.range, now, tzOffsetMinutes);
    return since === undefined ? {} : { since };
  }
  const [first, last] = f.from && f.to && f.from > f.to ? [f.to, f.from] : [f.from, f.to];
  return {
    ...(first && { since: startOfLocalDay(first, tzOffsetMinutes) }),
    ...(last && { until: startOfLocalDay(last, tzOffsetMinutes) + DAY_MS }),
  };
}

/** The table's sortable columns (plan 0013 Q3). */
export type SortColumn = "placed" | "total";

/** Which way `column` is sorted, or null when the table is sorted by the other one. */
export function sortDirection(sort: DeskSort, column: SortColumn): "asc" | "desc" | null {
  const [col, dir] = sort.split("_") as [SortColumn, "asc" | "desc"];
  return col === column ? dir : null;
}

/** A header click: a new column starts descending (newest, highest); the active one flips. */
export function toggleSort(sort: DeskSort, column: SortColumn): DeskSort {
  return sortDirection(sort, column) === "desc" ? `${column}_asc` : `${column}_desc`;
}

/** "1–50" style bounds of a page, for the pager label. */
export function pageBounds(page: number, pageSize: number, total: number): { first: number; last: number } {
  if (total === 0) return { first: 0, last: 0 };
  return { first: (page - 1) * pageSize + 1, last: Math.min(page * pageSize, total) };
}

/** Where an old `?order=` bookmark goes now that the drawer is gone: the Order's own page. */
export function legacyOrderParamHref(sp: URLSearchParams): string | null {
  const raw = (sp.get("order") ?? "").trim().toUpperCase().replace(/^#/, "");
  if (raw === "") return null;
  const orderNumber = /^(GL|MC)-/.test(raw) ? raw : `GL-${raw}`;
  return `/admin/orders/${orderNumber}`;
}
