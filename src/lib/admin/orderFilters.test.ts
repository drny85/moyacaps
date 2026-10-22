import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORDER_FILTERS,
  dateWindow,
  filtersFromSearchParams,
  filtersToSearchParams,
  hasActiveFilters,
  isHistoryQueue,
  legacyOrderParamHref,
  nextFilters,
  pageBounds,
  rangeApplies,
  sinceFor,
  sortDirection,
  toggleSort,
  type OrderFilters,
} from "./orderFilters";

const DAY = 24 * 60 * 60 * 1000;
const sp = (s: string) => new URLSearchParams(s);
const f = (patch: Partial<OrderFilters>): OrderFilters => ({ ...DEFAULT_ORDER_FILTERS, ...patch });

describe("order filters in the URL", () => {
  it("round-trips every field through the URL", () => {
    const filters = f({ queue: "done", range: "custom", q: "ana", sort: "total_desc", page: 3, from: "2026-10-01", to: "2026-10-22" });
    const qs = "queue=done&range=custom&from=2026-10-01&to=2026-10-22&q=ana&sort=total_desc&page=3";
    expect(filtersToSearchParams(filters).toString()).toBe(qs);
    expect(filtersFromSearchParams(sp(qs))).toEqual(filters);
  });

  it("omits defaults, and custom days outside the custom range", () => {
    expect(filtersToSearchParams(DEFAULT_ORDER_FILTERS).toString()).toBe("");
    expect(filtersFromSearchParams(sp(""))).toEqual(DEFAULT_ORDER_FILTERS);
    expect(filtersToSearchParams(f({ range: "7d", from: "2026-10-01" })).toString()).toBe("range=7d");
  });

  it("falls back on junk", () => {
    expect(filtersFromSearchParams(sp("queue=junk&range=junk&q=x&sort=name&page=-2&from=yesterday"))).toEqual(f({ q: "x" }));
    expect(filtersFromSearchParams(sp("page=2.5")).page).toBe(1);
  });

  it("hasActiveFilters ignores sort and page", () => {
    expect(hasActiveFilters(DEFAULT_ORDER_FILTERS)).toBe(false);
    expect(hasActiveFilters(f({ sort: "total_asc", page: 4 }))).toBe(false);
    expect(hasActiveFilters(f({ q: "a" }))).toBe(true);
    expect(hasActiveFilters(f({ queue: "done" }))).toBe(true);
    expect(hasActiveFilters(f({ range: "all" }))).toBe(true);
  });
});

describe("nextFilters", () => {
  it("any change but the page goes back to page 1", () => {
    const onPage3 = f({ page: 3 });
    expect(nextFilters(onPage3, { sort: "total_desc" })).toEqual(f({ sort: "total_desc" }));
    expect(nextFilters(onPage3, { queue: "done" }).page).toBe(1);
    expect(nextFilters(onPage3, { page: 4 }).page).toBe(4);
  });
});

describe("sinceFor", () => {
  it("today is local midnight", () => {
    // 03:00 UTC Oct 17 is 23:00 Oct 16 in New York (UTC-4): today started at 04:00 UTC Oct 16.
    expect(sinceFor("today", Date.UTC(2026, 9, 17, 3), 240)).toBe(Date.UTC(2026, 9, 16, 4));
  });

  it("7d and 30d are plain offsets, all and custom are open", () => {
    const now = Date.UTC(2026, 9, 17, 12);
    expect(sinceFor("7d", now, 0)).toBe(now - 7 * DAY);
    expect(sinceFor("30d", now, 0)).toBe(now - 30 * DAY);
    expect(sinceFor("all", now, 0)).toBeUndefined();
    expect(sinceFor("custom", now, 0)).toBeUndefined();
  });
});

describe("Working and History Queues", () => {
  const now = Date.UTC(2026, 9, 17, 12);

  it("only History Queues take a range", () => {
    for (const queue of ["needs_packing", "overdue", "ready_to_ship", "awaiting_payment", "problems"] as const) {
      expect(isHistoryQueue(queue)).toBe(false);
      expect(rangeApplies(f({ queue, range: "7d" }))).toBe(false);
    }
    for (const queue of ["shipped", "done", "all"] as const) expect(rangeApplies(f({ queue, range: "7d" }))).toBe(true);
  });

  it("a search looks through all time", () => {
    expect(rangeApplies(f({ range: "7d", q: "GL-1" }))).toBe(false);
    expect(dateWindow(f({ range: "7d", q: "GL-1" }), now, 0)).toEqual({});
  });

  it("dateWindow honours the rule for presets", () => {
    expect(dateWindow(f({ queue: "overdue", range: "7d" }), now, 0)).toEqual({});
    expect(dateWindow(f({ queue: "done", range: "7d" }), now, 0)).toEqual({ since: now - 7 * DAY });
    expect(dateWindow(f({ range: "all" }), now, 0)).toEqual({});
  });

  it("a custom range covers whole local days, either way round", () => {
    // New York (UTC-4): Oct 1 starts 04:00 UTC; Oct 22 ends at 04:00 UTC Oct 23.
    const window = { since: Date.UTC(2026, 9, 1, 4), until: Date.UTC(2026, 9, 23, 4) };
    expect(dateWindow(f({ range: "custom", from: "2026-10-01", to: "2026-10-22" }), now, 240)).toEqual(window);
    expect(dateWindow(f({ range: "custom", from: "2026-10-22", to: "2026-10-01" }), now, 240)).toEqual(window);
  });

  it("a missing custom day leaves that side open", () => {
    expect(dateWindow(f({ range: "custom", from: "2026-10-01" }), now, 0)).toEqual({ since: Date.UTC(2026, 9, 1) });
    expect(dateWindow(f({ range: "custom", to: "2026-10-01" }), now, 0)).toEqual({ until: Date.UTC(2026, 9, 2) });
    expect(dateWindow(f({ range: "custom" }), now, 0)).toEqual({});
  });
});

describe("sorting from the table headers", () => {
  it("reports the active column's direction", () => {
    expect(sortDirection("placed_desc", "placed")).toBe("desc");
    expect(sortDirection("placed_desc", "total")).toBeNull();
    expect(sortDirection("total_asc", "total")).toBe("asc");
  });

  it("a new column starts descending; the active one flips", () => {
    expect(toggleSort("placed_desc", "total")).toBe("total_desc");
    expect(toggleSort("total_desc", "total")).toBe("total_asc");
    expect(toggleSort("total_asc", "total")).toBe("total_desc");
    expect(toggleSort("placed_desc", "placed")).toBe("placed_asc");
  });
});

describe("pageBounds", () => {
  it("labels a page", () => {
    expect(pageBounds(1, 50, 312)).toEqual({ first: 1, last: 50 });
    expect(pageBounds(7, 50, 312)).toEqual({ first: 301, last: 312 });
    expect(pageBounds(1, 50, 0)).toEqual({ first: 0, last: 0 });
  });
});

describe("legacyOrderParamHref", () => {
  it("sends old ?order= bookmarks to the detail page", () => {
    expect(legacyOrderParamHref(sp("order=GL-1042"))).toBe("/admin/orders/GL-1042");
    expect(legacyOrderParamHref(sp("order=%231042"))).toBe("/admin/orders/GL-1042");
    expect(legacyOrderParamHref(sp("order=mc-7"))).toBe("/admin/orders/MC-7");
    expect(legacyOrderParamHref(sp("order=%20"))).toBeNull();
    expect(legacyOrderParamHref(sp("queue=all"))).toBeNull();
  });
});
