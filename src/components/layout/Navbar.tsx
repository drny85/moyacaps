"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { useStore } from "@/store/useStore";
import { ShoppingBag, Globe, Menu, X, Sparkles, User, Package, Shield, Truck } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SafeUserButton, useSafeUser } from "@/lib/useSafeUser";
import { checkIsAdmin } from "@/lib/adminAuth";

export function Navbar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { user, isSignedIn } = useSafeUser();
  const isAdmin = checkIsAdmin(user);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { cart, toggleCart } = useStore();
  const totalItems = isMounted ? cart.reduce((sum, item) => sum + item.quantity, 0) : 0;

  const switchLocale = (newLocale: "en" | "es") => {
    router.replace(pathname, { locale: newLocale });
  };

  if (pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <>
      {/* ── Scrolling Marquee Banner ── */}
      <div className="bg-gradient-to-r from-moya-red via-moya-violet to-moya-red bg-[length:200%_auto] animate-banner-scroll py-2 marquee-container">
        <div className="marquee-track text-[10px] sm:text-xs font-display font-semibold tracking-wider text-white">
          {Array.from({ length: 6 }).map((_, i) => (
            <span key={i} className="inline-flex items-center gap-6 px-6">
              <span>{t("freeShippingBanner")}</span>
              <span className="text-white/40">✦</span>
            </span>
          ))}
        </div>
      </div>

      <header className="sticky top-0 z-40 w-full glass-dark border-b border-black/[0.06] dark:border-white/[0.06] transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between">
          {/* ── Brand Logo ── */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-moya-red to-moya-red-deep p-0.5 shadow-lg shadow-moya-red-deep/30 flex items-center justify-center">
              <div className="w-full h-full bg-[#09090c] rounded-[10px] flex items-center justify-center font-display font-bold text-moya-red text-base sm:text-lg group-hover:scale-105 transition-transform">
                ☘
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-lg sm:text-xl tracking-tight text-zinc-900 dark:text-white group-hover:text-moya-red transition-colors">
                  GOOD<span className="text-moya-red">LUCK</span>
                </span>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-md bg-moya-red-deep/10 dark:bg-moya-red-deep/30 border border-moya-red/30 text-moya-red font-bold">
                  0880
                </span>
              </div>
              <p className="text-[9px] text-zinc-500 tracking-widest uppercase font-display hidden sm:block">
                Signature Headwear
              </p>
            </div>
          </Link>

          {/* ── Desktop Nav ── */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-display font-medium text-zinc-600 dark:text-zinc-400">
            <a
              href="/#catalog"
              className="hover:text-zinc-900 dark:hover:text-white transition-colors hover-underline flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3 text-moya-green" />
              {t("catalog")}
            </a>
            <a href="/#story" className="hover:text-zinc-900 dark:hover:text-white transition-colors hover-underline">
              {t("story")}
            </a>
            <Link
              href="/track"
              className={`transition-colors hover-underline flex items-center gap-1.5 ${pathname.includes("/track")
                ? "text-moya-red dark:text-moya-red font-bold"
                : "hover:text-zinc-900 dark:hover:text-white"
                }`}
            >
              <Truck className="w-3.5 h-3.5 text-moya-red" />
              <span>{t("track")}</span>
            </Link>
            {isSignedIn && (
              <Link
                href="/account/orders"
                className={`transition-colors hover-underline flex items-center gap-1.5 ${pathname.includes("/account/orders")
                  ? "text-moya-red dark:text-moya-red font-bold"
                  : "hover:text-zinc-900 dark:hover:text-white"
                  }`}
              >
                <Package className="w-3.5 h-3.5 text-moya-red" />
                <span>{t("orders")}</span>
              </Link>
            )}
          </nav>

          {/* ── Controls ── */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            {/* Theme Toggle */}
            <ThemeToggle compact={true} />

            {/* Language */}
            <div className="hidden sm:flex items-center gap-1 glass-dark px-2.5 py-1.5 rounded-xl text-xs font-display font-semibold text-zinc-600 dark:text-zinc-400 border border-black/[0.06] dark:border-white/[0.06]">
              <Globe className="w-3.5 h-3.5 text-moya-green" />
              <button
                onClick={() => switchLocale("en")}
                className={`transition-colors ${locale === "en"
                  ? "text-zinc-900 dark:text-white font-bold underline decoration-moya-green decoration-2 underline-offset-4"
                  : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-300"
                  }`}
              >
                EN
              </button>
              <span className="text-zinc-400 dark:text-zinc-700">/</span>
              <button
                onClick={() => switchLocale("es")}
                className={`transition-colors ${locale === "es"
                  ? "text-zinc-900 dark:text-white font-bold underline decoration-moya-green decoration-2 underline-offset-4"
                  : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-300"
                  }`}
              >
                ES
              </button>
            </div>

            {/* Orders Quick Tab for Logged-In Users */}
            {isSignedIn && (
              <Link
                href="/account/orders"
                className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-xs font-display font-semibold transition-all border ${pathname.includes("/account/orders")
                  ? "border-moya-red text-moya-red bg-moya-red/5 font-bold"
                  : "border-black/[0.06] dark:border-white/[0.06] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
                  }`}
                title="View All Orders"
              >
                <Package className="w-3.5 h-3.5 text-moya-red" />
                <span>{t("orders")}</span>
              </Link>
            )}

            {/* Admin Dashboard shortcut for authorized staff */}
            {isAdmin && (
              <Link
                href="/admin/analytics"
                className="inline-flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-red-600/90 to-rose-700 hover:from-red-600 hover:to-rose-600 text-white text-xs font-display font-bold shadow-lg shadow-red-500/20 hover:shadow-red-500/35 border border-red-400/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
                title="MoyaCaps Operations HQ (Admin Dashboard)"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <Shield className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Admin Dashboard</span>
                <span className="sm:hidden">Admin</span>
              </Link>
            )}

            {/* Account / Vault */}
            <div className="flex items-center">
              <SafeUserButton
                fallback={
                  <Link
                    href="/account/orders"
                    className="p-2.5 rounded-xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-all border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-center"
                    title="Collector Account & Orders"
                    aria-label="Account"
                  >
                    <User className="w-5 h-5" />
                  </Link>
                }
              />
            </div>

            {/* Cart */}
            <button
              onClick={toggleCart}
              className="relative p-2.5 rounded-xl bg-moya-red hover:bg-rose-500 text-white shadow-lg shadow-moya-red-deep/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
              aria-label="Cart"
            >
              <ShoppingBag className="w-5 h-5" />
              {totalItems > 0 && (
                <motion.span
                  key={totalItems}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-moya-green text-black font-display font-extrabold text-[10px] flex items-center justify-center shadow"
                >
                  {totalItems}
                </motion.span>
              )}
            </button>

            {/* Mobile Menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-zinc-500 hover:text-white transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* ── Mobile Drawer ── */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-black/[0.06] dark:border-white/[0.06] bg-white/95 dark:bg-[#08080c] px-6 py-5 flex flex-col gap-5 shadow-2xl"
            >
              <a
                href="#catalog"
                onClick={() => setMobileMenuOpen(false)}
                className="text-zinc-900 dark:text-zinc-200 hover:text-moya-red font-display font-semibold text-base transition-colors"
              >
                {t("catalog")}
              </a>
              <a
                href="#story"
                onClick={() => setMobileMenuOpen(false)}
                className="text-zinc-900 dark:text-zinc-200 hover:text-moya-red font-display font-semibold text-base transition-colors"
              >
                {t("story")}
              </a>
              <Link
                href="/track"
                onClick={() => setMobileMenuOpen(false)}
                className="text-zinc-900 dark:text-zinc-200 hover:text-moya-red font-display font-semibold text-base transition-colors flex items-center gap-2"
              >
                <Truck className="w-5 h-5 text-moya-red" />
                <span>{t("trackShipment")}</span>
              </Link>
              {isSignedIn ? (
                <Link
                  href="/account/orders"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-zinc-900 dark:text-zinc-200 hover:text-moya-red font-display text-base transition-colors flex items-center gap-2 font-bold"
                >
                  <Package className="w-5 h-5 text-moya-red" />
                  <span>{t("orders")}</span>
                </Link>
              ) : (
                <Link
                  href="/account/orders"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-zinc-900 dark:text-zinc-200 hover:text-moya-red font-display font-semibold text-base transition-colors flex items-center gap-2"
                >
                  <User className="w-4 h-4 text-moya-red" />
                  <span>{t("account")}</span>
                </Link>
              )}

              {isAdmin && (
                <Link
                  href="/admin/analytics"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-moya-red/15 via-moya-red/10 to-transparent border border-moya-red/30 text-moya-red transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-moya-red text-white flex items-center justify-center shadow-md">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-display font-bold text-sm text-zinc-900 dark:text-white">
                          Admin Operations HQ
                        </p>
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      </div>
                      <p className="text-[10px] text-zinc-500 font-mono">
                        Manage Orders, Inventory & Analytics
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-moya-red font-mono">Open →</span>
                </Link>
              )}

              {/* Mobile-only controls */}
              <div className="flex items-center justify-between gap-3 pt-4 border-t border-black/[0.06] dark:border-white/[0.06]">
                <div className="flex items-center gap-1.5 text-xs font-display font-semibold">
                  <Globe className="w-3.5 h-3.5 text-moya-green" />
                  <button
                    onClick={() => switchLocale("en")}
                    className={locale === "en" ? "text-zinc-900 dark:text-white font-bold" : "text-zinc-400 dark:text-zinc-600"}
                  >
                    EN
                  </button>
                  <span className="text-zinc-400 dark:text-zinc-700">/</span>
                  <button
                    onClick={() => switchLocale("es")}
                    className={locale === "es" ? "text-zinc-900 dark:text-white font-bold" : "text-zinc-400 dark:text-zinc-600"}
                  >
                    ES
                  </button>
                </div>

                <ThemeToggle compact={false} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
