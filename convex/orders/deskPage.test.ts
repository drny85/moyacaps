import { describe, expect, it } from "vitest";
import { inDateWindow, pageOf, sortOrders } from "./deskPage";

const o = (id: string, createdAt: number, total: number) => ({ id, createdAt, total });
const ids = (rows: Array<{ id: string }>) => rows.map((r) => r.id);

describe("sortOrders", () => {
  const orders = [o("a", 1, 50), o("b", 3, 20), o("c", 2, 50)];

  it("sorts by placed date either way", () => {
    expect(ids(sortOrders(orders, "placed_desc"))).toEqual(["b", "c", "a"]);
    expect(ids(sortOrders(orders, "placed_asc"))).toEqual(["a", "c", "b"]);
  });

  it("sorts by total, newest first among equal totals", () => {
    expect(ids(sortOrders(orders, "total_desc"))).toEqual(["c", "a", "b"]);
    expect(ids(sortOrders(orders, "total_asc"))).toEqual(["b", "c", "a"]);
  });

  it("leaves the input alone", () => {
    sortOrders(orders, "total_asc");
    expect(ids(orders)).toEqual(["a", "b", "c"]);
  });
});

describe("pageOf", () => {
  const items = Array.from({ length: 120 }, (_, i) => i);

  it("returns one page with the total and page count", () => {
    expect(pageOf(items, 1)).toMatchObject({ total: 120, page: 1, pageCount: 3 });
    expect(pageOf(items, 3).rows).toEqual(items.slice(100));
  });

  it("clamps a page past either end", () => {
    expect(pageOf(items, 9).page).toBe(3);
    expect(pageOf(items, 0).page).toBe(1);
    expect(pageOf(items, Number.NaN).page).toBe(1);
  });

  it("an empty list is one empty page", () => {
    expect(pageOf([], 4)).toEqual({ rows: [], total: 0, page: 1, pageCount: 1 });
  });
});

describe("inDateWindow", () => {
  it("includes since, excludes until, and treats a missing bound as open", () => {
    expect(inDateWindow(10, 10, 20)).toBe(true);
    expect(inDateWindow(20, 10, 20)).toBe(false);
    expect(inDateWindow(5, 10)).toBe(false);
    expect(inDateWindow(5, undefined, 20)).toBe(true);
    expect(inDateWindow(5)).toBe(true);
  });
});
