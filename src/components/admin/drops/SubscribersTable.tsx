"use client";

import { useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, Mail, MessageCircle, Search } from "lucide-react";
import { useAdminShortcuts } from "@/components/admin/products/useAdminShortcuts";
import { csvFilename, csvText, filterSubscribers, toCsvRows } from "@/lib/admin/subscribersCsv";
import type { SubscriberInput } from "@/lib/admin/subscribersCsv";

export function SubscribersTable({ subscribers }: { subscribers: SubscriberInput[] | undefined }) {
  const t = useTranslations("admin.drops.subscribers");
  const locale = useLocale() as "en" | "es";
  const [q, setQ] = useState("");
  const [variantId, setVariantId] = useState<string>("all");
  const searchRef = useRef<HTMLInputElement>(null);
  useAdminShortcuts({ "/": () => searchRef.current?.focus() });

  const products = useMemo(() => {
    const seen = new Map<string, string>();
    for (const s of subscribers ?? []) seen.set(s.variantId, locale === "es" ? s.variantNameEs : s.variantNameEn);
    return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [subscribers, locale]);
  const rows = useMemo(() => filterSubscribers(subscribers ?? [], { q, variantId }), [subscribers, q, variantId]);

  const exportCsv = () => {
    const blob = new Blob([csvText(toCsvRows(rows, locale))], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = csvFilename(Date.now());
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-display font-bold text-zinc-950 dark:text-white">{t("title")} <span className="font-mono text-zinc-500 font-normal">({rows.length})</span></h2>
        <button type="button" onClick={exportCsv} disabled={rows.length === 0} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/[0.06] disabled:opacity-50">
          <Download className="w-3.5 h-3.5" /> {t("export")}
        </button>
      </div>
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          <input ref={searchRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} aria-label={t("search")} className="w-full py-2 pl-9 pr-3 text-sm rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-moya-red" />
        </div>
        <select value={variantId} onChange={(e) => setVariantId(e.target.value)} aria-label={t("product")} className="py-2 px-3 text-sm rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/10 text-zinc-900 dark:text-white">
          <option value="all">{t("allProducts")}</option>
          {products.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
        </select>
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-xs text-zinc-500">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
          {rows.map((s) => (
            <li key={s._id} className="py-2.5 grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-x-4 gap-y-0.5 text-xs items-center">
              <span className="font-mono text-zinc-900 dark:text-white truncate flex items-center gap-1.5">
                {s.channel === "email" ? <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> : <MessageCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                {s.contact}
              </span>
              <span className="text-zinc-600 dark:text-zinc-400 truncate">{s.name ?? "—"}</span>
              <span className="text-zinc-700 dark:text-zinc-300 truncate">{locale === "es" ? s.variantNameEs : s.variantNameEn}</span>
              <span className="font-mono text-[11px] text-zinc-500">{new Date(s.createdAt).toLocaleDateString(locale, { dateStyle: "medium" })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
