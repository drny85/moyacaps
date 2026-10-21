import { describe, expect, it } from "vitest";
import { pendingBadgeLabel, rowActions, TABS, tabStatus } from "./reviewQueueModel";

describe("reviewQueueModel", () => {
  it("lists tabs with Pending first", () => {
    expect(TABS).toEqual(["pending", "published", "rejected"]);
    expect(tabStatus("published")).toBe("published");
  });

  it("gives actions per status", () => {
    expect(rowActions({ status: "pending" })).toEqual(["publish", "reject"]);
    expect(rowActions({ status: "published" })).toEqual(["unpublish"]);
    expect(rowActions({ status: "rejected" })).toEqual(["publish"]);
  });

  it("drops Publish for a deleted-account row", () => {
    expect(rowActions({ status: "pending", hiddenAt: 1 })).toEqual(["reject"]);
    expect(rowActions({ status: "rejected", hiddenAt: 1 })).toEqual([]);
    expect(rowActions({ status: "published", hiddenAt: 1 })).toEqual(["unpublish"]);
  });

  it("labels the pending badge", () => {
    expect(pendingBadgeLabel(0)).toBeNull();
    expect(pendingBadgeLabel(undefined)).toBeNull();
    expect(pendingBadgeLabel(5)).toBe("5");
    expect(pendingBadgeLabel(100)).toBe("100+");
  });
});
