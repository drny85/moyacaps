"use client";

import React, { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { AdminGuard } from "@/components/admin/AdminGuard";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SafeUserButton } from "@/lib/useSafeUser";
import {
  BarChart3,
  PackageCheck,
  Layers,
  ArrowUpRight,
  Menu,
  X,
  ShieldAlert,
  Sparkles,
  Flame,
  RefreshCw,
  Globe,
} from "lucide-react";

export default function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params?: Promise<{ locale: string }>;
}) {
  const t = useTranslations("admin");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems = [
    {
      label: t("nav.analytics"),
      href: "/admin/analytics",
      icon: BarChart3,
    },
    {
      label: t("nav.orders"),
      href: "/admin/orders",
      icon: PackageCheck,
    },
    {
      label: t("nav.products"),
      href: "/admin/products",
      icon: Layers,
    },
    {
      label: t("nav.drops"),
      href: "/admin/drops",
      icon: Flame,
    },
  ];

  const switchLocale = (newLocale: "en" | "es") => {
    router.replace(pathname, { locale: newLocale });
  };

  return (
    <AdminGuard>
      <div className="min-h-screen bg-[#f7f8fa] dark:bg-[#07070b] text-zinc-900 dark:text-zinc-100 flex flex-col md:flex-row transition-colors duration-300">
        {/* ── Desktop Sidebar ── */}
        <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white dark:bg-[#0a0a10] border-r border-zinc-200 dark:border-white/[0.06] shrink-0 sticky top-0 h-screen z-30">
          {/* Brand Header */}
          <div className="p-5 border-b border-zinc-200 dark:border-white/[0.06] flex items-center justify-between">
            <Link href="/admin/analytics" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-moya-red to-moya-red-deep flex items-center justify-center text-white font-display font-bold shadow-md shadow-moya-red/20">
                M
              </div>
              <div>
                <span className="font-display font-bold text-sm tracking-tight block text-zinc-950 dark:text-white">
                  MOYA<span className="text-moya-red">CAPS</span>
                </span>
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400 block -mt-0.5">
                  Operations HQ
                </span>
              </div>
            </Link>

            <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-moya-red/10 border border-moya-red/30 text-moya-red">
              STAFF
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
            <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-widest text-zinc-600 dark:text-zinc-400 font-semibold">
              Operations Desk
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href === "/admin/analytics" && pathname === "/admin");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium text-xs transition-all duration-200 ${
                    isActive
                      ? "bg-moya-red text-white shadow-md shadow-moya-red/25 font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-zinc-600 dark:text-zinc-400"}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="pt-6 px-3 pb-2 text-[10px] font-mono uppercase tracking-widest text-zinc-600 dark:text-zinc-400 font-semibold">
              Live Channels
            </div>

            <Link
              href="/"
              target="_blank"
              className="flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>{t("backToStore")}</span>
              </div>
              <ArrowUpRight className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
          </nav>

          {/* Footer Controls: Locale, Theme, User */}
          <div className="p-3 border-t border-zinc-200 dark:border-white/[0.06] space-y-3 bg-zinc-50/50 dark:bg-white/[0.01]">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" />
                <div className="flex bg-zinc-200/70 dark:bg-white/[0.06] rounded-lg p-0.5 text-[11px] font-mono font-medium">
                  <button
                    onClick={() => switchLocale("en")}
                    className={`px-2 py-0.5 rounded-md transition-colors ${
                      locale === "en"
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => switchLocale("es")}
                    className={`px-2 py-0.5 rounded-md transition-colors ${
                      locale === "es"
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs font-bold"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    ES
                  </button>
                </div>
              </div>

              <ThemeToggle />
            </div>

            <div className="flex items-center justify-between px-2 pt-2 border-t border-zinc-200/60 dark:border-white/[0.04]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                  Convex Reactive
                </span>
              </div>
              <SafeUserButton />
            </div>
          </div>
        </aside>

        {/* ── Mobile Top Header ── */}
        <div className="md:hidden sticky top-0 z-40 bg-white/95 dark:bg-[#0a0a10]/95 backdrop-blur-md border-b border-zinc-200 dark:border-white/[0.06] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="p-1.5 rounded-xl border border-zinc-200 dark:border-white/10 text-zinc-700 dark:text-zinc-300"
              aria-label="Toggle admin navigation"
            >
              {mobileNavOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <span className="font-display font-bold text-sm tracking-tight text-zinc-900 dark:text-white">
              MOYA<span className="text-moya-red">CAPS</span> <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-400">HQ</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <SafeUserButton />
          </div>
        </div>

        {/* ── Mobile Dropdown Menu ── */}
        {mobileNavOpen && (
          <div className="md:hidden bg-white dark:bg-[#0c0c14] border-b border-zinc-200 dark:border-white/[0.06] p-4 space-y-2 z-30 shadow-xl">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium ${
                    isActive
                      ? "bg-moya-red text-white font-semibold"
                      : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-white/[0.04]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            <div className="pt-3 border-t border-zinc-200 dark:border-white/[0.06] flex items-center justify-between">
              <Link
                href="/"
                className="text-xs text-moya-red font-medium flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" /> {t("backToStore")}
              </Link>
              <div className="flex bg-zinc-200/70 dark:bg-white/[0.06] rounded-lg p-0.5 text-xs font-mono">
                <button
                  onClick={() => switchLocale("en")}
                  className={`px-2 py-0.5 rounded-md ${locale === "en" ? "bg-white dark:bg-zinc-800 font-bold text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400"}`}
                >
                  EN
                </button>
                <button
                  onClick={() => switchLocale("es")}
                  className={`px-2 py-0.5 rounded-md ${locale === "es" ? "bg-white dark:bg-zinc-800 font-bold text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400"}`}
                >
                  ES
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Main Operations Content Surface ── */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </AdminGuard>
  );
}
