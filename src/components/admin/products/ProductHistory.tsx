"use client";

import { useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@convex/_generated/api";
import { formatChange } from "@/lib/admin/formatChange";
import { sectionClass, sectionTitleClass } from "./editorFields";

/** The Product's audit log, collapsed by default. */
export function ProductHistory({ variantId }: { variantId: string }) {
  const t = useTranslations("admin.products.history");
  const locale = useLocale();
  const events = useQuery(api.catalog.history.getVariantHistory, { variantId });
  const ctx = { locale, yes: t("yes"), no: t("no") };

  return (
    <details className={`${sectionClass} group`}>
      <summary className={`${sectionTitleClass} cursor-pointer select-none list-none flex items-center justify-between`}>
        {t("title")}
        <span aria-hidden className="text-zinc-400 transition-transform group-open:rotate-90">›</span>
      </summary>
      {events === undefined ? (
        <p className="text-[11px] text-zinc-500">{t("loading")}</p>
      ) : events.length === 0 ? (
        <p className="text-[11px] text-zinc-500">{t("empty")}</p>
      ) : (
        <ul className="space-y-2 max-h-56 overflow-y-auto">
          {events.map((event) => (
            <li
              key={event._id}
              className="p-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200 dark:border-white/10"
            >
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {t(`types.${event.type}`)}
                </span>
                <span className="text-zinc-500 font-mono">
                  {new Date(event.createdAt).toLocaleString(locale)}
                </span>
              </div>
              <p className="text-[10px] text-zinc-500 truncate">{event.actor}</p>
              {event.changes.map((change) => (
                <p
                  key={change.field}
                  className="text-[11px] font-mono text-zinc-700 dark:text-zinc-300 break-all"
                >
                  {formatChange(change, ctx)}
                </p>
              ))}
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
