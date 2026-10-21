"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import type { HomeVM } from "@/lib/admin/homeView";

/** Top Products by units sold over the chart window. */
export function BestSellers({ rows }: { rows: HomeVM["bestSellers"] }) {
  const t = useTranslations("admin.home.bestSellers");
  return (
    <section className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-xs">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-4 h-4 text-moya-red" />
        <h2 className="text-sm font-display font-bold text-zinc-950 dark:text-white">{t("title")}</h2>
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-xs text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.variantId} className="flex items-center gap-3 p-2.5 rounded-xl border border-zinc-100 dark:border-white/[0.04] bg-zinc-50/50 dark:bg-white/[0.01]">
              <span className="w-5 text-center font-mono font-bold text-xs text-zinc-500 dark:text-zinc-400">#{row.rank}</span>
              <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden shrink-0">
                {row.image && <Image src={row.image} alt="" fill sizes="40px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-zinc-900 dark:text-white block truncate">{row.name}</span>
                <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400">{row.variantId}</span>
              </div>
              <div className="text-right">
                <span className="text-xs font-mono font-bold text-zinc-900 dark:text-white block">{t("units", { count: row.units })}</span>
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">{row.revenueLabel}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
