"use client";

import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { RotateCw } from "lucide-react";
import { api } from "@convex/_generated/api";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { toHomeVM } from "@/lib/admin/homeView";
import { QueryErrorBoundary } from "@/components/admin/QueryErrorBoundary";
import { EmptyState } from "@/components/admin/products/EmptyState";
import { AttentionStrip } from "./AttentionStrip";
import { BestSellers } from "./BestSellers";
import { HomeSkeleton } from "./HomeSkeleton";
import { LowStockList } from "./LowStockList";
import { RevenueChart } from "./RevenueChart";
import { RevenueTiles } from "./RevenueTiles";

function HomeBody() {
  const locale = useLocale() as "en" | "es";
  const clientTime = useMinuteClock();
  // Days bucket by the Administrator's local day; the server has no local time.
  const tzOffsetMinutes = new Date().getTimezoneOffset();
  const analytics = useQuery(api.analytics.functions.getAnalyticsAdmin, { clientTime, tzOffsetMinutes });
  const attention = useQuery(api.orders.desk.getOrdersAttentionStats, { clientTime });

  if (!analytics || !attention) return <HomeSkeleton />;
  const vm = toHomeVM(analytics, attention, locale);

  return (
    <div className="space-y-6">
      <AttentionStrip items={vm.attention} />
      <RevenueTiles tiles={vm.tiles} />
      <RevenueChart bars={vm.chart.bars} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LowStockList rows={vm.lowStock} total={vm.lowStockTotal} />
        <BestSellers rows={vm.bestSellers} />
      </div>
    </div>
  );
}

/** Admin Home (plan 0009 D18): what needs doing, how sales are going, what is running low. */
export function HomePage() {
  const t = useTranslations("admin");
  return (
    <div className="space-y-6 pb-12">
      <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-950 dark:text-white tracking-tight">{t("home.title")}</h1>
      <QueryErrorBoundary
        fallback={(retry) => (
          <EmptyState title={t("common.queryFailed")}>
            <button type="button" onClick={retry} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-semibold">
              <RotateCw className="w-3.5 h-3.5" /> {t("common.retry")}
            </button>
          </EmptyState>
        )}
      >
        <HomeBody />
      </QueryErrorBoundary>
    </div>
  );
}
