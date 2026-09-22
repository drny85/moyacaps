"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/routing";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  DollarSign,
  Package,
  TrendingUp,
  MessageCircle,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Layers,
  Sparkles,
  CreditCard,
  Plus,
  Check,
  RotateCw,
} from "lucide-react";
import StockConfirmDialog, { StockConfirmTarget } from "@/components/admin/StockConfirmDialog";

export default function AdminAnalyticsPage() {
  const t = useTranslations("admin");
  const locale = useLocale();
  // Queries must not read the server wall clock (stale reactive caches), so the client
  // supplies a minute-granularity timestamp for the 7-day daily buckets.
  const [statsClock, setStatsClock] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setStatsClock(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);
  const analytics = useQuery(api.orders.getAnalyticsAdmin, { clientTime: statsClock });
  const adjustStock = useMutation(api.products.adjustVariantStock);

  const [restockingId, setRestockingId] = useState<string | null>(null);
  const [restockSuccess, setRestockSuccess] = useState<string | null>(null);
  const [stockConfirmTarget, setStockConfirmTarget] = useState<StockConfirmTarget | null>(null);
  const [isProcessingRestock, setIsProcessingRestock] = useState(false);

  const requestQuickRestock = (variant: any, amount: number) => {
    setStockConfirmTarget({
      variantId: variant.variantId,
      name: locale === "es" ? variant.nameEs : variant.nameEn,
      image: variant.image,
      currentStock: variant.stock,
      newStock: variant.stock + amount,
      delta: amount,
    });
  };

  const handleConfirmRestock = async () => {
    if (!stockConfirmTarget) return;
    try {
      setIsProcessingRestock(true);
      setRestockingId(stockConfirmTarget.variantId);
      await adjustStock({
        variantId: stockConfirmTarget.variantId,
        delta: stockConfirmTarget.delta,
      });
      setRestockSuccess(stockConfirmTarget.variantId);
      setTimeout(() => setRestockSuccess(null), 2000);
      setStockConfirmTarget(null);
    } catch (err) {
      console.error("Failed to adjust stock", err);
    } finally {
      setIsProcessingRestock(false);
      setRestockingId(null);
    }
  };

  if (!analytics) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-zinc-200 dark:bg-white/[0.06] rounded-xl w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 bg-zinc-200 dark:bg-white/[0.04] rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-72 bg-zinc-200 dark:bg-white/[0.04] rounded-2xl" />
          <div className="h-72 bg-zinc-200 dark:bg-white/[0.04] rounded-2xl" />
        </div>
      </div>
    );
  }

  const {
    totalRevenue,
    completedOrdersCount,
    totalOrdersCount,
    aov,
    whatsappPipeline,
    paymentBreakdown,
    statusCounts,
    topVariants,
    lowStockVariants,
    inventorySummary,
    dailySales,
  } = analytics;

  // Max daily revenue for proportional bars
  const maxDailyRevenue = Math.max(...dailySales.map((d) => d.revenue), 100);

  // Total completed channel volume
  const totalCompletedPaymentVol = (paymentBreakdown.stripe.revenue || 0) + (paymentBreakdown.whatsapp.revenue || 0);
  const stripePercent = totalCompletedPaymentVol > 0 ? Math.round((paymentBreakdown.stripe.revenue / totalCompletedPaymentVol) * 100) : 50;
  const whatsappPercent = 100 - stripePercent;

  return (
    <div className="space-y-8 pb-12">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-mono tracking-widest uppercase text-moya-red font-bold">
            Real-Time Operations Telemetry
          </span>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-950 dark:text-white tracking-tight">
            {t("metrics.grossRevenue")} & Insights
          </h1>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">
            Tracking customer order conversions, stock velocity, and WhatsApp concierge transactions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-moya-red hover:bg-moya-red-light text-white text-xs font-semibold shadow-md shadow-moya-red/20 transition-all active:scale-95"
          >
            <Package className="w-3.5 h-3.5" />
            <span>{t("nav.orders")}</span>
          </Link>
          <Link
            href="/admin/products"
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:bg-zinc-50 dark:hover:bg-white/[0.06] text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{t("nav.products")}</span>
          </Link>
        </div>
      </div>

      {/* ── Top 4 Key Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gross Revenue */}
        <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 text-zinc-100 dark:text-white/[0.03] pointer-events-none -mr-2 -mt-2 group-hover:scale-110 transition-transform">
            <DollarSign className="w-20 h-20" />
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-semibold">
              {t("metrics.grossRevenue")}
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-zinc-950 dark:text-white tracking-tight">
            ${totalRevenue.toLocaleString()} <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">USD</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{completedOrdersCount}</span> paid orders fulfilled
          </div>
        </div>

        {/* Completed Orders & AOV */}
        <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 text-zinc-100 dark:text-white/[0.03] pointer-events-none -mr-2 -mt-2 group-hover:scale-110 transition-transform">
            <TrendingUp className="w-20 h-20" />
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-semibold">
              {t("metrics.avgOrderValue")}
            </span>
            <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-zinc-950 dark:text-white tracking-tight">
            ${aov} <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">USD / ord</span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{totalOrdersCount}</span> total checkout attempts
          </div>
        </div>

        {/* WhatsApp Pipeline */}
        <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 text-zinc-100 dark:text-white/[0.03] pointer-events-none -mr-2 -mt-2 group-hover:scale-110 transition-transform">
            <MessageCircle className="w-20 h-20" />
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-semibold">
              {t("metrics.whatsappPipeline")}
            </span>
            <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <MessageCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-display font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
            ${whatsappPipeline.value.toLocaleString()} <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">USD</span>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{whatsappPipeline.count}</span> awaiting confirmation
          </div>
        </div>

        {/* Inventory Velocity & Stock Alerts */}
        <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-5 shadow-xs relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 text-zinc-100 dark:text-white/[0.03] pointer-events-none -mr-2 -mt-2 group-hover:scale-110 transition-transform">
            <AlertTriangle className="w-20 h-20" />
          </div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 font-semibold">
              {t("metrics.lowStockAlerts")}
            </span>
            <span className={`p-1.5 rounded-lg ${lowStockVariants.length > 0 ? "bg-amber-500/10 text-amber-500" : "bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-400"}`}>
              <AlertTriangle className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-display font-bold tracking-tight flex items-baseline gap-2">
            <span className={lowStockVariants.length > 0 ? "text-amber-500" : "text-zinc-900 dark:text-white"}>
              {lowStockVariants.length}
            </span>
            <span className="text-xs font-mono text-zinc-600 dark:text-zinc-400">
              of {inventorySummary.totalVariantsCount} Colorways
            </span>
          </div>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{inventorySummary.totalInventoryUnits}</span> total units available
          </div>
        </div>
      </div>

      {/* ── 7-Day Revenue Velocity & Payment Channel Split ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 7-Day Velocity Chart */}
        <div className="lg:col-span-2 bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-sm font-display font-bold text-zinc-950 dark:text-white">
                7-Day Revenue Velocity
              </h2>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                Daily closed sales volume across Stripe and confirmed WhatsApp payments.
              </p>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              USD Daily Total
            </span>
          </div>

          {/* Bar Chart Container */}
          <div className="h-44 flex items-end justify-between gap-2 sm:gap-4 pt-6 pb-2 px-2 border-b border-zinc-100 dark:border-white/[0.04]">
            {dailySales.map((d, index) => {
              const heightPercent = maxDailyRevenue > 0 ? Math.max(8, Math.round((d.revenue / maxDailyRevenue) * 100)) : 8;
              const dateLabel = new Date(d.date + "T12:00:00Z").toLocaleDateString(locale, { weekday: "short", day: "numeric" });

              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  {/* Tooltip on hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-1.5 py-0.5 rounded shadow-md pointer-events-none whitespace-nowrap">
                    ${d.revenue} ({d.orders} ord)
                  </div>

                  {/* Bar */}
                  <div
                    style={{ height: `${heightPercent}%` }}
                    className={`w-full max-w-[42px] rounded-t-lg transition-all duration-500 ${
                      d.revenue > 0
                        ? "bg-gradient-to-t from-moya-red to-moya-red-light group-hover:brightness-110 shadow-sm"
                        : "bg-zinc-100 dark:bg-white/[0.04]"
                    }`}
                  />

                  {/* Date label */}
                  <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400 truncate max-w-[48px] text-center">
                    {dateLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Channels Breakdown */}
        <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-display font-bold text-zinc-950 dark:text-white mb-1">
              Payment Method Breakdown
            </h2>
            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mb-6">
              Distribution of closed revenue by checkout channel.
            </p>

            {/* Proportion Bar */}
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-zinc-100 dark:bg-zinc-800 mb-6">
              <div
                style={{ width: `${stripePercent}%` }}
                className="bg-indigo-600 transition-all duration-500"
                title={`Stripe: ${stripePercent}%`}
              />
              <div
                style={{ width: `${whatsappPercent}%` }}
                className="bg-emerald-500 transition-all duration-500"
                title={`WhatsApp: ${whatsappPercent}%`}
              />
            </div>

            {/* Stats Breakdown */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/70 dark:border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-indigo-600 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white block">
                      Stripe Card Checkout
                    </span>
                    <span className="text-[10px] text-zinc-600 dark:text-zinc-400 font-mono">
                      {paymentBreakdown.stripe.orders} orders ({stripePercent}%)
                    </span>
                  </div>
                </div>
                <div className="text-xs font-mono font-bold text-zinc-900 dark:text-white">
                  ${paymentBreakdown.stripe.revenue.toLocaleString()}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/70 dark:border-white/[0.04]">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <span className="text-xs font-semibold text-zinc-900 dark:text-white block">
                      WhatsApp Concierge
                    </span>
                    <span className="text-[10px] text-zinc-600 dark:text-zinc-400 font-mono">
                      {paymentBreakdown.whatsapp.orders} orders ({whatsappPercent}%)
                    </span>
                  </div>
                </div>
                <div className="text-xs font-mono font-bold text-zinc-900 dark:text-white">
                  ${paymentBreakdown.whatsapp.revenue.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-zinc-100 dark:border-white/[0.04] flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
            <span>Active WhatsApp Leads:</span>
            <Link
              href="/admin/orders"
              className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              {whatsappPipeline.count} orders awaiting action <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Low Stock Attention Desk & Best Sellers ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Alerts */}
        <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-display font-bold text-zinc-950 dark:text-white">
                Low Stock Critical Alerts
              </h2>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold">
              {lowStockVariants.length} Colorways
            </span>
          </div>

          {lowStockVariants.length === 0 ? (
            <div className="py-8 text-center text-zinc-600 dark:text-zinc-400 text-xs">
              ✦ All 16 Colorways have healthy inventory levels (&gt; 5 units).
            </div>
          ) : (
            <div className="space-y-3">
              {lowStockVariants.slice(0, 5).map((variant) => {
                const isRestocking = restockingId === variant.variantId;
                const isSuccess = restockSuccess === variant.variantId;

                return (
                  <div
                    key={variant.variantId}
                    className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 dark:border-white/[0.04] bg-zinc-50/50 dark:bg-white/[0.01]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden shrink-0 border border-zinc-200 dark:border-white/10">
                        <Image
                          src={variant.image}
                          alt={variant.nameEn}
                          fill
                          className="object-contain p-1"
                        />
                      </div>
                      <div>
                        <span className="text-xs font-semibold text-zinc-900 dark:text-white block">
                          {locale === "es" ? variant.nameEs : variant.nameEn}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] font-mono uppercase text-zinc-600 dark:text-zinc-400">
                            {variant.silhouette}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300">
                            ${variant.priceUsd} USD
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md ${
                          variant.stock === 0
                            ? "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20"
                            : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        }`}
                      >
                        {variant.stock === 0 ? "SOLD OUT" : `${variant.stock} left`}
                      </span>

                      <button
                        onClick={() => requestQuickRestock(variant, 10)}
                        disabled={isRestocking}
                        className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:opacity-90 transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1"
                        title="Quick Replenish +10 units"
                      >
                        {isSuccess ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>+10</span>
                          </>
                        ) : isRestocking ? (
                          <RotateCw className="w-3 h-3 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            <span>+10</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-white/[0.04]">
            <Link
              href="/admin/products"
              className="text-xs text-moya-red hover:underline font-semibold flex items-center gap-1"
            >
              Open Caps & Colorways Studio <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Top-Selling Colorways */}
        <div className="bg-white dark:bg-[#0c0c14] border border-zinc-200 dark:border-white/[0.06] rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-moya-red" />
              <h2 className="text-sm font-display font-bold text-zinc-950 dark:text-white">
                Best-Selling Colorways
              </h2>
            </div>
            <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
              Ranked by units closed
            </span>
          </div>

          {topVariants.length === 0 ? (
            <div className="py-8 text-center text-zinc-600 dark:text-zinc-400 text-xs">
              No sales recorded yet. Completed orders will rank colorways here.
            </div>
          ) : (
            <div className="space-y-3">
              {topVariants.map((item, index) => (
                <div
                  key={item.variantId}
                  className="flex items-center justify-between p-3 rounded-xl border border-zinc-100 dark:border-white/[0.04] bg-zinc-50/50 dark:bg-white/[0.01]"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-center font-mono font-bold text-xs text-zinc-600 dark:text-zinc-400">
                      #{index + 1}
                    </span>
                    <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden shrink-0 border border-zinc-200 dark:border-white/10">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-contain p-1"
                      />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-zinc-900 dark:text-white block">
                        {item.name}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                        {item.variantId}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-mono font-bold text-zinc-900 dark:text-white block">
                      {item.units} units
                    </span>
                    <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400">
                      ${item.revenue.toLocaleString()} USD
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-white/[0.04]">
            <Link
              href="/admin/orders"
              className="text-xs text-moya-red hover:underline font-semibold flex items-center gap-1"
            >
              Inspect Complete Orders Feed <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Stock Confirmation Safeguard ── */}
      <StockConfirmDialog
        target={stockConfirmTarget}
        isOpen={Boolean(stockConfirmTarget)}
        onClose={() => setStockConfirmTarget(null)}
        onConfirm={handleConfirmRestock}
        isProcessing={isProcessingRestock}
      />
    </div>
  );
}
