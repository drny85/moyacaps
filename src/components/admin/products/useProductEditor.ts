"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { api } from "@convex/_generated/api";
import type { Category } from "@convex/catalog/rules";
import { formToCreateArgs, formToPatch, validateForm, withCategory, withNameEn } from "@/lib/admin/productForm";
import type { ProductFormState, ResolvedVariant } from "@/lib/admin/productForm";
import { editorFeedback, NO_FEEDBACK, splitFieldErrors } from "@/lib/admin/editorErrors";
import type { EditorFeedback } from "@/lib/admin/editorErrors";
import { canSave, closeDecision, editorReducer, initialEditorState } from "@/lib/admin/editorSession";
import type { EditorDropLink } from "./useProductActions";

export type StockChange = { current: number; next: number };

const NO_IDS: ReadonlySet<string> = new Set();

/**
 * Form state and save logic for the product editor. `rows` is the live admin
 * list; edit mode tracks its row so "Reload latest" can re-seed after a stale
 * save. Session transitions live in the pure `editorReducer`.
 */
export function useProductEditor(rows: ResolvedVariant[] | undefined) {
  const t = useTranslations("admin.products");
  const createVariant = useMutation(api.catalog.admin.createVariant);
  const updateVariant = useMutation(api.catalog.admin.updateVariant);

  const [state, dispatch] = useReducer(editorReducer, undefined, initialEditorState);
  const { session, form, initial } = state;
  const [feedback, setFeedback] = useState<EditorFeedback>(NO_FEEDBACK);
  const [saving, setSaving] = useState(false);
  const [pendingStock, setPendingStock] = useState<StockChange | null>(null);

  const liveRow = session?.mode === "edit" ? rows?.find((r) => r.variantId === session.variantId) : undefined;
  const isNew = session?.mode === "create";

  // Seeds a just-created product once its row arrives.
  useEffect(() => {
    if (liveRow) dispatch({ type: "rowUpdated", row: liveRow });
  }, [liveRow, session]);

  const resetTransient = () => {
    setFeedback(NO_FEEDBACK);
    setPendingStock(null);
  };

  const openCreate = useCallback(() => {
    resetTransient();
    dispatch({ type: "openCreate" });
  }, []);

  const openEdit = useCallback((row: ResolvedVariant) => {
    resetTransient();
    dispatch({ type: "openEdit", row });
  }, []);

  const close = useCallback(() => {
    setPendingStock(null);
    dispatch({ type: "close" });
  }, []);

  /** Escape, Cancel and the close button: guarded by `closeDecision`. */
  const requestClose = (blocked: boolean) => {
    const decision = closeDecision(state, { saving, blocked: blocked || pendingStock !== null });
    if (decision === "block") return;
    if (decision === "confirm" && !window.confirm(t("discardConfirm"))) return;
    close();
  };

  const edit = useCallback((fn: (f: ProductFormState) => ProductFormState) => dispatch({ type: "edit", fn }), []);
  const update = useCallback((changes: Partial<ProductFormState>) => edit((f) => ({ ...f, ...changes })), [edit]);
  const setCategory = useCallback((category: Category) => edit((f) => withCategory(f, category)), [edit]);
  const setNameEn = useCallback((nameEn: string) => edit((f) => withNameEn(f, nameEn, isNew)), [edit, isNew]);

  const reloadLatest = useCallback(() => {
    if (!liveRow) return;
    resetTransient();
    dispatch({ type: "reload", row: liveRow });
  }, [liveRow]);

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

  const commit = async () => {
    if (!session || !canSave(session)) return;
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
      if (Object.keys(patch).length > 0) {
        await updateVariant({ variantId: session.variantId, expectedUpdatedAt: session.version, patch });
      }
      close();
    } catch (err: unknown) {
      if (!(err instanceof ConvexError)) console.error("Failed to save product", err);
      setFeedback(editorFeedback(err instanceof ConvexError ? (err.data as unknown) : undefined));
    } finally {
      setSaving(false);
    }
  };

  /** Validate, then save; a cap's stock change in edit mode asks for confirmation first. */
  const requestSave = () => {
    if (!canSave(session)) return;
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

  const confirmStock = async () => {
    setPendingStock(null);
    await commit();
  };

  const savedColorwayIds = useMemo(
    () => (session?.mode === "edit" ? new Set(initial.colorways.map((c) => c.id)) : NO_IDS),
    [session?.mode, initial]
  );

  return {
    isOpen: session !== null,
    isNew,
    canSave: canSave(session),
    form,
    feedback,
    saving,
    liveRow,
    savedColorwayIds,
    pendingStock,
    openCreate,
    openEdit,
    close,
    requestClose,
    update,
    edit,
    setCategory,
    setNameEn,
    reloadLatest,
    dropLink,
    dismissFeedback: () => setFeedback(NO_FEEDBACK),
    requestSave,
    confirmStock,
    cancelStock: () => setPendingStock(null),
  };
}

export type ProductEditorState = ReturnType<typeof useProductEditor>;
