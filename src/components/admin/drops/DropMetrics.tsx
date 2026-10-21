"use client";

import { useTranslations } from "next-intl";
import { countdown } from "@/lib/admin/dropCard";
import type { DropMetrics as Metrics } from "@/lib/admin/dropCard";

export function DropMetrics({ metrics, now }: { metrics: Metrics; now: number }) {
  const t = useTranslations("admin.drops.metrics");
  const next = metrics.nextDropAt === undefined ? null : countdown(metrics.nextDropAt, now);
  const tile = (label: string, value: React.ReactNode) => (
    <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-4 shadow-xs">
      <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-semibold block">{label}</span>
      <span className="mt-1 block text-2xl font-display font-bold text-zinc-950 dark:text-white tabular-nums">{value}</span>
    </div>
  );
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {tile(t("scheduled"), metrics.scheduled)}
      {tile(t("live"), metrics.live)}
      {tile(t("subscribers"), metrics.subscribers)}
      {tile(t("next"), next && !next.past ? `${next.d}d ${next.h}h ${next.m}m ${next.s}s` : t("none"))}
    </div>
  );
}
