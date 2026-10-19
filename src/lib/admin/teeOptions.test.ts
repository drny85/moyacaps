import { describe, expect, it } from "vitest";
import { emptyForm } from "./productForm";
import type { ProductFormState } from "./productForm";
import { addColorway, colorInputValue, isColorwayLocked, removeColorway, toggleSize, updateColorway } from "./teeOptions";

const black = { id: "black", nameEn: "Black", nameEs: "Negro", hex: "#111111", borderHex: "#333333" };
const white = { id: "white", nameEn: "White", nameEs: "Blanco", hex: "#ffffff", borderHex: "#dddddd" };

function tee(overrides: Partial<ProductFormState> = {}): ProductFormState {
  return { ...emptyForm("apparel"), colorways: [black, white], defaultColorway: "white", ...overrides };
}

const none = new Set<string>();

describe("addColorway", () => {
  it("appends a blank colorway", () => {
    const next = addColorway(tee());
    expect(next.colorways).toHaveLength(3);
    expect(next.colorways[2]).toEqual({ id: "", nameEn: "", nameEs: "", hex: "#000000", borderHex: "#000000" });
  });
});

describe("updateColorway", () => {
  it("suggests the id from the English name of a new colorway", () => {
    let form = addColorway(tee());
    form = updateColorway(form, 2, { nameEn: "Washed Sand" }, none);
    expect(form.colorways[2].id).toBe("washed-sand");
    form = updateColorway(form, 2, { nameEn: "Washed Sand 2" }, none);
    expect(form.colorways[2].id).toBe("washed-sand-2");
  });

  it("stops suggesting once the id was edited by hand", () => {
    let form = addColorway(tee());
    form = updateColorway(form, 2, { nameEn: "Sand" }, none);
    form = updateColorway(form, 2, { id: "desert" }, none);
    form = updateColorway(form, 2, { nameEn: "Sand Two" }, none);
    expect(form.colorways[2].id).toBe("desert");
  });

  it("never changes the id of a saved colorway", () => {
    const saved = new Set(["black", "white"]);
    let form = updateColorway(tee(), 0, { id: "onyx" }, saved);
    expect(form.colorways[0].id).toBe("black");
    form = updateColorway(form, 0, { nameEn: "Onyx", hex: "#000000" }, saved);
    expect(form.colorways[0]).toEqual({ ...black, nameEn: "Onyx", hex: "#000000" });
  });

  it("leaves other colorways untouched", () => {
    const form = updateColorway(tee(), 1, { nameEs: "Blanco Hueso" }, none);
    expect(form.colorways[0]).toBe(black);
    expect(form.colorways[1].nameEs).toBe("Blanco Hueso");
  });
});

describe("isColorwayLocked", () => {
  it("locks saved colorways only", () => {
    const saved = new Set(["black"]);
    const colorways = [black, white];
    expect(isColorwayLocked(colorways, 0, saved)).toBe(true);
    expect(isColorwayLocked(colorways, 1, saved)).toBe(false);
  });

  it("keeps a new colorway that repeats a saved id editable", () => {
    const saved = new Set(["black"]);
    expect(isColorwayLocked([black, { ...white, id: "black" }], 1, saved)).toBe(false);
  });
});

describe("removeColorway", () => {
  it("removes the colorway and keeps the default", () => {
    const form = removeColorway(tee(), 0);
    expect(form.colorways).toEqual([white]);
    expect(form.defaultColorway).toBe("white");
  });

  it("clears the default when the default colorway goes", () => {
    const form = removeColorway(tee(), 1);
    expect(form.colorways).toEqual([black]);
    expect(form.defaultColorway).toBeUndefined();
  });
});

describe("toggleSize", () => {
  it("adds sizes in the allowed order and removes them", () => {
    let form = tee({ sizes: ["M", "XL"] });
    form = toggleSize(form, "XS");
    expect(form.sizes).toEqual(["XS", "M", "XL"]);
    form = toggleSize(form, "M");
    expect(form.sizes).toEqual(["XS", "XL"]);
  });

  it("ignores sizes that are not allowed", () => {
    const form = tee({ sizes: ["M"] });
    expect(toggleSize(form, "5XL")).toBe(form);
  });
});

describe("colorInputValue", () => {
  it("gives the color input a six-digit hex", () => {
    expect(colorInputValue("#ABCDEF")).toBe("#abcdef");
    expect(colorInputValue("#abc")).toBe("#aabbcc");
    expect(colorInputValue("nope")).toBe("#000000");
  });
});
