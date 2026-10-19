"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { AdminModal } from "@/components/admin/AdminModal";
import AvailabilityConfirmDialog from "@/components/admin/AvailabilityConfirmDialog";
import { DropScheduleDialog } from "@/components/admin/DropScheduleDialog";
import StockConfirmDialog from "@/components/admin/StockConfirmDialog";
import { TeeSkuStockDialog } from "@/components/admin/TeeSkuStockDialog";
import type { ProductActions } from "./useProductActions";

/** The confirm dialogs behind the product list's quick actions, mounted once. */
export function ProductActionDialogs({ actions }: { actions: ProductActions }) {
  const t = useTranslations("admin.products");

  return (
    <>
      <TeeSkuStockDialog variantId={actions.skuVariantId} onClose={actions.closeSkus} />

      <StockConfirmDialog
        target={actions.stockTarget}
        isOpen={actions.stockTarget !== null}
        onClose={actions.cancelStock}
        onConfirm={actions.confirmStock}
        isProcessing={actions.busy}
      />

      <AvailabilityConfirmDialog
        target={actions.availabilityTarget}
        isOpen={actions.availabilityTarget !== null}
        onClose={actions.cancelAvailability}
        onConfirm={actions.confirmAvailability}
        isProcessing={actions.busy}
      />

      <DropScheduleDialog
        target={actions.dropTarget}
        isOpen={actions.dropTarget !== null}
        onClose={actions.closeDropSchedule}
        onSave={actions.saveDropSchedule}
        isProcessing={actions.busy}
      />

      <AdminModal isOpen={actions.archiveId !== null} onClose={actions.cancelArchive} isProcessing={actions.busy} labelledBy="archive-title" maxWidthClass="max-w-md">
        <div className="space-y-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 id="archive-title" className="font-display font-bold text-lg text-zinc-900 dark:text-white">
            {t("archiveTitle")}
          </h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {t("archiveConfirm")} <span className="font-mono font-bold text-zinc-900 dark:text-white">{actions.archiveId}</span>
          </p>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={actions.cancelArchive}
              className="flex-1 py-2 px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
            >
              {t("archiveKeep")}
            </button>
            <button
              onClick={actions.confirmArchive}
              disabled={actions.busy}
              className="flex-1 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors shadow-md shadow-red-600/20 disabled:opacity-50"
            >
              {t("archiveAction")}
            </button>
          </div>
        </div>
      </AdminModal>
    </>
  );
}
