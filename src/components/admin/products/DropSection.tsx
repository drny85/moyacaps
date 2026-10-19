"use client";

import { useTranslations } from "next-intl";
import { Radio } from "lucide-react";
import type { ResolvedVariant } from "@/lib/admin/productForm";
import { sectionClass, sectionTitleClass } from "./editorFields";

/** The product's VIP drop status; scheduling opens the shared drop dialog. */
export function DropSection({
  row,
  locale,
  onSchedule,
}: {
  row: ResolvedVariant | undefined;
  locale: string;
  onSchedule: (row: ResolvedVariant) => void;
}) {
  const t = useTranslations("admin.products");

  return (
    <section className={sectionClass}>
      <h3 className={sectionTitleClass}>{t("sections.drop")}</h3>
      {!row ? (
        <p className="text-[11px] text-zinc-500">{t("dropAfterCreate")}</p>
      ) : (
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10">
          <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
            {row.isDrop && row.dropDate
              ? t("dropScheduled", {
                  date: new Date(row.dropDate).toLocaleString(locale === "es" ? "es-ES" : "en-US", { dateStyle: "medium", timeStyle: "short" }),
                  count: row.subscribersCount,
                })
              : t("dropNone")}
          </span>
          <button
            type="button"
            onClick={() => onSchedule(row)}
            className="inline-flex items-center gap-1.5 shrink-0 px-2.5 py-1.5 rounded-lg bg-moya-red/15 text-moya-red border border-moya-red/30 hover:bg-moya-red/25 text-[11px] font-semibold"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{t("dropEdit")}</span>
          </button>
        </div>
      )}
    </section>
  );
}
