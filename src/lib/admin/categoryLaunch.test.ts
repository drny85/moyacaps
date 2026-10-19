import { describe, expect, it } from "vitest";
import { listedCount, needsLaunchConfirm } from "./categoryLaunch";

describe("needsLaunchConfirm", () => {
  it("is true only when leaving live", () => {
    expect(needsLaunchConfirm("live", "coming_soon")).toBe(true);
    expect(needsLaunchConfirm("live", "hidden")).toBe(true);
    expect(needsLaunchConfirm("live", "live")).toBe(false);
    expect(needsLaunchConfirm("coming_soon", "live")).toBe(false);
    expect(needsLaunchConfirm("hidden", "coming_soon")).toBe(false);
  });
});

describe("listedCount", () => {
  const row = (o: Partial<{ category: string; silhouette: string; isAvailable: boolean; archivedAt: number }>) => ({
    silhouette: "snapback",
    isAvailable: true,
    ...o,
  });

  it("counts visible, unarchived products of the category", () => {
    const rows = [
      row({ category: "headwear" }),
      row({}), // no category counts as a cap
      row({ category: "headwear", isAvailable: false }),
      row({ category: "headwear", archivedAt: 1 }),
      row({ category: "apparel", silhouette: "tee" }),
      row({ silhouette: "tee" }), // legacy tee without category
    ];
    expect(listedCount(rows, "headwear")).toBe(2);
    expect(listedCount(rows, "apparel")).toBe(2);
  });
});
