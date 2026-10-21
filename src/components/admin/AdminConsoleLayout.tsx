"use client";

import React, { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { BrandMark } from "@/components/layout/BrandMark";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { SafeUserButton, useSafeUser } from "@/lib/useSafeUser";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { useMinuteClock } from "@/hooks/useMinuteClock";
import { useSoundPreference } from "@/hooks/useSoundPreference";
import { ArrowUpRight, Flame, Home, Layers, Menu, PackageCheck, Settings, X } from "lucide-react";

/**
 * Plays a pleasant, high-contrast two-tone notification chime
 * using the Web Audio API without needing external sound asset downloads.
 */
function playOrderChime() {
  try {
    const AudioContextClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();

    // Note 1: 880Hz (A5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    gain1.gain.setValueAtTime(0.12, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.3);

    // Note 2: 1320Hz (E6)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0.15, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.55);
  } catch (e) {
    console.warn("Audio cue error:", e);
  }
}

export function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Changed on Settings → Alerts; the shell only listens.
  const [soundEnabled] = useSoundPreference();

  const { isLoaded, isSignedIn } = useSafeUser();
  const { isAdmin } = useIsAdmin();
  const isAuthorized = isLoaded && isSignedIn && isAdmin;

  // Attention telemetry refresh clock (queries must not read wall clock server-side,
  // so the client supplies a minute-granularity timestamp).
  const statsClock = useMinuteClock();

  // Real-time attention telemetry from Convex (only query when authenticated & authorized)
  const attentionStats = useQuery(
    api.orders.desk.getOrdersAttentionStats,
    isAuthorized ? { clientTime: statsClock } : "skip"
  );

  // Real-time order arrival sound cue watcher
  const lastTimestampRef = useRef<number | null>(null);
  useEffect(() => {
    if (!attentionStats?.latestOrderTimestamp) return;

    if (lastTimestampRef.current === null) {
      // First query resolution, capture baseline
      lastTimestampRef.current = attentionStats.latestOrderTimestamp;
      return;
    }

    if (attentionStats.latestOrderTimestamp > lastTimestampRef.current) {
      lastTimestampRef.current = attentionStats.latestOrderTimestamp;
      if (soundEnabled) {
        playOrderChime();
      }
    }
  }, [attentionStats?.latestOrderTimestamp, soundEnabled]);

  const badgeCount = attentionStats?.totalActionRequired || 0;
  const navItems = [
    { label: t("nav.home"), href: "/admin", icon: Home },
    {
      label: t("nav.orders"),
      href: "/admin/orders",
      icon: PackageCheck,
      badgeCount,
      isOverdue: (attentionStats?.overduePaid || 0) > 0,
    },
    { label: t("nav.products"), href: "/admin/products", icon: Layers },
    { label: t("nav.drops"), href: "/admin/drops", icon: Flame },
    { label: t("nav.settings"), href: "/admin/settings", icon: Settings },
  ];
  // Home matches only itself; the others own their sub-routes (an Order's page keeps Orders lit).
  const isActive = (href: string) => (href === "/admin" ? pathname === href : pathname.startsWith(href));

  const navLink = (item: (typeof navItems)[number], onClick?: () => void) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={onClick}
        aria-current={active ? "page" : undefined}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 ${
          active
            ? "bg-moya-red text-white shadow-md shadow-moya-red/25 font-semibold"
            : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.04]"
        }`}
      >
        <Icon className={`w-4 h-4 ${active ? "text-white" : "text-zinc-600 dark:text-zinc-400"}`} />
        <span className="truncate">{item.label}</span>
        {item.badgeCount ? (
          <span
            title={t("nav.ordersBadge", { count: item.badgeCount })}
            className={`ml-auto flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-mono font-bold rounded-full ${
              active ? "bg-white text-moya-red shadow-xs" : item.isOverdue ? "bg-rose-500 text-white" : "bg-amber-500 text-black"
            }`}
          >
            {item.badgeCount}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#f7f8fa] dark:bg-[#07070b] text-zinc-900 dark:text-zinc-100 flex flex-col md:flex-row transition-colors duration-300 print:bg-white print:text-black print:min-h-0 print:block">
        {/* ── Desktop Sidebar ── */}
        <aside className="print:hidden hidden md:flex flex-col w-60 lg:w-64 bg-white dark:bg-[#0a0a10] border-r border-zinc-200 dark:border-white/[0.06] shrink-0 sticky top-0 h-screen z-30">
          <div className="p-5 border-b border-zinc-200 dark:border-white/[0.06]">
            <Link href="/admin" className="flex items-center gap-2.5">
              <BrandMark className="w-8 h-8 shrink-0 rounded-[22%] shadow-md shadow-moya-red/20" />
              <span className="font-display font-bold text-sm tracking-tight text-zinc-950 dark:text-white">
                GOOD<span className="text-moya-red">LUCK</span>
              </span>
            </Link>
          </div>

          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto" aria-label={t("title")}>
            {navItems.map((item) => navLink(item))}
          </nav>

          <div className="p-3 border-t border-zinc-200 dark:border-white/[0.06] flex items-center justify-between gap-2">
            <Link
              href="/"
              target="_blank"
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors group"
            >
              <span>{t("backToStore")}</span>
              <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
            <SafeUserButton />
          </div>
        </aside>

        {/* ── Mobile Top Header ── */}
        <div className="print:hidden md:hidden sticky top-0 z-40 bg-white/95 dark:bg-[#0a0a10]/95 backdrop-blur-md border-b border-zinc-200 dark:border-white/[0.06] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="p-1.5 rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300 relative"
              aria-label={t("nav.toggle")}
              aria-expanded={mobileNavOpen}
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              {badgeCount > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />}
            </button>
            <Link href="/admin" className="font-display font-bold text-sm tracking-tight text-zinc-900 dark:text-white">
              GOOD<span className="text-moya-red">LUCK</span>
            </Link>
          </div>
          <SafeUserButton />
        </div>

        {/* ── Mobile Dropdown Menu ── */}
        {mobileNavOpen && (
          <nav className="print:hidden md:hidden bg-white dark:bg-[#0c0c14] border-b border-zinc-200 dark:border-white/[0.06] p-4 space-y-1.5 z-30 shadow-xl" aria-label={t("title")}>
            {navItems.map((item) => navLink(item, () => setMobileNavOpen(false)))}
            <Link href="/" className="flex items-center gap-2 px-3 pt-3 mt-2 border-t border-zinc-200 dark:border-white/[0.06] text-xs text-moya-red font-medium">
              {t("backToStore")} <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </nav>
        )}

        {/* ── Main Operations Content Surface ── */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto print:p-0 print:overflow-visible">
          <div className="max-w-7xl mx-auto print:max-w-none print:m-0">{children}</div>
        </main>
      </div>
    </AdminGuard>
  );
}
