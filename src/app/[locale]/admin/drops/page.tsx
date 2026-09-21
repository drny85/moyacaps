"use client";

import React, { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  Flame,
  Radio,
  Calendar,
  Clock,
  Users,
  Search,
  Download,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Plus,
  Trash2,
  Archive,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Send,
  Loader2,
  RefreshCw,
  Eye,
  Filter,
  Layers,
  ArrowUpRight,
  Check,
  X,
} from "lucide-react";
import { AdminModal } from "@/components/admin/AdminModal";
import { DateTimePicker } from "@/components/admin/DateTimePicker";
import { Link } from "@/i18n/routing";

function CountdownDisplay({ targetTimestamp }: { targetTimestamp: number }) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isPast: boolean;
  }>({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: false });

  useEffect(() => {
    const update = () => {
      const diff = targetTimestamp - Date.now();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isPast: true });
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft({ days, hours, minutes, seconds, isPast: false });
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  if (timeLeft.isPast) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
        LAUNCHED / LIVE
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-zinc-900 dark:text-white">
      <div className="bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] px-2 py-1 rounded-md text-center min-w-[32px]">
        <span>{String(timeLeft.days).padStart(2, "0")}</span>
        <span className="block text-[8px] text-zinc-400 font-normal">D</span>
      </div>
      <span className="text-zinc-400">:</span>
      <div className="bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] px-2 py-1 rounded-md text-center min-w-[32px]">
        <span>{String(timeLeft.hours).padStart(2, "0")}</span>
        <span className="block text-[8px] text-zinc-400 font-normal">H</span>
      </div>
      <span className="text-zinc-400">:</span>
      <div className="bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] px-2 py-1 rounded-md text-center min-w-[32px]">
        <span>{String(timeLeft.minutes).padStart(2, "0")}</span>
        <span className="block text-[8px] text-zinc-400 font-normal">M</span>
      </div>
      <span className="text-zinc-400">:</span>
      <div className="bg-zinc-100 dark:bg-white/[0.06] border border-zinc-200 dark:border-white/[0.08] px-2 py-1 rounded-md text-center min-w-[32px] text-moya-red">
        <span>{String(timeLeft.seconds).padStart(2, "0")}</span>
        <span className="block text-[8px] text-moya-red/70 font-normal">S</span>
      </div>
    </div>
  );
}

export default function AdminDropsPage() {
  const t = useTranslations("admin.drops");
  const locale = useLocale();

  // Queries
  const dropsData = useQuery(api.products.getAllDropsAdmin);
  const productsData = useQuery(api.products.getAllProductsAdmin);
  const subscribersData = useQuery(api.products.getDropSubscribersList, {});

  // Mutations
  const scheduleDropMutation = useMutation(api.products.scheduleDrop);
  const releaseDropNowMutation = useMutation(api.products.releaseDropNow);
  const postponeDropMutation = useMutation(api.products.postponeDrop);
  const cancelDropMutation = useMutation(api.products.cancelDrop);
  const deleteDropMutation = useMutation(api.products.deleteDrop);

  // Local state
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editModalTarget, setEditModalTarget] = useState<any | null>(null);
  const [goLiveTarget, setGoLiveTarget] = useState<any | null>(null);
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deleteSubscribers, setDeleteSubscribers] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const getDefaultDropTimestamp = () => {
    const d = new Date(Date.now() + 86400000 * 3);
    d.setHours(6, 0, 0, 0);
    return d.getTime();
  };

  // Form state for scheduling
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [formDropTimestamp, setFormDropTimestamp] = useState<number>(getDefaultDropTimestamp);
  const [formBadgeEn, setFormBadgeEn] = useState("0880 Good Luck Vault Release");
  const [formBadgeEs, setFormBadgeEs] = useState("Lanzamiento de Bóveda 0880 Good Luck");
  const [formError, setFormError] = useState<string | null>(null);

  // Edit form state
  const [editDropTimestamp, setEditDropTimestamp] = useState<number>(getDefaultDropTimestamp);

  // Subscribers filters
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [selectedVariantFilter, setSelectedVariantFilter] = useState("all");

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  // Metrics computation
  const metrics = useMemo(() => {
    if (!dropsData) return { scheduled: 0, live: 0, totalSubscribers: 0, nextDropTime: null };
    let scheduled = 0;
    let live = 0;
    let totalSubscribers = 0;
    let nextDropTime: number | null = null;

    for (const d of dropsData) {
      totalSubscribers += d.subscribersCount || 0;
      if (d.computedStatus === "live") {
        live++;
      } else if (d.computedStatus === "scheduled") {
        scheduled++;
        if (d.dropDate && d.dropDate > Date.now()) {
          if (!nextDropTime || d.dropDate < nextDropTime) {
            nextDropTime = d.dropDate;
          }
        }
      }
    }

    return { scheduled, live, totalSubscribers, nextDropTime };
  }, [dropsData]);

  // Filtered subscribers
  const filteredSubscribers = useMemo(() => {
    if (!subscribersData) return [];
    return subscribersData.filter((sub) => {
      if (selectedVariantFilter !== "all" && sub.variantId !== selectedVariantFilter) {
        return false;
      }
      if (subscriberSearch.trim() !== "") {
        const q = subscriberSearch.toLowerCase();
        const contact = (sub.contact || "").toLowerCase();
        const name = (sub.name || "").toLowerCase();
        const vEn = (sub.variantNameEn || "").toLowerCase();
        const vEs = (sub.variantNameEs || "").toLowerCase();
        return contact.includes(q) || name.includes(q) || vEn.includes(q) || vEs.includes(q);
      }
      return true;
    });
  }, [subscribersData, subscriberSearch, selectedVariantFilter]);

  // Schedule new drop submission
  const handleScheduleSubmit = async () => {
    if (!selectedVariantId) {
      setFormError("Please select a colorway to schedule.");
      return;
    }
    try {
      setIsProcessing(true);
      setFormError(null);
      await scheduleDropMutation({
        variantId: selectedVariantId,
        dropDate: formDropTimestamp,
        dropBadgeTextEn: formBadgeEn.trim() || undefined,
        dropBadgeTextEs: formBadgeEs.trim() || undefined,
      });
      setScheduleModalOpen(false);
      showToast(t("dropSavedSuccess"));
    } catch (err: any) {
      setFormError(err?.message || "Failed to schedule drop.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Immediate Launch
  const handleGoLiveConfirm = async () => {
    if (!goLiveTarget) return;
    try {
      setIsProcessing(true);
      await releaseDropNowMutation({
        variantId: goLiveTarget.variantId,
        keepBadge: true,
      });
      setGoLiveTarget(null);
      showToast(t("dropLiveSuccess"));
    } catch (err: any) {
      alert("Error releasing drop: " + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Postpone / Edit schedule
  const handleEditScheduleConfirm = async () => {
    if (!editModalTarget) return;
    try {
      setIsProcessing(true);
      await postponeDropMutation({
        variantId: editModalTarget.variantId,
        newDropDate: editDropTimestamp,
      });
      setEditModalTarget(null);
      showToast(t("dropSavedSuccess"));
    } catch (err: any) {
      alert("Error updating schedule: " + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Cancel drop
  const handleCancelConfirm = async () => {
    if (!cancelTarget) return;
    try {
      setIsProcessing(true);
      await cancelDropMutation({
        variantId: cancelTarget.variantId,
      });
      setCancelTarget(null);
      showToast(t("dropCancelledSuccess"));
    } catch (err: any) {
      alert("Error cancelling drop: " + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  };

  // Permanently delete drop
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    try {
      setIsProcessing(true);
      await deleteDropMutation({
        variantId: deleteTarget.variantId,
        deleteSubscribers,
      });
      setDeleteTarget(null);
      showToast(t("dropDeletedSuccess"));
    } catch (err: any) {
      alert("Error deleting drop: " + (err?.message || err));
    } finally {
      setIsProcessing(false);
    }
  };


  // Export CSV of waitlist subscribers
  const exportSubscribersCSV = () => {
    if (!filteredSubscribers.length) return;
    const headers = ["Contact", "Channel", "Name", "Colorway", "Variant ID", "Registered At", "Locale"];
    const rows = filteredSubscribers.map((s) => [
      `"${s.contact}"`,
      `"${s.channel}"`,
      `"${s.name || ""}"`,
      `"${locale === "es" ? s.variantNameEs : s.variantNameEn}"`,
      `"${s.variantId}"`,
      `"${new Date(s.createdAt).toISOString()}"`,
      `"${s.locale}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `moya-caps-vip-subscribers-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Available variants not currently scheduled
  const availableVariantsToSchedule = useMemo(() => {
    if (!productsData?.variants) return [];
    return productsData.variants;
  }, [productsData]);

  return (
    <div className="flex-1 px-4 sm:px-8 py-8 max-w-7xl mx-auto w-full space-y-8">
      {/* ── Toast Notification ── */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 rounded-xl shadow-2xl border border-zinc-700/50 animate-in fade-in slide-in-from-bottom-5 duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
          <span className="text-xs font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-white/[0.06] pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-moya-red to-moya-red-deep text-white shadow-md shadow-moya-red/20">
              <Flame className="w-5 h-5" />
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-white">
              {t("title")}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-moya-red/10 border border-moya-red/30 text-moya-red">
              Live Operations
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 mt-1.5 max-w-2xl">
            {t("subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => {
              if (availableVariantsToSchedule.length > 0) {
                setSelectedVariantId(availableVariantsToSchedule[0].variantId);
              }
              setFormDropTimestamp(getDefaultDropTimestamp());
              setScheduleModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-moya-red hover:bg-moya-red/90 active:scale-95 text-white font-medium text-xs shadow-md shadow-moya-red/25 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t("scheduleNewDrop")}</span>
          </button>
        </div>
      </div>

      {/* ── Key Telemetry Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Scheduled Drops */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0a0a10] border border-zinc-200 dark:border-white/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">{t("metricScheduled")}</span>
            <div className="w-7 h-7 rounded-lg bg-moya-red/10 flex items-center justify-center text-moya-red">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
          </div>
          <div className="font-display text-2xl font-bold text-zinc-900 dark:text-white">
            {metrics.scheduled}
          </div>
        </div>

        {/* Live Drops */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0a0a10] border border-zinc-200 dark:border-white/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">{t("metricLive")}</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="font-display text-2xl font-bold text-zinc-900 dark:text-white">
            {metrics.live}
          </div>
        </div>

        {/* Total Subscribers */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0a0a10] border border-zinc-200 dark:border-white/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">{t("metricSubscribers")}</span>
            <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="font-display text-2xl font-bold text-zinc-900 dark:text-white">
            {metrics.totalSubscribers}
          </div>
        </div>

        {/* Next Launch */}
        <div className="p-4 rounded-2xl bg-white dark:bg-[#0a0a10] border border-zinc-200 dark:border-white/[0.06] shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-semibold">{t("metricNextDrop")}</span>
            <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            {metrics.nextDropTime ? (
              <CountdownDisplay targetTimestamp={metrics.nextDropTime} />
            ) : (
              <span className="text-xs text-zinc-400 font-mono">No drops pending</span>
            )}
          </div>
        </div>
      </div>

      {/* ── Active & Scheduled Drops Grid ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-moya-red" />
            <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
              {t("activeDrops")}
            </h2>
            <span className="text-xs font-mono text-zinc-500">({dropsData?.length || 0})</span>
          </div>
        </div>

        {(!dropsData || dropsData.length === 0) ? (
          <div className="p-12 text-center rounded-2xl bg-white dark:bg-[#0a0a10] border border-dashed border-zinc-200 dark:border-white/[0.08]">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-zinc-100 dark:bg-white/[0.04] flex items-center justify-center text-zinc-400 mb-3">
              <Flame className="w-6 h-6" />
            </div>
            <h3 className="font-display text-base font-bold text-zinc-900 dark:text-white">
              {t("noDropsScheduled")}
            </h3>
            <p className="text-xs text-zinc-500 max-w-md mx-auto mt-1 mb-4">
              {t("noDropsDesc")}
            </p>
            <button
              onClick={() => {
                if (availableVariantsToSchedule.length > 0) {
                  setSelectedVariantId(availableVariantsToSchedule[0].variantId);
                }
                setFormDropTimestamp(getDefaultDropTimestamp());
                setScheduleModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-moya-red hover:bg-moya-red/90 text-white text-xs font-medium"
            >
              <Plus className="w-4 h-4" />
              <span>{t("scheduleNewDrop")}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {dropsData.map((drop) => {
              const name = locale === "es" ? drop.nameEs : drop.nameEn;
              const badge = locale === "es" ? drop.dropBadgeTextEs || drop.dropBadgeTextEn : drop.dropBadgeTextEn;
              const isLive = drop.computedStatus === "live";
              const isScheduled = drop.computedStatus === "scheduled";

              return (
                <div
                  key={drop.variantId}
                  className="rounded-2xl bg-white dark:bg-[#0a0a10] border border-zinc-200 dark:border-white/[0.06] overflow-hidden shadow-sm flex flex-col justify-between hover:border-moya-red/30 transition-all duration-200"
                >
                  {/* Top Image & Status Banner */}
                  <div className="relative p-5 pb-3 bg-gradient-to-b from-zinc-50 to-white dark:from-white/[0.02] dark:to-transparent border-b border-zinc-100 dark:border-white/[0.04]">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      {isLive ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold uppercase tracking-wider">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                          {t("statusLive")}
                        </span>
                      ) : isScheduled ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-moya-red/10 border border-moya-red/20 text-moya-red text-[10px] font-mono font-bold uppercase tracking-wider">
                          <Radio className="w-3 h-3 animate-pulse" />
                          {t("statusScheduled")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-white/[0.06] text-zinc-500 text-[10px] font-mono font-bold uppercase tracking-wider">
                          {t("statusArchived")}
                        </span>
                      )}

                      <div className="flex items-center gap-1">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/10 shadow-sm"
                          style={{ backgroundColor: drop.primaryHex }}
                          title={`Primary: ${drop.primaryHex}`}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/10 shadow-sm"
                          style={{ backgroundColor: drop.secondaryHex }}
                          title={`Secondary: ${drop.secondaryHex}`}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="relative w-20 h-20 rounded-xl bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.06] overflow-hidden shrink-0 flex items-center justify-center">
                        <Image
                          src={drop.image}
                          alt={name}
                          fill
                          sizes="80px"
                          className="object-contain p-1"
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h3 className="font-display font-bold text-sm text-zinc-950 dark:text-white truncate" title={name}>
                          {name}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500 font-mono">
                          <span className="uppercase">{drop.silhouette}</span>
                          <span>•</span>
                          <span>${drop.priceUsd} USD</span>
                        </div>
                        {badge && (
                          <div className="mt-1.5 inline-block text-[10px] font-mono font-semibold text-moya-red truncate max-w-full bg-moya-red/5 px-2 py-0.5 rounded border border-moya-red/20">
                            {badge}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Telemetry Row */}
                  <div className="p-5 py-3.5 space-y-3">
                    {/* Launch / Countdown */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-zinc-500 flex items-center gap-1.5 font-mono text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        {isScheduled ? t("liveCountdown") : "Launch Status"}
                      </span>
                      {drop.dropDate ? (
                        <CountdownDisplay targetTimestamp={drop.dropDate} />
                      ) : (
                        <span className="text-xs text-zinc-400 font-mono">Not scheduled</span>
                      )}
                    </div>

                    {/* Stock & Subscribers */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 dark:border-white/[0.04]">
                      <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/[0.04]">
                        <span className="text-[10px] font-mono text-zinc-500 block uppercase">Available Stock</span>
                        <span className="font-mono text-sm font-bold text-zinc-900 dark:text-white">
                          {drop.stock} units
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-100 dark:border-white/[0.04]">
                        <span className="text-[10px] font-mono text-zinc-500 block uppercase">VIP Waitlist</span>
                        <span className="font-mono text-sm font-bold text-amber-500">
                          {drop.subscribersCount || 0} alert(s)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 bg-zinc-50/50 dark:bg-white/[0.01] border-t border-zinc-100 dark:border-white/[0.04] flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {isScheduled && (
                        <button
                          onClick={() => setGoLiveTarget(drop)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-medium text-xs shadow-sm transition-all"
                          title={t("goLiveNow")}
                        >
                          <Flame className="w-3.5 h-3.5" />
                          <span>{t("goLiveNow")}</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setEditModalTarget(drop);
                          setEditDropTimestamp(drop.dropDate || Date.now() + 86400000 * 3);
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-200/70 dark:bg-white/[0.06] hover:bg-zinc-300 dark:hover:bg-white/[0.1] text-zinc-800 dark:text-zinc-200 font-medium text-xs transition-all"
                        title={t("editSchedule")}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{t("editSchedule")}</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <Link
                        href={`/caps/${drop.variantId}`}
                        target="_blank"
                        className="p-1.5 rounded-lg hover:bg-zinc-200/60 dark:hover:bg-white/[0.06] text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"
                        title="Inspect on Storefront"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>

                      {drop.computedStatus !== "archived" && (
                        <button
                          onClick={() => setCancelTarget(drop)}
                          className="p-1.5 rounded-lg hover:bg-amber-500/10 text-zinc-400 hover:text-amber-500 transition-all"
                          title={t("archiveDrop")}
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setDeleteTarget(drop);
                          setDeleteSubscribers(true);
                        }}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-zinc-400 hover:text-rose-500 transition-all"
                        title={t("deleteDrop")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── VIP Subscribers Waitlist Desk ── */}
      <div className="space-y-4 pt-6 border-t border-zinc-200 dark:border-white/[0.06]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-500" />
            <h2 className="font-display text-lg font-bold text-zinc-900 dark:text-white">
              {t("subscribersWaitlist")}
            </h2>
            <span className="text-xs font-mono text-zinc-500">
              ({filteredSubscribers.length})
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter by variant */}
            <select
              value={selectedVariantFilter}
              onChange={(e) => setSelectedVariantFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#0a0a10] border border-zinc-200 dark:border-white/[0.08] text-xs font-medium text-zinc-700 dark:text-zinc-300 focus:outline-none focus:border-moya-red"
            >
              <option value="all">{t("filterColorway")}</option>
              {dropsData?.map((d) => (
                <option key={d.variantId} value={d.variantId}>
                  {locale === "es" ? d.nameEs : d.nameEn}
                </option>
              ))}
            </select>

            <button
              onClick={exportSubscribersCSV}
              disabled={filteredSubscribers.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 dark:bg-white/[0.06] hover:bg-zinc-200 dark:hover:bg-white/[0.1] disabled:opacity-50 text-xs font-medium text-zinc-800 dark:text-zinc-200 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{t("exportSubscribers")}</span>
            </button>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={t("searchSubscribers")}
            value={subscriberSearch}
            onChange={(e) => setSubscriberSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#0a0a10] border border-zinc-200 dark:border-white/[0.08] text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:border-moya-red transition-all"
          />
        </div>

        {/* Subscribers Table */}
        <div className="rounded-2xl bg-white dark:bg-[#0a0a10] border border-zinc-200 dark:border-white/[0.06] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-zinc-200 dark:border-white/[0.06] bg-zinc-50 dark:bg-white/[0.02] text-zinc-500 font-mono uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="py-3 px-4">{t("subscriberHeaderContact")}</th>
                  <th className="py-3 px-4">{t("subscriberHeaderChannel")}</th>
                  <th className="py-3 px-4">{t("subscriberHeaderProduct")}</th>
                  <th className="py-3 px-4">{t("subscriberHeaderDate")}</th>
                  <th className="py-3 px-4 text-right">Channel Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-white/[0.04]">
                {filteredSubscribers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-400 font-mono text-xs">
                      {t("noSubscribers")}
                    </td>
                  </tr>
                ) : (
                  filteredSubscribers.map((sub) => {
                    const productName = locale === "es" ? sub.variantNameEs : sub.variantNameEn;
                    const isWhatsApp = sub.channel === "whatsapp";

                    return (
                      <tr key={sub._id} className="hover:bg-zinc-50/70 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-zinc-900 dark:text-white">
                          <div>
                            <span>{sub.contact}</span>
                            {sub.name && (
                              <span className="block text-[10px] text-zinc-400 font-sans">{sub.name}</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase ${
                              isWhatsApp
                                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                                : "bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            {isWhatsApp ? "WhatsApp" : "Email"}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            {sub.image && (
                              <div className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-white/[0.04] overflow-hidden relative shrink-0">
                                <Image src={sub.image} alt={productName} fill sizes="24px" className="object-contain" />
                              </div>
                            )}
                            <span className="font-medium text-zinc-900 dark:text-white">{productName}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-zinc-500 font-mono text-[11px]">
                          {new Date(sub.createdAt).toLocaleDateString(locale === "es" ? "es-ES" : "en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isWhatsApp ? (
                            <a
                              href={`https://wa.me/${sub.contact.replace(/\D/g, "")}?text=${encodeURIComponent(
                                `¡Hola ${sub.name || ""}! El drop exclusivo de Good Luck (${productName}) está próximo a abrirse. ¿Te gustaría tener acceso prioritario?`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-semibold transition-colors"
                            >
                              <Send className="w-3 h-3" />
                              <span>Message</span>
                            </a>
                          ) : (
                            <a
                              href={`mailto:${sub.contact}?subject=${encodeURIComponent(
                                `VIP Drop Alert: ${productName} by Good Luck`
                              )}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-mono font-semibold transition-colors"
                            >
                              <Send className="w-3 h-3" />
                              <span>Email</span>
                            </a>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Modal: Schedule VIP Drop ── */}
      <AdminModal
        isOpen={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        labelledBy="schedule-modal-title"
        maxWidthClass="max-w-xl"
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/[0.06]">
            <h2 id="schedule-modal-title" className="font-display font-bold text-base text-zinc-950 dark:text-white">
              {t("scheduleNewDrop")}
            </h2>
            <button
              type="button"
              onClick={() => setScheduleModalOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {formError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Select Colorway */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
              {t("selectProduct")}
            </label>
            <select
              value={selectedVariantId}
              onChange={(e) => setSelectedVariantId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-xs font-medium text-zinc-900 dark:text-white focus:outline-none focus:border-moya-red"
            >
              {availableVariantsToSchedule.map((v) => (
                <option key={v.variantId} value={v.variantId}>
                  {locale === "es" ? v.nameEs : v.nameEn} ({v.variantId}) — Stock: {v.stock}
                </option>
              ))}
            </select>
          </div>

          {/* Date & Time Picker */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
              {t("dropDateLabel")}
            </label>
            <DateTimePicker
              value={formDropTimestamp}
              onChange={setFormDropTimestamp}
              minDate={Date.now()}
            />
          </div>

          {/* Badge EN */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
              {t("badgeEnLabel")}
            </label>
            <input
              type="text"
              placeholder={t("badgeEnPlaceholder")}
              value={formBadgeEn}
              onChange={(e) => setFormBadgeEn(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-moya-red"
            />
          </div>

          {/* Badge ES */}
          <div>
            <label className="block text-xs font-mono font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300 mb-2">
              {t("badgeEsLabel")}
            </label>
            <input
              type="text"
              placeholder={t("badgeEsPlaceholder")}
              value={formBadgeEs}
              onChange={(e) => setFormBadgeEs(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/[0.08] text-xs text-zinc-900 dark:text-white focus:outline-none focus:border-moya-red"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setScheduleModalOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleScheduleSubmit}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-moya-red hover:bg-moya-red/90 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-moya-red/25 active:scale-95 transition-all"
            >
              {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Schedule Launch</span>
            </button>
          </div>
        </div>
      </AdminModal>

      {/* ── Modal: Edit Schedule ── */}
      <AdminModal
        isOpen={Boolean(editModalTarget)}
        onClose={() => setEditModalTarget(null)}
        labelledBy="edit-modal-title"
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-white/[0.06]">
            <h2 id="edit-modal-title" className="font-display font-bold text-base text-zinc-950 dark:text-white">
              {t("editSchedule")}
            </h2>
            <button
              type="button"
              onClick={() => setEditModalTarget(null)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <p className="text-xs text-zinc-500">
            Adjust the scheduled drop launch timestamp for{" "}
            <span className="font-bold text-zinc-900 dark:text-white">
              {editModalTarget && (locale === "es" ? editModalTarget.nameEs : editModalTarget.nameEn)}
            </span>
            .
          </p>

          <DateTimePicker
            value={editDropTimestamp}
            onChange={setEditDropTimestamp}
            minDate={Date.now()}
          />

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-white/[0.06]">
            <button
              type="button"
              onClick={() => setEditModalTarget(null)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleEditScheduleConfirm}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-moya-red hover:bg-moya-red/90 disabled:opacity-50 text-white text-xs font-bold shadow-md shadow-moya-red/25 transition-all"
            >
              {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save Schedule</span>
            </button>
          </div>
        </div>
      </AdminModal>

      {/* ── Modal: Go Live Confirmation ── */}
      <AdminModal
        isOpen={Boolean(goLiveTarget)}
        onClose={() => setGoLiveTarget(null)}
        labelledBy="go-live-modal-title"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <h2 id="go-live-modal-title" className="font-display font-bold text-base text-zinc-950 dark:text-white">
            {t("confirmGoLiveTitle")}
          </h2>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs">
            <Flame className="w-5 h-5 shrink-0 text-emerald-500" />
            <div>
              <p className="font-bold">Immediate Storefront Release</p>
              <p className="mt-0.5 text-zinc-600 dark:text-zinc-300">
                {t("confirmGoLiveDesc", {
                  name: goLiveTarget ? (locale === "es" ? goLiveTarget.nameEs : goLiveTarget.nameEn) : "",
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setGoLiveTarget(null)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGoLiveConfirm}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-emerald-950/20 transition-all"
            >
              {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{t("confirmGoLiveBtn")}</span>
            </button>
          </div>
        </div>
      </AdminModal>

      {/* ── Modal: Cancel Drop Confirmation ── */}
      <AdminModal
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        labelledBy="cancel-modal-title"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <h2 id="cancel-modal-title" className="font-display font-bold text-base text-zinc-950 dark:text-white">
            {t("confirmCancelTitle")}
          </h2>

          <p className="text-xs text-zinc-600 dark:text-zinc-300">
            {t("confirmCancelDesc", {
              name: cancelTarget ? (locale === "es" ? cancelTarget.nameEs : cancelTarget.nameEn) : "",
            })}
          </p>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setCancelTarget(null)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              Keep Drop
            </button>
            <button
              type="button"
              onClick={handleCancelConfirm}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-amber-950/20 transition-all"
            >
              {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{t("confirmCancelBtn")}</span>
            </button>
          </div>
        </div>
      </AdminModal>

      {/* ── Modal: Delete Drop Confirmation ── */}
      <AdminModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        labelledBy="delete-modal-title"
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-500">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <h2 id="delete-modal-title" className="font-display font-bold text-base text-zinc-950 dark:text-white">
              {t("confirmDeleteTitle")}
            </h2>
          </div>

          <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
            {t("confirmDeleteDesc", {
              name: deleteTarget ? (locale === "es" ? deleteTarget.nameEs : deleteTarget.nameEn) : "",
            })}
          </p>

          <label className="flex items-start gap-2.5 p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/[0.08] cursor-pointer">
            <input
              type="checkbox"
              checked={deleteSubscribers}
              onChange={(e) => setDeleteSubscribers(e.target.checked)}
              className="mt-0.5 rounded border-zinc-300 text-rose-600 focus:ring-rose-500"
            />
            <span className="text-xs text-zinc-700 dark:text-zinc-300 leading-snug select-none">
              {t("deleteSubscribersLabel")}
            </span>
          </label>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteConfirm}
              disabled={isProcessing}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-rose-950/20 transition-all"
            >
              {isProcessing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Trash2 className="w-3.5 h-3.5" />
              )}
              <span>{t("confirmDeleteBtn")}</span>
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}
