import { describe, expect, it } from "vitest";
import {
  DEFAULT_ORDER_FILTERS,
  filtersFromSearchParams,
  filtersToSearchParams,
  hasActiveFilters,
  legacyOrderParamHref,
  sinceFor,
} from "./orderFilters";

const DAY = 24 * 60 * 60 * 1000;
const sp = (s: string) => new URLSearchParams(s);

describe("order filters in the URL", () => {
  it("round-trips every field through the URL", () => {
    const f = { queue: "overdue" as const, range: "7d" as const, q: "ana" };
    expect(filtersToSearchParams(f).toString()).toBe("queue=overdue&range=7d&q=ana");
    expect(filtersFromSearchParams(sp("queue=overdue&range=7d&q=ana"))).toEqual(f);
  });

  it("omits defaults", () => {
    expect(filtersToSearchParams(DEFAULT_ORDER_FILTERS).toString()).toBe("");
    expect(filtersFromSearchParams(sp(""))).toEqual(DEFAULT_ORDER_FILTERS);
  });

  it("falls back on junk", () => {
    expect(filtersFromSearchParams(sp("queue=junk&range=junk&q=x"))).toEqual({ ...DEFAULT_ORDER_FILTERS, q: "x" });
  });

  it("hasActiveFilters is false only at defaults", () => {
    expect(hasActiveFilters(DEFAULT_ORDER_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_ORDER_FILTERS, q: "a" })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_ORDER_FILTERS, queue: "done" })).toBe(true);
    expect(hasActiveFilters({ ...DEFAULT_ORDER_FILTERS, range: "all" })).toBe(true);
  });
});

describe("sinceFor", () => {
  it("today is local midnight", () => {
    // 03:00 UTC Oct 17 is 23:00 Oct 16 in New York (UTC-4): today started at 04:00 UTC Oct 16.
    expect(sinceFor("today", Date.UTC(2026, 9, 17, 3), 240)).toBe(Date.UTC(2026, 9, 16, 4));
  });

  it("7d and 30d are plain offsets, all is open", () => {
    const now = Date.UTC(2026, 9, 17, 12);
    expect(sinceFor("7d", now, 0)).toBe(now - 7 * DAY);
    expect(sinceFor("30d", now, 0)).toBe(now - 30 * DAY);
    expect(sinceFor("all", now, 0)).toBeUndefined();
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
