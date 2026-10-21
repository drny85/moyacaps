"use client";

import { useTranslations } from "next-intl";
import type { HomeVM } from "@/lib/admin/homeView";

/** 30 daily bars; the busiest day fills the height. */
export function RevenueChart({ bars }: { bars: HomeVM["chart"]["bars"] }) {
  const t = useTranslations("admin.home.chart");
  return (
    <section className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-xs">
      <h2 className="text-sm font-display font-bold text-zinc-950 dark:text-white">{t("title")}</h2>
      <p className="text-[11px] text-zinc-600 dark:text-zinc-400">{t("subtitle")}</p>
      <div className="mt-5 h-44 flex items-end gap-[3px] sm:gap-1.5 border-b border-zinc-100 dark:border-white/[0.04]" role="img" aria-label={t("title")}>
        {bars.map((bar) => (
          <div
            key={bar.date}
            title={`${bar.date} · ${bar.revenue} USD · ${bar.orders}`}
            style={{ height: `${bar.heightPct}%` }}
            className={`flex-1 rounded-t-md transition-[height] duration-500 ${
              bar.revenue > 0 ? "bg-gradient-to-t from-moya-red to-moya-red-light" : "bg-zinc-100 dark:bg-white/[0.04]"
            }`}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
        <span>{bars[0]?.date}</span>
        <span>{bars.at(-1)?.date}</span>
      </div>
    </section>
  );
}
