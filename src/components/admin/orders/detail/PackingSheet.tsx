"use client";

import { useId } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Archive, X } from "lucide-react";
import { AdminModal } from "@/components/admin/AdminModal";
import type { PackingLine } from "@/lib/admin/orderDetail";

/** The item big enough to match against the physical piece (D13a). */
export function PackingSheet({ line, onClose }: { line: PackingLine | null; onClose: () => void }) {
  const t = useTranslations("admin.orderDetail.packing");
  const titleId = useId();
  return (
    <AdminModal isOpen={Boolean(line)} onClose={onClose} labelledBy={titleId} maxWidthClass="max-w-xl">
      {line && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 block">{t("title")}</span>
              <h2 id={titleId} className="font-display font-bold text-lg text-zinc-950 dark:text-white truncate">{line.name}</h2>
            </div>
            <button type="button" onClick={onClose} aria-label={t("close")} className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-white/[0.06]"><X className="w-4 h-4" /></button>
          </div>
          <div className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden bg-zinc-100 dark:bg-white/[0.04]">
            {line.image && <Image src={line.image} alt="" fill sizes="(max-width: 640px) 100vw, 576px" className="object-cover" priority />}
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2 flex items-baseline justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3">
              <dt className="text-xs font-semibold text-amber-700 dark:text-amber-300">{t("quantity")}</dt>
              <dd className="text-3xl font-display font-bold text-zinc-950 dark:text-white tabular-nums">×{line.quantity}</dd>
            </div>
            {line.colorway && (<div><dt className="text-[11px] text-zinc-500">{t("colorway")}</dt><dd className="font-semibold text-zinc-900 dark:text-white">{line.colorway}</dd></div>)}
            {line.size && (<div><dt className="text-[11px] text-zinc-500">{t("size")}</dt><dd className="font-semibold text-zinc-900 dark:text-white">{line.size}</dd></div>)}
            <div className="col-span-2"><dt className="text-[11px] text-zinc-500">{t("slug")}</dt><dd className="font-mono text-xs text-zinc-700 dark:text-zinc-300">{line.slug}</dd></div>
          </dl>
          {line.lifestyleImage && (
            <div>
              <p className="text-[11px] text-zinc-500 mb-1.5">{t("lifestyle")}</p>
              <div className="relative w-full aspect-[4/5] max-h-72 rounded-2xl overflow-hidden bg-zinc-100 dark:bg-white/[0.04]">
                <Image src={line.lifestyleImage} alt="" fill sizes="576px" className="object-cover" />
              </div>
            </div>
          )}
          {line.archived && <p className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400"><Archive className="w-4 h-4" /> {t("archived")}</p>}
        </>
      )}
    </AdminModal>
  );
}
