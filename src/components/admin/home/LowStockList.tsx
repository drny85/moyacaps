"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import type { HomeVM } from "@/lib/admin/homeView";

/** Caps and tee SKUs at or under the low-stock threshold; each row opens the Product editor. */
export function LowStockList({ rows, total }: { rows: HomeVM["lowStock"]; total: number }) {
  const t = useTranslations("admin.home.lowStock");
  return (
    <section className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 sm:p-6 shadow-xs">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <h2 className="text-sm font-display font-bold text-zinc-950 dark:text-white">{t("title")}</h2>
        <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">{total}</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-xs text-zinc-600 dark:text-zinc-400">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key}>
              <Link
                href={row.href}
                className="flex items-center gap-3 p-2.5 rounded-xl border border-zinc-100 dark:border-white/[0.04] bg-zinc-50/50 dark:bg-white/[0.01] hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden shrink-0">
                  {row.image && <Image src={row.image} alt="" fill sizes="40px" className="object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-semibold text-zinc-900 dark:text-white block truncate">{row.name}</span>
                  {row.detail && <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400">{row.detail}</span>}
                </div>
                <span
                  className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                    row.stock === 0
                      ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  }`}
                >
                  {t("left", { count: row.stock })}
                </span>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > rows.length && (
        <Link href="/admin/products?stock=low" className="mt-4 pt-3 border-t border-zinc-100 dark:border-white/[0.04] text-xs text-moya-red hover:underline font-semibold flex items-center gap-1">
          {t("viewAll", { count: total })} <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </section>
  );
}
