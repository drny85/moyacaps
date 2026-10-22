/**
 * Sorting and paging for the Orders desk table (plan 0013). The desk query reads the queue and
 * date range (at most DESK_WINDOW Orders), sorts them here and returns one page. Pure; covered
 * by deskPage.test.ts.
 */
import { v } from "convex/values";

export const DESK_SORTS = ["placed_desc", "placed_asc", "total_desc", "total_asc"] as const;
export type DeskSort = (typeof DESK_SORTS)[number];
export const DEFAULT_DESK_SORT: DeskSort = "placed_desc";
export const deskSortValidator = v.union(...DESK_SORTS.map((s) => v.literal(s)));

/** Rows per page. */
export const ORDERS_PAGE_SIZE = 50;
/** Most Orders one desk read sorts; past it the desk says to narrow the dates. */
export const DESK_WINDOW = 2000;

type Sortable = { createdAt: number; total: number };

/** Created at or after `since` and before `until`; an absent bound is open. */
export function inDateWindow(createdAt: number, since?: number, until?: number): boolean {
  return (since === undefined || createdAt >= since) && (until === undefined || createdAt < until);
}

/** A sorted copy. Equal totals fall back to newest first, so the order never jitters. */
export function sortOrders<T extends Sortable>(orders: T[], sort: DeskSort): T[] {
  const newest = (a: T, b: T) => b.createdAt - a.createdAt;
  const compare: Record<DeskSort, (a: T, b: T) => number> = {
    placed_desc: newest,
    placed_asc: (a, b) => a.createdAt - b.createdAt,
    total_desc: (a, b) => b.total - a.total || newest(a, b),
    total_asc: (a, b) => a.total - b.total || newest(a, b),
  };
  return [...orders].sort(compare[sort]);
}

export type DeskPage<T> = { rows: T[]; total: number; page: number; pageCount: number };

/** One 1-based page. A page past the end shows the last one, so a shrinking queue never lands on nothing. */
export function pageOf<T>(items: T[], page: number, size = ORDERS_PAGE_SIZE): DeskPage<T> {
  const pageCount = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  return { rows: items.slice((current - 1) * size, current * size), total: items.length, page: current, pageCount };
}
