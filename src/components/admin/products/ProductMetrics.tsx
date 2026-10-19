"use client";

import { useTranslations } from "next-intl";
import type { ResolvedVariant } from "@/lib/admin/productForm";

function Metric({ label, value, valueClass = "text-zinc-900 dark:text-white" }: { label: string; value: string | number; valueClass?: string }) {
  return (
    <div className="p-4 rounded-xl bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] shadow-xs">
      <span className="text-[10px] font-mono uppercase text-zinc-600 dark:text-zinc-400 block">{label}</span>
      <span className={`text-xl font-display font-bold mt-1 block ${valueClass}`}>{value}</span>
    </div>
  );
}

/** Headline counts above the product list. */
export function ProductMetrics({ rows }: { rows: ResolvedVariant[] }) {
  const t = useTranslations("admin.products.metrics");
  const units = rows.reduce((sum, r) => sum + r.stock, 0);
  const count = (silhouette: string) => rows.filter((r) => r.silhouette === silhouette).length;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <Metric label={t("products")} value={rows.length} />
      <Metric label={t("units")} value={t("unitsValue", { count: units })} valueClass="text-emerald-600 dark:text-emerald-400" />
      <Metric label={t("silhouettes")} value={`${count("snapback")} / ${count("trucker")}`} />
      <Metric label={t("featured")} value={rows.filter((r) => r.isFeatured).length} valueClass="text-amber-500" />
    </div>
  );
}
