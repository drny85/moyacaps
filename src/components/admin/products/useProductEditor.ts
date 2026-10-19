"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";
import type { Category } from "@convex/catalog/rules";
import { formToCreateArgs, formToPatch, isFormDirty, validateForm, withCategory, withNameEn } from "@/lib/admin/productForm";
import type { ProductFormState, ResolvedVariant } from "@/lib/admin/productForm";
import { editorFeedback, NO_FEEDBACK, splitFieldErrors } from "@/lib/admin/editorErrors";
import type { EditorFeedback } from "@/lib/admin/editorErrors";
import { canSave, editorReducer, initialEditorState, reapplyField } from "@/lib/admin/editorSession";
import type { EditorState } from "@/lib/admin/editorSession";
import type { EditorDropLink } from "./useProductActions";

export type StockChange = { current: number; next: number };

/** Which Product the editor page edits: `/new?category=…` or `/[variantId]`. */
export type EditorTarget = { mode: "new"; category: Category } | { mode: "edit"; variantId: string };

const NO_IDS: ReadonlySet<string> = new Set();

function initialState(target: EditorTarget): EditorState {
  return target.mode === "new" ? editorReducer(initialEditorState(), { type: "openCreate", category: target.category }) : initialEditorState();
}

/**
 * Form state and save logic for the product editor page. `rows` is the live admin
 * list (archived rows included); the session tracks its row so "Reload latest" can
 * re-seed after a stale save. Session transitions live in the pure `editorReducer`.
 */
export function useProductEditor(target: EditorTarget, rows: ResolvedVariant[] | undefined) {
  const createVariant = useMutation(api.catalog.admin.createVariant);
  const updateVariant = useMutation(api.catalog.admin.updateVariant);
  const restoreVariant = useMutation(api.catalog.admin.restoreVariant);

  const [state, dispatch] = useReducer(editorReducer, target, initialState);
  const { session, form, initial, unsaved } = state;
  const [feedback, setFeedback] = useState<EditorFeedback>(NO_FEEDBACK);
  const [saving, setSaving] = useState(false);
  const [pendingStock, setPendingStock] = useState<StockChange | null>(null);
  const [restoring, setRestoring] = useState(false);

  const targetRow = target.mode === "edit" ? rows?.find((r) => r.variantId === target.variantId) : undefined;
  const liveRow = session?.mode === "edit" ? rows?.find((r) => r.variantId === session.variantId) : undefined;
  const isNew = session?.mode === "create";
  const isArchived = liveRow?.archivedAt !== undefined;

  // Opens the edit session once the Product's row arrives.
  useEffect(() => {
    if (session === null && targetRow) dispatch({ type: "openEdit", row: targetRow });
  }, [session, targetRow]);

  // Seeds a just-created Product once its row arrives.
  useEffect(() => {
    if (liveRow) dispatch({ type: "rowUpdated", row: liveRow });
  }, [liveRow, session]);

  // A restore stamps a new version; the read-only form had no edits, so re-seed from the restored row.
  useEffect(() => {
    if (restoring && liveRow && liveRow.archivedAt === undefined) {
      setRestoring(false);
      dispatch({ type: "openEdit", row: liveRow });
    }
  }, [restoring, liveRow]);

  const edit = useCallback((fn: (f: ProductFormState) => ProductFormState) => dispatch({ type: "edit", fn }), []);
  const update = useCallback((changes: Partial<ProductFormState>) => edit((f) => ({ ...f, ...changes })), [edit]);
  const setCategory = useCallback((category: Category) => edit((f) => withCategory(f, category)), [edit]);
  const setNameEn = useCallback((nameEn: string) => edit((f) => withNameEn(f, nameEn, isNew)), [edit, isNew]);

  const reloadLatest = useCallback(() => {
    if (!liveRow) return;
    setFeedback(NO_FEEDBACK);
    setPendingStock(null);
    dispatch({ type: "reload", row: liveRow });
  }, [liveRow]);

  const reapply = useCallback(
    (field: keyof ProductFormState) => {
      if (unsaved) edit((f) => reapplyField(f, unsaved, field));
    },
    [edit, unsaved]
  );

  /** Back to the last saved values. */
  const discard = useCallback(() => {
    setFeedback(NO_FEEDBACK);
    edit(() => initial);
  }, [edit, initial]);

  /**
   * Links a drop change made from the editor to this session: checked against
   * the session's version, adopting exactly the version the save returns.
   * Null until the row version is known.
   */
  const dropLink = (): EditorDropLink | null => {
    if (session?.mode !== "edit" || session.version === null) return null;
    const { variantId, version } = session;
    return {
      expectedUpdatedAt: version,
      onSaved: (updatedAt) => dispatch({ type: "dropSaved", variantId, updatedAt }),
      onStale: () => setFeedback(editorFeedback({ kind: "stale" })),
    };
  };

  const commit = async ({ discardStock = false }: { discardStock?: boolean } = {}) => {
    if (!session || !canSave(session) || isArchived) return;
    setSaving(true);
    setFeedback(NO_FEEDBACK);
    try {
      if (session.mode === "create") {
        const { variantId } = await createVariant(formToCreateArgs(form));
        dispatch({ type: "created", variantId });
        return;
      }
      if (session.version === null) return;
      const patch = formToPatch(initial, form);
      const { updatedAt } =
        Object.keys(patch).length > 0
          ? await updateVariant({ variantId: session.variantId, expectedUpdatedAt: session.version, patch, ...(discardStock ? { discardStock } : {}) })
          : { updatedAt: session.version };
      dispatch({ type: "saved", updatedAt });
    } catch (err: unknown) {
      if (!(err instanceof ConvexError)) console.error("Failed to save product", err);
      setFeedback(editorFeedback(err instanceof ConvexError ? (err.data as unknown) : undefined));
    } finally {
      setSaving(false);
    }
  };

  /** Validate, then save; a cap's stock change in edit mode asks for confirmation first. */
  const requestSave = () => {
    if (!canSave(session) || saving || isArchived) return;
    const errors = validateForm(form);
    if (errors.length > 0) {
      setFeedback(splitFieldErrors(errors));
      return;
    }
    if (session?.mode === "edit" && form.category !== "apparel") {
      const current = Number(initial.stock);
      const next = Number(form.stock);
      if (current !== next) {
        setPendingStock({ current, next });
        return;
      }
    }
    void commit();
  };

  /** Save again after a `sku_in_stock` refusal, dropping the stock those SKUs hold. */
  const saveDiscardingStock = async () => {
    if (!canSave(session) || saving || isArchived) return;
    await commit({ discardStock: true });
  };

  const confirmStock = async () => {
    setPendingStock(null);
    await commit();
  };

  const restore = async () => {
    if (!liveRow) return;
    setFeedback(NO_FEEDBACK);
    try {
      await restoreVariant({ variantId: liveRow.variantId });
      setRestoring(true);
    } catch (err: unknown) {
      setFeedback(editorFeedback(err instanceof ConvexError ? (err.data as unknown) : undefined));
    }
  };

  const savedColorwayIds = useMemo(
    () => (session?.mode === "edit" ? new Set(initial.colorways.map((c) => c.id)) : NO_IDS),
    [session?.mode, initial]
  );

  return {
    isNew,
    canSave: canSave(session) && !isArchived,
    isDirty: canSave(session) && isFormDirty(initial, form),
    isArchived,
    /** Still waiting for the Product's row (edit) or a created Product's row. */
    loading: target.mode === "edit" && session === null && !(rows !== undefined && !targetRow),
    notFound: target.mode === "edit" && rows !== undefined && session === null && !targetRow,
    /** Set once a Product created here has its row: the page moves to its own URL. */
    createdVariantId: target.mode === "new" && session?.mode === "edit" && session.version !== null ? session.variantId : null,
    form,
    feedback,
    saving,
    liveRow,
    unsaved,
    savedColorwayIds,
    pendingStock,
    update,
    edit,
    setCategory,
    setNameEn,
    reloadLatest,
    reapply,
    dismissUnsaved: () => dispatch({ type: "dismissUnsaved" }),
    discard,
    dropLink,
    dismissFeedback: () => setFeedback(NO_FEEDBACK),
    requestSave,
    saveDiscardingStock,
    confirmStock,
    cancelStock: () => setPendingStock(null),
    restore,
  };
}

export type ProductEditorState = ReturnType<typeof useProductEditor>;
