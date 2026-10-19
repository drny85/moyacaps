"use client";

import React, { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { Archive, ArchiveRestore, ArrowLeft, ImagePlus, Loader2, PackageX, Undo2 } from "lucide-react";
import { api } from "@convex/_generated/api";
import StockConfirmDialog from "@/components/admin/StockConfirmDialog";
import { Link, useRouter } from "@/i18n/routing";
import { DetailsSection } from "./DetailsSection";
import { DropSection } from "./DropSection";
import { EmptyState } from "./EmptyState";
import { FeedbackBanner } from "./FeedbackBanner";
import { PricingStockSection } from "./PricingStockSection";
import { ProductActionDialogs } from "./ProductActionDialogs";
import { ProductHistory } from "./ProductHistory";
import { ProductImagesPanel } from "./ProductImagesPanel";
import { StaleValuesPanel } from "./StaleValuesPanel";
import { TeeOptionsEditor } from "./TeeOptionsEditor";
import { sectionClass, sectionTitleClass } from "./editorFields";
import { useAdminShortcuts } from "./useAdminShortcuts";
import { useProductActions } from "./useProductActions";
import { useProductEditor } from "./useProductEditor";
import type { EditorTarget, ProductEditorState } from "./useProductEditor";
import { useUnsavedChangesGuard } from "./useUnsavedChangesGuard";

const LIST_HREF = "/admin/products";
const FORM_ID = "product-form";

const ghostBtn =
  "inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 disabled:opacity-40 transition-colors";
const saveBtn =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-moya-red hover:bg-moya-red-light text-white text-xs font-semibold shadow-md shadow-moya-red/20 disabled:opacity-50 transition-colors";

function SaveButtons({ editor, onDiscard, className }: { editor: ProductEditorState; onDiscard: () => void; className: string }) {
  const t = useTranslations("admin.products.editor");
  return (
    <div className={className}>
      <button type="button" onClick={onDiscard} disabled={!editor.isDirty || editor.saving} className={ghostBtn}>
        <Undo2 className="w-3.5 h-3.5" /> {t("discard")}
      </button>
      <button type="submit" form={FORM_ID} disabled={editor.saving || !editor.canSave} className={saveBtn}>
        {editor.saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        <span>{editor.saving ? t("saving") : editor.isNew ? t("create") : t("save")}</span>
        <kbd className="hidden lg:inline font-mono text-[10px] opacity-70">⌘S</kbd>
      </button>
    </div>
  );
}

/**
 * The product editor page (screen 2): images left, form sections right on desktop; one
 * column with a sticky Save bar on phone. One Save is one `createVariant`/`updateVariant`.
 */
export function ProductEditorPage({ target }: { target: EditorTarget }) {
  const t = useTranslations("admin.products.editor");
  const tProducts = useTranslations("admin.products");
  const locale = useLocale();
  const router = useRouter();
  const data = useQuery(api.catalog.admin.getAllProductsAdmin, { includeArchived: true });
  const editor = useProductEditor(target, data?.variants);
  const actions = useProductActions(locale);
  const { form, feedback, liveRow, isNew, isArchived } = editor;
  const discardMessage = tProducts("discardConfirm");

  useUnsavedChangesGuard(editor.isDirty, discardMessage);

  const createdId = editor.createdVariantId;
  useEffect(() => {
    if (createdId) router.replace(`${LIST_HREF}/${createdId}`);
  }, [createdId, router]);

  const leave = () => {
    if (editor.isDirty && !window.confirm(discardMessage)) return;
    router.push(LIST_HREF);
  };
  const discard = () => {
    if (window.confirm(discardMessage)) editor.discard();
  };

  useAdminShortcuts({
    "mod+s": () => editor.requestSave(),
    escape: leave,
  });

  const name = (locale === "es" ? form.nameEs : form.nameEn) || (isNew ? t(form.category === "apparel" ? "newTee" : "newCap") : form.variantId);
  const colorwayName = (id: string) => {
    const c = liveRow?.colorways?.find((x) => x.id === id);
    return c ? (locale === "es" ? c.nameEs : c.nameEn) : id;
  };
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    editor.requestSave();
  };

  if (editor.notFound) {
    return (
      <EmptyState icon={<PackageX className="w-10 h-10" />} title={t("notFound")}>
        <Link href={LIST_HREF} className={ghostBtn}>
          <ArrowLeft className="w-3.5 h-3.5" /> {t("backToProducts")}
        </Link>
      </EmptyState>
    );
  }
  if (editor.loading) {
    return (
      <div className="flex items-center justify-center py-24 text-xs font-mono text-zinc-500 gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> {t("loading")}
      </div>
    );
  }

  return (
    <div className="pb-28 sm:pb-12 space-y-5">
      <header className="sticky -top-4 sm:-top-6 lg:-top-8 z-20 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 bg-zinc-50/90 dark:bg-[#07070c]/90 backdrop-blur border-b border-zinc-200 dark:border-white/[0.06] flex items-center gap-3">
        <Link href={LIST_HREF} className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white shrink-0">
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">{t("backToProducts")}</span>
        </Link>
        <h1 className="min-w-0 truncate font-display font-bold text-lg text-zinc-900 dark:text-white">{name}</h1>
        {editor.isDirty && (
          <span className="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-500" aria-hidden /> <span className="hidden sm:inline">{t("unsaved")}</span>
            <span className="sr-only sm:hidden">{t("unsaved")}</span>
          </span>
        )}
        {!isArchived && <SaveButtons editor={editor} onDiscard={discard} className="ml-auto hidden sm:flex items-center gap-2" />}
      </header>

      {isArchived && (
        <div role="status" className="p-4 rounded-2xl border border-zinc-300 dark:border-white/10 bg-zinc-100 dark:bg-white/[0.04] flex items-center justify-between gap-3 text-xs">
          <span className="text-zinc-700 dark:text-zinc-300">{t("archivedBanner")}</span>
          <button type="button" onClick={() => void editor.restore()} className={ghostBtn}>
            <ArchiveRestore className="w-3.5 h-3.5" /> {t("restoreToEdit")}
          </button>
        </div>
      )}

      <FeedbackBanner
        banner={feedback.banner}
        formErrors={feedback.formErrors}
        colorwayName={colorwayName}
        onDismiss={editor.dismissFeedback}
        onReload={liveRow ? editor.reloadLatest : undefined}
      />
      {editor.unsaved && <StaleValuesPanel form={form} unsaved={editor.unsaved} onApply={editor.reapply} onDismiss={editor.dismissUnsaved} />}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-5 items-start">
        <fieldset disabled={isArchived} className="min-w-0 space-y-4">
          {liveRow && !isNew ? (
            <ProductImagesPanel variantId={liveRow.variantId} colorways={liveRow.colorways} defaultColorway={liveRow.defaultColorway} locale={locale} />
          ) : (
            <div className={`${sectionClass} flex flex-col items-center justify-center text-center gap-2 aspect-[4/5] max-h-[28rem]`}>
              <ImagePlus className="w-10 h-10 text-zinc-400" />
              <p className="text-zinc-600 dark:text-zinc-400">{tProducts("imagesAfterCreate")}</p>
            </div>
          )}
        </fieldset>

        <form id={FORM_ID} onSubmit={onSubmit} noValidate className="min-w-0">
          <fieldset disabled={isArchived || editor.saving} className="space-y-4 min-w-0">
            <DetailsSection form={form} feedback={feedback} isNew={isNew} onChange={editor.update} onCategory={editor.setCategory} onNameEn={editor.setNameEn} />
            <PricingStockSection form={form} feedback={feedback} onChange={editor.update} />
            {form.category === "apparel" && (
              <TeeOptionsEditor
                form={form}
                feedback={feedback}
                savedColorwayIds={editor.savedColorwayIds}
                printPosition={liveRow?.printPosition}
                locale={locale}
                saved={
                  liveRow && !isNew
                    ? {
                        variantId: liveRow.variantId,
                        productName: locale === "es" ? liveRow.nameEs : liveRow.nameEn,
                        skus: liveRow.skus,
                        colorways: liveRow.colorways ?? [],
                        sizes: liveRow.sizes ?? [],
                      }
                    : undefined
                }
                onChange={editor.edit}
              />
            )}
            <DropSection row={editor.canSave ? liveRow : undefined} locale={locale} onSchedule={(row) => actions.openDropSchedule(row, editor.dropLink())} />
          </fieldset>
          <div className="space-y-4 mt-4">
            {liveRow && <ProductHistory variantId={liveRow.variantId} />}
            {liveRow && !isArchived && (
              <section className={`${sectionClass} border-red-500/30`}>
                <h3 className={`${sectionTitleClass} text-red-600 dark:text-red-400`}>{t("danger")}</h3>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-zinc-600 dark:text-zinc-400">{editor.isDirty ? t("archiveSaveFirst") : t("archiveHint")}</p>
                  <button
                    type="button"
                    disabled={editor.isDirty}
                    onClick={() => actions.requestArchive(liveRow.variantId)}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-500/40 text-red-600 dark:text-red-400 hover:bg-red-500/10 font-semibold disabled:opacity-40"
                  >
                    <Archive className="w-3.5 h-3.5" /> {tProducts("archive")}
                  </button>
                </div>
              </section>
            )}
          </div>
        </form>
      </div>

      {!isArchived && (
        <SaveButtons
          editor={editor}
          onDiscard={discard}
          className="sm:hidden fixed inset-x-0 bottom-0 z-30 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] bg-white/95 dark:bg-[#0c0c14]/95 backdrop-blur border-t border-zinc-200 dark:border-white/10 grid grid-cols-2 gap-2"
        />
      )}

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
      <ProductActionDialogs actions={actions} />
    </div>
  );
}
