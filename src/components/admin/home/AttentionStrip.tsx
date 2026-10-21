"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import type { HomeVM, Tone } from "@/lib/admin/homeView";

const TONE: Record<Tone, string> = {
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  rose: "border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  purple: "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300",
  zinc: "border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0c0c14] text-zinc-500 dark:text-zinc-400",
};

/** Four queue counts, each a link into the matching desk filter (D18). */
export function AttentionStrip({ items }: { items: HomeVM["attention"] }) {
  const t = useTranslations("admin.home.attention");
  return (
    <div className="flex sm:grid sm:grid-cols-4 gap-3 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`shrink-0 min-w-[9.5rem] sm:min-w-0 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border transition-colors hover:brightness-95 dark:hover:brightness-125 ${TONE[item.tone]}`}
        >
          <span className="text-xs font-semibold">{t(item.id)}</span>
          <span className="text-xl font-display font-bold tabular-nums">{item.count}</span>
        </Link>
      ))}
    </div>
  );
}
