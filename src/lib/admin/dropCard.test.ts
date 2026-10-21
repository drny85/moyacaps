import { describe, expect, it } from "vitest";
import { countdown, dropMetrics, schedulableProducts, scheduleStartDate, toDropCard } from "./dropCard";
import type { DropRowInput } from "./dropCard";

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 17, 12);

const row = (over: Partial<DropRowInput> = {}): DropRowInput => ({
  variantId: "0880-black",
  nameEn: "0880 Black",
  nameEs: "0880 Negro",
  image: "/cap.png",
  catalogShot: "/cap-shot.png",
  silhouette: "snapback",
  stock: 12,
  isDrop: true,
  dropDate: NOW + 2 * DAY + 3 * HOUR + 4 * MIN + 5 * SEC,
  dropStatus: "scheduled",
  dropBadgeTextEn: "Vault Release",
  dropBadgeTextEs: "Lanzamiento de Bóveda",
  subscribersCount: 7,
  computedStatus: "scheduled",
  ...over,
});

describe("countdown", () => {
  it("splits days, hours, minutes, seconds and flags the past", () => {
    expect(countdown(NOW + 2 * DAY + 3 * HOUR + 4 * MIN + 5 * SEC, NOW)).toEqual({ d: 2, h: 3, m: 4, s: 5, past: false });
    expect(countdown(NOW, NOW)).toEqual({ d: 0, h: 0, m: 0, s: 0, past: true });
    expect(countdown(NOW - DAY, NOW).past).toBe(true);
  });
});

describe("toDropCard", () => {
  it("a scheduled drop carries its countdown, date and Catalog Shot", () => {
    const vm = toDropCard(row(), "en", NOW);
    expect(vm).toMatchObject({ variantId: "0880-black", name: "0880 Black", image: "/cap-shot.png", status: "scheduled", subscribers: 7, stock: 12, badge: "Vault Release" });
    expect(vm.countdown).toEqual({ d: 2, h: 3, m: 4, s: 5, past: false });
    expect(vm.dateLabel).toBeTruthy();
  });

  it("a scheduled drop past its date awaits release: still releasable, no countdown", () => {
    // Nothing flips a drop live on its own; the storefront keeps blocking purchase until Release now.
    const vm = toDropCard(row({ dropDate: NOW - HOUR, computedStatus: "live", dropStatus: "scheduled" }), "en", NOW);
    expect(vm).toMatchObject({ status: "scheduled", awaitingRelease: true, canRelease: true });
    expect(vm.countdown).toBeUndefined();
    const released = toDropCard(row({ dropDate: NOW - HOUR, computedStatus: "live", dropStatus: "live" }), "en", NOW);
    expect(released).toMatchObject({ status: "live", awaitingRelease: false, canRelease: false });
  });

  it("a cancelled drop can be scheduled again", () => {
    expect(toDropCard(row({ computedStatus: "archived", dropStatus: "archived", isDrop: false }), "en", NOW)).toMatchObject({ canRelease: false, canReschedule: true, canCancel: false });
  });

  it("the dialog starts from the row's date only while it is still ahead", () => {
    expect(scheduleStartDate(NOW + DAY, NOW)).toBe(NOW + DAY);
    expect(scheduleStartDate(NOW - 1, NOW)).toBeUndefined();
    expect(scheduleStartDate(undefined, NOW)).toBeUndefined();
  });

  it("names and badge follow the locale, falling back to the variant image", () => {
    const vm = toDropCard(row({ catalogShot: undefined }), "es", NOW);
    expect(vm).toMatchObject({ name: "0880 Negro", badge: "Lanzamiento de Bóveda", image: "/cap.png" });
  });

  it("capabilities by status", () => {
    expect(toDropCard(row(), "en", NOW)).toMatchObject({ canRelease: true, canReschedule: true, canCancel: true });
    expect(toDropCard(row({ computedStatus: "live", dropStatus: "live" }), "en", NOW)).toMatchObject({ canRelease: false, canReschedule: true, canCancel: true });
  });
});

describe("dropMetrics", () => {
  it("counts scheduled and live, sums subscribers, finds the next date", () => {
    const rows = [
      row(),
      row({ variantId: "b", dropDate: NOW + DAY, subscribersCount: 3 }),
      row({ variantId: "c", computedStatus: "live", dropStatus: "live", subscribersCount: 1 }),
      row({ variantId: "d", computedStatus: "archived", dropStatus: "archived", subscribersCount: 10 }),
    ];
    expect(dropMetrics(rows, NOW)).toEqual({ scheduled: 2, live: 1, subscribers: 21, nextDropAt: NOW + DAY });
    // A past-date drop still waiting for Release now counts as scheduled, not live.
    expect(dropMetrics([row({ dropDate: NOW - DAY, computedStatus: "live", dropStatus: "scheduled" })], NOW)).toMatchObject({ scheduled: 1, live: 0 });
    expect(dropMetrics([], NOW)).toEqual({ scheduled: 0, live: 0, subscribers: 0, nextDropAt: undefined });
  });
});

describe("schedulableProducts", () => {
  it("excludes drop history and archived products", () => {
    const rows = [
      { variantId: "fresh" },
      { variantId: "scheduled", isDrop: true, dropDate: NOW },
      { variantId: "old-drop", dropStatus: "archived" },
      { variantId: "dated", dropDate: NOW - DAY },
      { variantId: "gone", archivedAt: NOW },
    ];
    expect(schedulableProducts(rows).map((r) => r.variantId)).toEqual(["fresh"]);
  });
});
