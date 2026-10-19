"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { Flame, Plus } from "lucide-react";
import { api } from "@convex/_generated/api";
import { Link } from "@/i18n/routing";
import { FeedbackBanner } from "@/components/admin/products/FeedbackBanner";
import { ProductActionDialogs } from "@/components/admin/products/ProductActionDialogs";
import { ProductEditor } from "@/components/admin/products/ProductEditor";
import { ProductList } from "@/components/admin/products/ProductList";
import { ProductMetrics } from "@/components/admin/products/ProductMetrics";
import type { ProductRowHandlers } from "@/components/admin/products/ProductRow";
import { useProductActions } from "@/components/admin/products/useProductActions";
import { useProductEditor } from "@/components/admin/products/useProductEditor";

export default function AdminProductsPage() {
  const t = useTranslations("admin.products");
  const locale = useLocale();
  const [showArchived, setShowArchived] = useState(false);
  const data = useQuery(api.catalog.admin.getAllProductsAdmin, { includeArchived: showArchived });
  const editor = useProductEditor(data?.variants);
  const actions = useProductActions(locale);

  const handlers: ProductRowHandlers = {
    onStock: actions.requestStock,
    onSkus: actions.openSkus,
    onAvailability: actions.requestAvailability,
    onFeatured: actions.toggleFeatured,
    onEdit: editor.openEdit,
    onArchive: actions.requestArchive,
    onRestore: actions.restore,
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-moya-red font-bold">{t("eyebrow")}</span>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-950 dark:text-white tracking-tight">{t("title")}</h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{t("subtitle")}</p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/drops"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.1] text-zinc-900 dark:text-white text-xs font-semibold transition-all border border-zinc-200 dark:border-white/[0.08]"
          >
            <Flame className="w-4 h-4 text-moya-red" />
            <span>{t("dropsDesk")}</span>
          </Link>
          <button
            onClick={editor.openCreate}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-moya-red hover:bg-moya-red-light text-white text-xs font-semibold shadow-md shadow-moya-red/20 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{t("addProduct")}</span>
          </button>
        </div>
      </div>

      <ProductMetrics rows={data?.variants ?? []} />
      <FeedbackBanner banner={actions.error} onDismiss={actions.clearError} />

      <ProductList
        rows={data?.variants}
        locale={locale}
        showArchived={showArchived}
        onShowArchived={setShowArchived}
        updatingStockId={actions.updatingStockId}
        flashStockId={actions.flashStockId}
        handlers={handlers}
      />

      <ProductEditor editor={editor} locale={locale} blockClose={actions.dropTarget !== null} onScheduleDrop={actions.openDropSchedule} />
      <ProductActionDialogs actions={actions} />
    </div>
  );
}
