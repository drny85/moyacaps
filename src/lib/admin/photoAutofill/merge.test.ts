import { describe, expect, it } from "vitest";
import { emptyForm, validateForm } from "../productForm";
import { aiFilledFields, applyAutofill } from "./merge";
import type { AutofillCatalogContext } from "./context";
import type { AutofillProposal } from "./schema";
import { blackColorway } from "./testRows";

const ctx: AutofillCatalogContext = { colorways: [blackColorway], examples: [], takenSlugs: [] };

const capProposal: AutofillProposal = {
  recognized: "cap",
  note: "",
  silhouette: "trucker",
  primaryHex: "#1A1A1A",
  secondaryHex: "#c9a227",
  nameEn: "Gold Clover Trucker",
  nameEs: "Trucker Trébol Dorado",
  slug: "gold-clover-trucker",
  descriptionEn: "A black trucker Cap with a gold clover.",
  descriptionEs: "Una gorra trucker negra con trébol dorado.",
  colorways: [],
  fabricEn: "",
  fabricEs: "",
  fitEn: "",
  fitEs: "",
};

const teeProposal: AutofillProposal = {
  ...capProposal,
  recognized: "tee",
  silhouette: "tee",
  nameEn: "Clover Tee",
  nameEs: "Playera Trébol",
  slug: "clover-tee",
  colorways: [
    { id: "vintage-black", nameEn: "Black", nameEs: "Negro", hex: "#000000", borderHex: "#000000" },
    { id: "Sky Blue", nameEn: "Sky Blue", nameEs: "Azul Cielo", hex: "#87ceeb", borderHex: "#5fa8c8" },
  ],
  fabricEn: "300 GSM combed cotton",
  fabricEs: "Algodón peinado 300 GSM",
  fitEn: "Boxy",
  fitEs: "Holgada",
};

function applied(out: ReturnType<typeof applyAutofill>) {
  if (out.kind !== "applied") throw new Error(`expected applied, got ${out.kind}`);
  return out;
}

describe("applyAutofill", () => {
  it("fills an empty Cap form and keeps the default price", () => {
    const { form } = applied(applyAutofill(emptyForm("headwear"), capProposal, ctx, false));
    expect(form.nameEn).toBe("Gold Clover Trucker");
    expect(form.descriptionEs).toBe(capProposal.descriptionEs);
    expect(form.silhouette).toBe("trucker");
    expect(form.primaryHex).toBe("#1a1a1a");
    expect(form.variantId).toBe("gold-clover-trucker");
    expect(form.priceUsd).toBe("120");
  });

  it("switches to apparel and its default price when a tee is recognized", () => {
    const { form, filled } = applied(applyAutofill(emptyForm("headwear"), teeProposal, ctx, false));
    expect(form.category).toBe("apparel");
    expect(form.silhouette).toBe("tee");
    expect(form.priceUsd).toBe("80");
    expect(filled.category).toBe("apparel");
  });

  it("never overwrites a typed field", () => {
    const typed = { ...emptyForm("headwear"), nameEn: "My Name", descriptionEs: "Mía", primaryHex: "#ff0000", priceUsd: "99" };
    const { form, filled } = applied(applyAutofill(typed, capProposal, ctx, false));
    expect(form.nameEn).toBe("My Name");
    expect(form.descriptionEs).toBe("Mía");
    expect(form.primaryHex).toBe("#ff0000");
    expect(form.priceUsd).toBe("99");
    expect("nameEn" in filled).toBe(false);
    expect("primaryHex" in filled).toBe(false);
  });

  it("keeps a category the Administrator chose and reports the conflict", () => {
    const out = applied(applyAutofill(emptyForm("apparel"), capProposal, ctx, true));
    expect(out.form.category).toBe("apparel");
    expect(out.form.silhouette).toBe("tee");
    expect(out.categoryConflict).toBe("headwear");
  });

  it("reports no conflict when the chosen category matches", () => {
    expect(applied(applyAutofill(emptyForm("headwear"), capProposal, ctx, true)).categoryConflict).toBeNull();
  });

  it("fills nothing for an unrecognized photo", () => {
    expect(applyAutofill(emptyForm("headwear"), { ...capProposal, recognized: "other", note: "A dog" }, ctx, false)).toEqual({
      kind: "unrecognized",
      note: "A dog",
    });
  });

  it("drops an invalid hex and expands a short one", () => {
    const { form, filled } = applied(applyAutofill(emptyForm("headwear"), { ...capProposal, primaryHex: "red", secondaryHex: "#AbC" }, ctx, false));
    expect(form.primaryHex).toBe("#000000");
    expect("primaryHex" in filled).toBe(false);
    expect(form.secondaryHex).toBe("#aabbcc");
  });

  it("clips names to 80 and descriptions to 1000 characters", () => {
    const { form } = applied(
      applyAutofill(emptyForm("headwear"), { ...capProposal, nameEn: "x".repeat(200), descriptionEn: "y".repeat(1500) }, ctx, false)
    );
    expect(form.nameEn).toHaveLength(80);
    expect(form.descriptionEn).toHaveLength(1000);
  });

  it("suffixes a taken slug", () => {
    const taken = { ...ctx, takenSlugs: ["black-cap", "black-cap-2"] };
    const { form } = applied(applyAutofill(emptyForm("headwear"), { ...capProposal, slug: "Black Cap" }, taken, false));
    expect(form.variantId).toBe("black-cap-3");
  });

  it("derives the slug from the English name when the proposal has none", () => {
    const { form } = applied(applyAutofill(emptyForm("headwear"), { ...capProposal, slug: "" }, ctx, false));
    expect(form.variantId).toBe("gold-clover-trucker");
  });

  it("reuses a stored colorway by id and normalizes a new one", () => {
    const { form } = applied(applyAutofill(emptyForm("apparel"), teeProposal, ctx, false));
    expect(form.colorways).toEqual([blackColorway, { id: "sky-blue", nameEn: "Sky Blue", nameEs: "Azul Cielo", hex: "#87ceeb", borderHex: "#5fa8c8" }]);
  });

  it("drops a duplicate colorway and one without a usable hex", () => {
    const proposal = {
      ...teeProposal,
      colorways: [teeProposal.colorways[0], teeProposal.colorways[0], { id: "mud", nameEn: "Mud", nameEs: "Lodo", hex: "brown", borderHex: "#000" }],
    };
    expect(applied(applyAutofill(emptyForm("apparel"), proposal, ctx, false)).form.colorways).toEqual([blackColorway]);
  });

  it("fills tee copy for a tee and ignores it for a Cap", () => {
    expect(applied(applyAutofill(emptyForm("apparel"), teeProposal, ctx, false)).form.fabricEn).toBe("300 GSM combed cotton");
    const cap = applied(applyAutofill(emptyForm("headwear"), { ...teeProposal, recognized: "cap", silhouette: "snapback" }, ctx, false));
    expect(cap.form.fabricEn).toBe("");
    expect(cap.form.colorways).toEqual([]);
  });

  it("fills only still-empty fields on a second run", () => {
    const first = applied(applyAutofill(emptyForm("headwear"), capProposal, ctx, false));
    const second = applied(applyAutofill(first.form, { ...capProposal, nameEn: "Other" }, ctx, false));
    expect(second.form.nameEn).toBe("Gold Clover Trucker");
    expect(second.filled).toEqual({});
  });

  it("never puts a value in the form that validateForm rejects for format", () => {
    const messy = { ...capProposal, primaryHex: "nope", slug: "Gold  Clover__Trucker!!", nameEn: "  Gold Clover  " };
    const { form } = applied(applyAutofill(emptyForm("headwear"), messy, ctx, false));
    expect(validateForm(form).filter((e) => e.code === "format" || e.code === "too_long")).toEqual([]);
  });
});

describe("aiFilledFields", () => {
  it("lists the fields still holding the AI's value", () => {
    const { form, filled } = applied(applyAutofill(emptyForm("headwear"), capProposal, ctx, false));
    expect(aiFilledFields(form, filled)).toEqual(expect.arrayContaining(["nameEn", "descriptionEs", "silhouette", "variantId"]));
  });

  it("drops a field once the Administrator edits it", () => {
    const { form, filled } = applied(applyAutofill(emptyForm("headwear"), capProposal, ctx, false));
    expect(aiFilledFields({ ...form, nameEn: "Edited" }, filled)).not.toContain("nameEn");
  });

  it("compares colorways by value, ignoring client-only keys", () => {
    const { form, filled } = applied(applyAutofill(emptyForm("apparel"), teeProposal, ctx, false));
    const withUids = { ...form, colorways: form.colorways.map((c, i) => ({ ...c, uid: `u${i}` })) };
    expect(aiFilledFields(withUids, filled)).toContain("colorways");
  });
});
