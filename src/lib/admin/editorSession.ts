import { emptyForm, formFromVariant, isFormDirty } from "./productForm";
import type { ProductFormState, ResolvedVariant } from "./productForm";
import { withColorwayUids } from "./teeOptions";

/**
 * Session transitions of the product editor. `version` is the row's
 * `updatedAt` the next save sends as `expectedUpdatedAt`; it is null between a
 * create and the new row arriving. `rebasePending` is set after a drop change
 * made from the editor: drop fields are not in the form, so the next row
 * version is adopted without re-seeding the form.
 */

export type EditorSession =
  | { mode: "create" }
  | { mode: "edit"; variantId: string; version: number | null; rebasePending: boolean };

export type EditorState = {
  session: EditorSession | null;
  initial: ProductFormState;
  form: ProductFormState;
};

export type EditorAction =
  | { type: "openCreate" }
  | { type: "openEdit"; row: ResolvedVariant }
  | { type: "created"; variantId: string }
  | { type: "rowUpdated"; row: ResolvedVariant }
  | { type: "dropSaved"; variantId: string }
  | { type: "reload"; row: ResolvedVariant }
  | { type: "edit"; fn: (form: ProductFormState) => ProductFormState }
  | { type: "close" };

export function versionOf(row: Pick<ResolvedVariant, "updatedAt" | "_creationTime">): number {
  return row.updatedAt ?? row._creationTime;
}

export function initialEditorState(): EditorState {
  const blank = emptyForm("headwear");
  return { session: null, initial: blank, form: blank };
}

function seeded(row: ResolvedVariant): EditorState {
  const form = withColorwayUids(formFromVariant(row));
  return { session: { mode: "edit", variantId: row.variantId, version: versionOf(row), rebasePending: false }, initial: form, form };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const { session } = state;
  switch (action.type) {
    case "openCreate":
      return { ...initialEditorState(), session: { mode: "create" } };
    case "openEdit":
    case "reload":
      return seeded(action.row);
    case "created":
      if (session?.mode !== "create") return state;
      return { ...state, session: { mode: "edit", variantId: action.variantId, version: null, rebasePending: false } };
    case "rowUpdated": {
      if (session?.mode !== "edit" || session.variantId !== action.row.variantId) return state;
      if (session.version === null) return seeded(action.row);
      const version = versionOf(action.row);
      if (!session.rebasePending || version === session.version) return state;
      return { ...state, session: { ...session, version, rebasePending: false } };
    }
    case "dropSaved":
      if (session?.mode !== "edit" || session.variantId !== action.variantId || session.version === null) return state;
      return { ...state, session: { ...session, rebasePending: true } };
    case "edit":
      return session ? { ...state, form: action.fn(state.form) } : state;
    case "close":
      return { ...state, session: null };
  }
}

/** A save is possible once the session knows which row version it edits. */
export function canSave(session: EditorSession | null): boolean {
  return session !== null && !(session.mode === "edit" && session.version === null);
}

export type CloseDecision = "close" | "confirm" | "block";

/** Escape, backdrop and Cancel: blocked while saving or a dialog sits on top; unsaved edits ask first. */
export function closeDecision(state: EditorState, flags: { saving: boolean; blocked: boolean }): CloseDecision {
  if (flags.saving || flags.blocked) return "block";
  return state.session && isFormDirty(state.initial, state.form) ? "confirm" : "close";
}
