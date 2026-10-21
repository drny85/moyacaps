"use client";

import { useTranslations } from "next-intl";
import type { HomeVM } from "@/lib/admin/homeView";

/** Paid revenue and order counts for today, the last 7 and the last 30 local days. */
export function RevenueTiles({ tiles }: { tiles: HomeVM["tiles"] }) {
  const t = useTranslations("admin.home.tiles");
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {tiles.map((tile) => (
        <div key={tile.id} className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-xs">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-semibold">{t(tile.id)}</span>
          <div className="mt-2 text-2xl sm:text-3xl font-display font-bold text-zinc-950 dark:text-white tracking-tight tabular-nums">{tile.revenueLabel}</div>
          <div className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400">{t("orders", { count: tile.orders })}</div>
        </div>
      ))}
    </div>
  );
}
