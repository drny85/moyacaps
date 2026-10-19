"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@convex/_generated/api";
import type { Category } from "@convex/catalog/rules";
import {
  emptyForm,
  formFromVariant,
  formToCreateArgs,
  formToPatch,
  validateForm,
  withCategory,
  withNameEn,
} from "@/lib/admin/productForm";
import type { ProductFormState, ResolvedVariant } from "@/lib/admin/productForm";
import { editorFeedback, NO_FEEDBACK, splitFieldErrors } from "@/lib/admin/editorErrors";
import type { EditorFeedback } from "@/lib/admin/editorErrors";

/** `version` is the row's `updatedAt` the form was seeded from; null while a just-created row loads. */
type Session = { mode: "create" } | { mode: "edit"; variantId: string; version: number | null };

export type StockChange = { current: number; next: number };

const NO_IDS: ReadonlySet<string> = new Set();

/**
 * Form state and save logic for the product editor. `rows` is the live admin
 * list; edit mode tracks its row so "Reload latest" can re-seed after a stale save.
 */
export function useProductEditor(rows: ResolvedVariant[] | undefined) {
  const createVariant = useMutation(api.catalog.admin.createVariant);
  const updateVariant = useMutation(api.catalog.admin.updateVariant);

  const [session, setSession] = useState<Session | null>(null);
  const [form, setForm] = useState<ProductFormState>(() => emptyForm("headwear"));
  const [initial, setInitial] = useState<ProductFormState>(form);
  const [feedback, setFeedback] = useState<EditorFeedback>(NO_FEEDBACK);
  const [saving, setSaving] = useState(false);
  const [pendingStock, setPendingStock] = useState<StockChange | null>(null);

  const liveRow = session?.mode === "edit" ? rows?.find((r) => r.variantId === session.variantId) : undefined;
  const isNew = session?.mode === "create";

  const seed = useCallback((row: ResolvedVariant) => {
    const next = formFromVariant(row);
    setForm(next);
    setInitial(next);
    setFeedback(NO_FEEDBACK);
    setPendingStock(null);
    setSession({ mode: "edit", variantId: row.variantId, version: row.updatedAt ?? row._creationTime });
  }, []);

  // After a create, switch to editing the new (hidden) product once its row arrives.
  useEffect(() => {
    if (session?.mode === "edit" && session.version === null && liveRow) seed(liveRow);
  }, [session, liveRow, seed]);

  const openCreate = useCallback(() => {
    const blank = emptyForm("headwear");
    setForm(blank);
    setInitial(blank);
    setFeedback(NO_FEEDBACK);
    setPendingStock(null);
    setSession({ mode: "create" });
  }, []);

  const close = useCallback(() => {
    setSession(null);
    setPendingStock(null);
  }, []);

  const update = useCallback((changes: Partial<ProductFormState>) => setForm((f) => ({ ...f, ...changes })), []);
  const edit = useCallback((fn: (f: ProductFormState) => ProductFormState) => setForm(fn), []);
  const setCategory = useCallback((category: Category) => setForm((f) => withCategory(f, category)), []);
  const setNameEn = useCallback((nameEn: string) => setForm((f) => withNameEn(f, nameEn, isNew)), [isNew]);

  const reloadLatest = useCallback(() => {
    if (liveRow) seed(liveRow);
  }, [liveRow, seed]);

  const commit = async () => {
    if (!session) return;
    setSaving(true);
    setFeedback(NO_FEEDBACK);
    try {
      if (session.mode === "create") {
        const { variantId } = await createVariant(formToCreateArgs(form));
        setSession({ mode: "edit", variantId, version: null });
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
    form,
    feedback,
    saving,
    liveRow,
    savedColorwayIds,
    pendingStock,
    openCreate,
    openEdit: seed,
    close,
    update,
    edit,
    setCategory,
    setNameEn,
    reloadLatest,
    dismissFeedback: () => setFeedback(NO_FEEDBACK),
    requestSave,
    confirmStock,
    cancelStock: () => setPendingStock(null),
  };
}

export type ProductEditorState = ReturnType<typeof useProductEditor>;
