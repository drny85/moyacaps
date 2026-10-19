import type { Category } from "../../../convex/catalog/rules";
import { emptyForm, formFromVariant, isFormDirty } from "./productForm";
import type { ProductFormState, ResolvedVariant } from "./productForm";
import { withColorwayUids } from "./teeOptions";

/**
 * Session transitions of the product editor. `version` is the row's
 * `updatedAt` the next save sends as `expectedUpdatedAt`; it is null between a
 * create and the new row arriving. A drop change made from the editor sends
 * `version` and returns the row's new version, which the session adopts
 * without re-seeding the form (drop fields are not in it). A form save adopts
 * the version `updateVariant` returned and marks the form clean. No other newer
 * version is ever adopted, so a concurrent edit still fails as `stale`.
 * "Reload latest" re-seeds from the live row and keeps the discarded edits in
 * `unsaved`, so they can be re-applied field by field.
 */

export type EditorSession =
  | { mode: "create" }
  | { mode: "edit"; variantId: string; version: number | null };

export type EditorState = {
  session: EditorSession | null;
  initial: ProductFormState;
  form: ProductFormState;
  /** Edits discarded by the last "Reload latest", shown beside the fresh values. */
  unsaved: ProductFormState | null;
};

export type EditorAction =
  | { type: "openCreate"; category?: Category }
  | { type: "openEdit"; row: ResolvedVariant }
  | { type: "created"; variantId: string }
  | { type: "rowUpdated"; row: ResolvedVariant }
  | { type: "dropSaved"; variantId: string; updatedAt: number }
  | { type: "saved"; updatedAt: number }
  | { type: "dismissUnsaved" }
  | { type: "reload"; row: ResolvedVariant }
  | { type: "edit"; fn: (form: ProductFormState) => ProductFormState }
  | { type: "close" };

export function versionOf(row: Pick<ResolvedVariant, "updatedAt" | "_creationTime">): number {
  return row.updatedAt ?? row._creationTime;
}

export function initialEditorState(): EditorState {
  const blank = emptyForm("headwear");
  return { session: null, initial: blank, form: blank, unsaved: null };
}

function seeded(row: ResolvedVariant): EditorState {
  const form = withColorwayUids(formFromVariant(row));
  return { session: { mode: "edit", variantId: row.variantId, version: versionOf(row) }, initial: form, form, unsaved: null };
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  const { session } = state;
  switch (action.type) {
    case "openCreate": {
      const blank = emptyForm(action.category ?? "headwear");
      return { session: { mode: "create" }, initial: blank, form: blank, unsaved: null };
    }
    case "openEdit":
      return seeded(action.row);
    case "reload":
      return { ...seeded(action.row), unsaved: isFormDirty(state.initial, state.form) ? state.form : null };
    case "created":
      if (session?.mode !== "create") return state;
      return { ...state, session: { mode: "edit", variantId: action.variantId, version: null } };
    case "rowUpdated":
      if (session?.mode !== "edit" || session.variantId !== action.row.variantId || session.version !== null) return state;
      return seeded(action.row);
    case "dropSaved":
      if (session?.mode !== "edit" || session.variantId !== action.variantId || session.version === null) return state;
      return { ...state, session: { ...session, version: action.updatedAt } };
    case "saved":
      if (session?.mode !== "edit" || session.version === null) return state;
      return { ...state, session: { ...session, version: action.updatedAt }, initial: state.form };
    case "dismissUnsaved":
      return { ...state, unsaved: null };
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

/**
 * Escape, backdrop and Cancel: blocked while saving or a dialog sits on top; unsaved edits ask first.
 * A created product waiting for its row has nothing unsaved.
 */
export function closeDecision(state: EditorState, flags: { saving: boolean; blocked: boolean }): CloseDecision {
  if (flags.saving || flags.blocked) return "block";
  if (!canSave(state.session)) return "close";
  return isFormDirty(state.initial, state.form) ? "confirm" : "close";
}

/** Every form field, `defaultColorway` included (the blank form leaves it out). */
const FIELDS: (keyof ProductFormState)[] = [
  ...(Object.keys(emptyForm("headwear")) as (keyof ProductFormState)[]).filter((k) => k !== "colorways"),
  "defaultColorway",
  "colorways",
];

/** The fields where `mine` (discarded edits) differs from `fresh` (the reloaded row), in form order. */
export function unsavedFields(fresh: ProductFormState, mine: ProductFormState): (keyof ProductFormState)[] {
  return FIELDS.filter((key) => isFormDirty(fresh, { ...fresh, [key]: mine[key] }));
}

/** Copy one discarded value back into the form. */
export function reapplyField(form: ProductFormState, unsaved: ProductFormState, field: keyof ProductFormState): ProductFormState {
  return { ...form, [field]: unsaved[field] };
}
