"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Loader2, X } from "lucide-react";
import { AdminModal } from "@/components/admin/AdminModal";
import StockConfirmDialog from "@/components/admin/StockConfirmDialog";
import type { ResolvedVariant } from "@/lib/admin/productForm";
import { FeedbackBanner } from "./FeedbackBanner";
import { ProductDetailsFields } from "./ProductDetailsFields";
import { ProductDropSection } from "./ProductDropSection";
import { ProductHistory } from "./ProductHistory";
import { ProductImagesPanel } from "./ProductImagesPanel";
import { ProductPricingFields } from "./ProductPricingFields";
import { TeeOptionsEditor } from "./TeeOptionsEditor";
import { sectionClass } from "./editorFields";
import type { ProductEditorState } from "./useProductEditor";

/** Create/edit modal: Details · Pricing & Stock · Tee Options · Images · Drop · History. */
export function ProductEditor({
  editor,
  locale,
  blockClose,
  onScheduleDrop,
}: {
  editor: ProductEditorState;
  locale: string;
  /** True while a dialog opened from the editor sits on top of it. */
  blockClose: boolean;
  onScheduleDrop: (row: ResolvedVariant) => void;
}) {
  const t = useTranslations("admin.products");
  const { form, feedback, liveRow, isNew } = editor;
  const colorwayName = (id: string) => {
    const c = liveRow?.colorways?.find((x) => x.id === id);
    return c ? (locale === "es" ? c.nameEs : c.nameEn) : id;
  };
  const requestClose = () => editor.requestClose(blockClose);
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    editor.requestSave();
  };

  return (
    <>
      <AdminModal isOpen={editor.isOpen} onClose={requestClose} labelledBy="product-editor-title" maxWidthClass="max-w-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-white/[0.06]">
          <div>
            <h3 id="product-editor-title" className="font-display font-bold text-lg text-zinc-900 dark:text-white">
              {isNew ? t("addProduct") : t("editProduct")}
            </h3>
            <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-400">{t("editorSubtitle")}</span>
          </div>
          <button type="button" onClick={requestClose} className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4 text-xs">
          <FeedbackBanner
            banner={feedback.banner}
            formErrors={feedback.formErrors}
            colorwayName={colorwayName}
            onDismiss={editor.dismissFeedback}
            onReload={liveRow ? editor.reloadLatest : undefined}
          />

          <ProductDetailsFields
            form={form}
            feedback={feedback}
            isNew={isNew}
            onChange={editor.update}
            onCategory={editor.setCategory}
            onNameEn={editor.setNameEn}
          />
          <ProductPricingFields form={form} feedback={feedback} onChange={editor.update} />
          {form.category === "apparel" && (
            <TeeOptionsEditor
              form={form}
              feedback={feedback}
              savedColorwayIds={editor.savedColorwayIds}
              printPosition={liveRow?.printPosition}
              locale={locale}
              onChange={editor.edit}
            />
          )}

          {liveRow ? (
            <ProductImagesPanel variantId={liveRow.variantId} colorways={liveRow.colorways} locale={locale} />
          ) : (
            <p className={`${sectionClass} text-[11px] text-zinc-500`}>{t("imagesAfterCreate")}</p>
          )}
          <ProductDropSection row={liveRow} locale={locale} onSchedule={onScheduleDrop} />
          {liveRow && <ProductHistory variantId={liveRow.variantId} />}

          <div className="flex items-center gap-3 pt-3 border-t border-zinc-100 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={requestClose}
              className="flex-1 py-2.5 px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
            >
              {t("cancelBtn")}
            </button>
            <button
              type="submit"
              disabled={editor.saving || !editor.canSave}
              className="flex-1 py-2.5 px-3 rounded-xl bg-moya-red hover:bg-moya-red-light text-white text-xs font-semibold transition-colors shadow-md shadow-moya-red/20 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {editor.saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editor.saving ? t("saving") : isNew ? t("createVariant") : t("saveVariant")}</span>
            </button>
          </div>
        </form>
      </AdminModal>

      <StockConfirmDialog
        target={
          editor.pendingStock
            ? {
                variantId: form.variantId,
                name: locale === "es" ? form.nameEs : form.nameEn,
                silhouette: form.silhouette,
                image: liveRow?.image,
                primaryHex: form.primaryHex,
                secondaryHex: form.secondaryHex,
                currentStock: editor.pendingStock.current,
                newStock: editor.pendingStock.next,
                delta: editor.pendingStock.next - editor.pendingStock.current,
              }
            : null
        }
        isOpen={editor.pendingStock !== null}
        onClose={editor.cancelStock}
        onConfirm={editor.confirmStock}
        isProcessing={editor.saving}
      />
    </>
  );
}
