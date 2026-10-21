import { describe, expect, it } from "vitest";
import { editorReducer, initialEditorState } from "./editorSession";
import type { EditorState } from "./editorSession";
import type { AutofillProposal } from "./photoAutofill/schema";

const ctx = { colorways: [], examples: [], takenSlugs: [] };
const proposal: AutofillProposal = {
  recognized: "tee",
  note: "",
  silhouette: "tee",
  primaryHex: "#111111",
  secondaryHex: "#222222",
  nameEn: "Clover Tee",
  nameEs: "Playera Trébol",
  slug: "clover-tee",
  descriptionEn: "A tee.",
  descriptionEs: "Una playera.",
  colorways: [],
  fabricEn: "",
  fabricEs: "",
  fitEn: "",
  fitEs: "",
};

const creating = (): EditorState => editorReducer(initialEditorState(), { type: "openCreate" });

describe("editorReducer autofill", () => {
  it("merges against the live form, keeping edits made while the photos were read", () => {
    let state = creating();
    state = editorReducer(state, { type: "edit", fn: (f) => ({ ...f, nameEn: "Typed meanwhile", priceUsd: "99" }) });
    state = editorReducer(state, { type: "autofill", proposal, ctx });
    expect(state.form.nameEn).toBe("Typed meanwhile");
    expect(state.form.priceUsd).toBe("99");
    expect(state.form.descriptionEn).toBe("A tee.");
  });

  it("keeps a category chosen in the form while the photos were read", () => {
    let state = creating();
    state = editorReducer(state, { type: "chooseCategory", category: "headwear" });
    state = editorReducer(state, { type: "autofill", proposal, ctx });
    expect(state.form.category).toBe("headwear");
    expect(state.autofill.last).toMatchObject({ kind: "applied", categoryConflict: "apparel" });
  });

  it("switches an untouched category and records the filled values and outcome", () => {
    const state = editorReducer(creating(), { type: "autofill", proposal, ctx });
    expect(state.form.category).toBe("apparel");
    expect(state.autofill.filled.nameEn).toBe("Clover Tee");
    expect(state.autofill.last?.kind).toBe("applied");
  });

  it("merges filled values across runs", () => {
    let state = editorReducer(creating(), { type: "autofill", proposal: { ...proposal, descriptionEs: "" }, ctx });
    state = editorReducer(state, { type: "autofill", proposal, ctx });
    expect(state.autofill.filled.nameEn).toBe("Clover Tee");
    expect(state.autofill.filled.descriptionEs).toBe("Una playera.");
  });

  it("records an unrecognized outcome without touching the form", () => {
    const before = creating();
    const state = editorReducer(before, { type: "autofill", proposal: { ...proposal, recognized: "other", note: "A dog" }, ctx });
    expect(state.form).toBe(before.form);
    expect(state.autofill.last).toEqual({ kind: "unrecognized", note: "A dog" });
  });

  it("ignores a result that lands after the Product was created", () => {
    let state = editorReducer(creating(), { type: "edit", fn: (f) => ({ ...f, nameEn: "Saved" }) });
    state = editorReducer(state, { type: "created", variantId: "saved" });
    const after = editorReducer(state, { type: "autofill", proposal, ctx });
    expect(after).toBe(state);
  });

  it("starts each create session with no autofill state", () => {
    let state = editorReducer(creating(), { type: "chooseCategory", category: "apparel" });
    state = editorReducer(state, { type: "autofill", proposal, ctx });
    state = editorReducer(state, { type: "openCreate" });
    expect(state.autofill).toEqual({ filled: {}, last: null, categoryTouched: false });
  });
});
