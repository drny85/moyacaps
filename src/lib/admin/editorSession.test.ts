import { describe, expect, it } from "vitest";
import { canSave, closeDecision, editorReducer, initialEditorState, reapplyField, unsavedFields } from "./editorSession";
import type { EditorState } from "./editorSession";
import type { ResolvedVariant } from "./productForm";

const row = (overrides: Record<string, unknown> = {}) =>
  ({
    _id: "v1",
    _creationTime: 100,
    updatedAt: 200,
    variantId: "moya-snap",
    nameEn: "Moya Snap",
    nameEs: "Moya Snap ES",
    silhouette: "snapback",
    category: "headwear",
    primaryHex: "#111111",
    secondaryHex: "#ffffff",
    image: "",
    stock: 7,
    priceUsd: 45,
    isFeatured: false,
    isAvailable: false,
    subscribersCount: 0,
    ...overrides,
  }) as unknown as ResolvedVariant;

const editing = (): EditorState => editorReducer(initialEditorState(), { type: "openEdit", row: row() });

describe("editorReducer", () => {
  it("opens a blank create session", () => {
    const state = editorReducer(editing(), { type: "openCreate" });
    expect(state.session).toEqual({ mode: "create" });
    expect(state.form).toEqual(initialEditorState().form);
    expect(state.initial).toBe(state.form);
  });

  it("opens an edit session seeded from the row", () => {
    const state = editing();
    expect(state.session).toEqual({ mode: "edit", variantId: "moya-snap", version: 200 });
    expect(state.form.nameEn).toBe("Moya Snap");
    expect(state.initial).toBe(state.form);
  });

  it("uses the creation time as version for a row never updated", () => {
    const state = editorReducer(initialEditorState(), { type: "openEdit", row: row({ updatedAt: undefined }) });
    expect(state.session).toMatchObject({ version: 100 });
  });

  it("keys tee colorways when seeding", () => {
    const colorways = [{ id: "black", nameEn: "Black", nameEs: "Negro", hex: "#000000", borderHex: "#111111", lifestyleImage: "l", catalogShot: "c" }];
    const state = editorReducer(initialEditorState(), { type: "openEdit", row: row({ category: "apparel", silhouette: "tee", colorways, sizes: ["M"] }) });
    expect(state.form.colorways[0].uid).toBeDefined();
  });

  it("moves a created product to edit with a pending version, keeping the form", () => {
    let state = editorReducer(initialEditorState(), { type: "openCreate" });
    state = editorReducer(state, { type: "edit", fn: (f) => ({ ...f, nameEn: "Typed" }) });
    state = editorReducer(state, { type: "created", variantId: "typed" });
    expect(state.session).toEqual({ mode: "edit", variantId: "typed", version: null });
    expect(state.form.nameEn).toBe("Typed");
    expect(canSave(state.session)).toBe(false);
  });

  it("seeds from the new row once it arrives", () => {
    let state = editorReducer(initialEditorState(), { type: "openCreate" });
    state = editorReducer(state, { type: "created", variantId: "moya-snap" });
    state = editorReducer(state, { type: "rowUpdated", row: row({ updatedAt: undefined, _creationTime: 300 }) });
    expect(state.session).toMatchObject({ version: 300 });
    expect(state.form.isAvailable).toBe(false);
    expect(canSave(state.session)).toBe(true);
  });

  it("ignores rows of other products", () => {
    const state = editing();
    expect(editorReducer(state, { type: "rowUpdated", row: row({ variantId: "other", updatedAt: 999 }) })).toBe(state);
  });

  it("does not adopt a newer version from the live row (stale stays stale)", () => {
    const state = editing();
    expect(editorReducer(state, { type: "rowUpdated", row: row({ updatedAt: 250 }) })).toBe(state);
  });

  it("adopts exactly the version its own drop save returned, keeping the form", () => {
    let state = editing();
    state = editorReducer(state, { type: "edit", fn: (f) => ({ ...f, priceUsd: "99" }) });
    state = editorReducer(state, { type: "dropSaved", variantId: "moya-snap", updatedAt: 260 });
    expect(state.session).toMatchObject({ version: 260 });
    expect(state.form.priceUsd).toBe("99");
    expect(state.initial.priceUsd).toBe("45");
  });

  it("never adopts a version other than the drop save's", () => {
    // Another admin edits (V1 = 250), then this editor's drop save returns V2 = 260.
    let state = editorReducer(editing(), { type: "rowUpdated", row: row({ updatedAt: 250, priceUsd: 70 }) });
    state = editorReducer(state, { type: "dropSaved", variantId: "moya-snap", updatedAt: 260 });
    state = editorReducer(state, { type: "rowUpdated", row: row({ updatedAt: 270, nameEn: "Changed elsewhere" }) });
    expect(state.session).toMatchObject({ version: 260 });
    expect(state.form.nameEn).toBe("Moya Snap");
  });

  it("ignores a drop save for another product or before the row version is known", () => {
    const state = editing();
    expect(editorReducer(state, { type: "dropSaved", variantId: "other", updatedAt: 999 })).toBe(state);
    let pending = editorReducer(initialEditorState(), { type: "openCreate" });
    pending = editorReducer(pending, { type: "created", variantId: "moya-snap" });
    expect(editorReducer(pending, { type: "dropSaved", variantId: "moya-snap", updatedAt: 999 })).toBe(pending);
  });

  it("reloads the latest row, keeping the discarded edits beside it", () => {
    let state = editorReducer(editing(), { type: "edit", fn: (f) => ({ ...f, priceUsd: "99" }) });
    state = editorReducer(state, { type: "reload", row: row({ updatedAt: 400, priceUsd: 50 }) });
    expect(state.session).toMatchObject({ version: 400 });
    expect(state.form.priceUsd).toBe("50");
    expect(state.initial).toBe(state.form);
    expect(state.unsaved?.priceUsd).toBe("99");
    expect(unsavedFields(state.form, state.unsaved!)).toEqual(["priceUsd"]);
  });

  it("keeps nothing aside when reloading a clean form", () => {
    const state = editorReducer(editing(), { type: "reload", row: row({ updatedAt: 400 }) });
    expect(state.unsaved).toBeNull();
  });

  it("re-applies one discarded value at a time, then drops the set", () => {
    let state = editorReducer(editing(), { type: "edit", fn: (f) => ({ ...f, priceUsd: "99", nameEs: "Mío" }) });
    state = editorReducer(state, { type: "reload", row: row({ updatedAt: 400, nameEn: "Fresh" }) });
    expect(unsavedFields(state.form, state.unsaved!)).toEqual(["nameEn", "nameEs", "priceUsd"]);
    state = editorReducer(state, { type: "edit", fn: (f) => reapplyField(f, state.unsaved!, "priceUsd") });
    expect(state.form).toMatchObject({ priceUsd: "99", nameEn: "Fresh", nameEs: "Moya Snap ES" });
    state = editorReducer(state, { type: "dismissUnsaved" });
    expect(state.unsaved).toBeNull();
  });

  it("re-applies tee options as a group", () => {
    const colorways = [{ id: "black", nameEn: "Black", nameEs: "Negro", hex: "#000000", borderHex: "#111111" }];
    const fresh = editorReducer(initialEditorState(), { type: "openCreate", category: "apparel" }).form;
    const mine = { ...fresh, colorways, defaultColorway: "black" };
    expect(unsavedFields(fresh, mine)).toEqual(["defaultColorway", "colorways"]);
    expect(reapplyField(fresh, mine, "colorways").colorways).toEqual(colorways);
  });

  it("a save after Reload latest sends the reloaded version", () => {
    let state = editorReducer(editing(), { type: "edit", fn: (f) => ({ ...f, priceUsd: "99" }) });
    state = editorReducer(state, { type: "reload", row: row({ updatedAt: 400 }) });
    expect(state.session).toEqual({ mode: "edit", variantId: "moya-snap", version: 400 });
  });

  it("adopts its own save's version and marks the form clean", () => {
    let state = editorReducer(editing(), { type: "edit", fn: (f) => ({ ...f, priceUsd: "99" }) });
    state = editorReducer(state, { type: "saved", updatedAt: 500 });
    expect(state.session).toMatchObject({ version: 500 });
    expect(state.initial).toBe(state.form);
    expect(closeDecision(state, { saving: false, blocked: false })).toBe("close");
  });

  it("ignores a save result before the row version is known", () => {
    let state = editorReducer(initialEditorState(), { type: "openCreate" });
    state = editorReducer(state, { type: "created", variantId: "x" });
    expect(editorReducer(state, { type: "saved", updatedAt: 500 })).toBe(state);
  });

  it("opens a create session for the chosen category", () => {
    const state = editorReducer(initialEditorState(), { type: "openCreate", category: "apparel" });
    expect(state.form.category).toBe("apparel");
    expect(state.form.silhouette).toBe("tee");
  });

  it("closes", () => {
    expect(editorReducer(editing(), { type: "close" }).session).toBeNull();
    expect(canSave(null)).toBe(false);
  });
});

describe("closeDecision", () => {
  it("closes a clean form", () => {
    expect(closeDecision(editing(), { saving: false, blocked: false })).toBe("close");
  });

  it("asks before discarding edits", () => {
    const dirty = editorReducer(editing(), { type: "edit", fn: (f) => ({ ...f, nameEs: "Otro" }) });
    expect(closeDecision(dirty, { saving: false, blocked: false })).toBe("confirm");
  });

  it("closes without asking while a created product waits for its row", () => {
    let state = editorReducer(initialEditorState(), { type: "openCreate" });
    state = editorReducer(state, { type: "edit", fn: (f) => ({ ...f, nameEn: "Typed" }) });
    expect(closeDecision(state, { saving: false, blocked: false })).toBe("confirm");
    state = editorReducer(state, { type: "created", variantId: "typed" });
    expect(closeDecision(state, { saving: false, blocked: false })).toBe("close");
  });

  it("blocks while saving or while a dialog sits on top", () => {
    const dirty = editorReducer(editing(), { type: "edit", fn: (f) => ({ ...f, nameEs: "Otro" }) });
    expect(closeDecision(editing(), { saving: true, blocked: false })).toBe("block");
    expect(closeDecision(dirty, { saving: false, blocked: true })).toBe("block");
  });
});
