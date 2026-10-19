import { describe, expect, it } from "vitest";
import { buildImageSlots, moveImage } from "./imageSlots";

const img = (id: string, role: "catalog" | "lifestyle" | "angle", extra: { colorway?: string; angle?: "front" | "left" | "back" | "right"; order?: number } = {}) => ({
  _id: id,
  role,
  order: 0,
  ...extra,
});

describe("buildImageSlots", () => {
  it("gives a Cap without angles four empty Angle Shot slots", () => {
    const slots = buildImageSlots("headwear", [], [img("c", "catalog")]);
    expect(slots.groups).toHaveLength(1);
    expect(slots.groups[0]).toMatchObject({ colorway: undefined, missingCatalog: false });
    expect(slots.groups[0].catalog?._id).toBe("c");
    expect(slots.angles.map((a) => [a.angle, a.image])).toEqual([
      ["front", undefined],
      ["left", undefined],
      ["back", undefined],
      ["right", undefined],
    ]);
    expect(slots.anglesComplete).toBe(false);
  });

  it("fills Angle Shots and orders the Lifestyle Shots", () => {
    const images = [
      ...(["front", "left", "back", "right"] as const).map((angle) => img(angle, "angle", { angle })),
      img("l2", "lifestyle", { order: 2 }),
      img("l1", "lifestyle", { order: 1 }),
    ];
    const slots = buildImageSlots("headwear", [], images);
    expect(slots.anglesComplete).toBe(true);
    expect(slots.groups[0].lifestyle.map((i) => i._id)).toEqual(["l1", "l2"]);
    expect(slots.groups[0].missingCatalog).toBe(true);
  });

  it("gives a tee one group per Apparel Colorway, flagging those without a Catalog Shot", () => {
    const images = [img("b", "catalog", { colorway: "black" }), img("wl", "lifestyle", { colorway: "white" })];
    const slots = buildImageSlots("apparel", ["black", "white"], images);
    expect(slots.groups.map((g) => [g.colorway, g.missingCatalog])).toEqual([
      ["black", false],
      ["white", true],
    ]);
    expect(slots.groups[1].lifestyle.map((i) => i._id)).toEqual(["wl"]);
    expect(slots.angles).toEqual([]);
  });
});

describe("moveImage", () => {
  it("moves one id to a new position", () => {
    expect(moveImage(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveImage(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"]);
  });

  it("returns an unchanged copy out of bounds", () => {
    const ids = ["a", "b"];
    expect(moveImage(ids, 0, 2)).toEqual(["a", "b"]);
    expect(moveImage(ids, -1, 0)).toEqual(["a", "b"]);
    expect(moveImage(ids, 1, 1)).not.toBe(ids);
  });
});
