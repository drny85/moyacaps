"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Calendar, Flame, Radio, Trash2, Users } from "lucide-react";
import type { DropCardVM } from "@/lib/admin/dropCard";

const STATUS: Record<DropCardVM["status"], string> = {
  scheduled: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  live: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  archived: "bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-white/10",
};

export function DropCard({ vm, busy, onRelease, onReschedule, onCancel, onDelete }: {
  vm: DropCardVM;
  busy: boolean;
  onRelease: () => void;
  onReschedule: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("admin.drops");
  const c = vm.countdown;
  return (
    <article className="rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/[0.06] bg-white dark:bg-[#0c0c14] shadow-xs flex flex-col">
      <div className="relative aspect-[4/5] bg-zinc-100 dark:bg-white/[0.04]">
        {vm.image && <Image src={vm.image} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />}
        <span className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${STATUS[vm.status]}`}>
          {vm.status === "live" ? <Radio className="w-3 h-3" /> : <Calendar className="w-3 h-3" />} {t(`status.${vm.status}`)}
        </span>
      </div>
      <div className="p-4 space-y-3 flex-1 flex flex-col">
        <div>
          <h3 className="font-display font-bold text-sm text-zinc-950 dark:text-white truncate">{vm.name}</h3>
          {vm.badge && <p className="text-[11px] text-moya-red font-semibold truncate">{vm.badge}</p>}
          {vm.dateLabel && <p className="text-[11px] font-mono text-zinc-500">{vm.status === "scheduled" ? t("card.launches", { when: vm.dateLabel }) : t("card.launched", { when: vm.dateLabel })}</p>}
        </div>
        {c && !c.past && (
          <p className="text-lg font-display font-bold text-zinc-900 dark:text-white tabular-nums">{`${c.d}d ${c.h}h ${c.m}m ${c.s}s`}</p>
        )}
        <p className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-3">
          <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {t("card.subscribers", { count: vm.subscribers })}</span>
          <span>{t("card.stock", { count: vm.stock })}</span>
        </p>
        <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
          {vm.canRelease && (
            <button type="button" onClick={onRelease} disabled={busy} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold shadow-xs disabled:opacity-60">
              <Flame className="w-3.5 h-3.5" /> {t("card.release")}
            </button>
          )}
          {vm.canReschedule && (
            <button type="button" onClick={onReschedule} disabled={busy} className="px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-white/10 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/[0.06] disabled:opacity-60">
              {t("card.reschedule")}
            </button>
          )}
          {vm.canCancel && (
            <button type="button" onClick={onCancel} disabled={busy} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 disabled:opacity-60">
              {t("card.cancel")}
            </button>
          )}
          <button type="button" onClick={onDelete} disabled={busy} aria-label={t("card.delete")} title={t("card.delete")} className="ml-auto p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 disabled:opacity-60">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </article>
  );
}
