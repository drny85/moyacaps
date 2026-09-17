"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { useStore } from "@/store/useStore";
import { ShoppingBag, Globe, Menu, X, Sparkles } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export function Navbar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const { cart, toggleCart, currency, setCurrency } = useStore();
  const totalItems = isMounted ? cart.reduce((sum, item) => sum + item.quantity, 0) : 0;

  const switchLocale = (newLocale: "en" | "es") => {
    router.replace(pathname, { locale: newLocale });
  };

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

      <header className="sticky top-0 z-40 w-full glass-dark border-b border-white/[0.06] transition-all duration-300">
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
                <span className="font-display font-bold text-lg sm:text-xl tracking-tight text-white group-hover:text-moya-red-light transition-colors">
                  MOYA<span className="text-moya-red">CAPS</span>
                </span>
                <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-md bg-moya-red-deep/30 border border-moya-red/30 text-moya-red-light font-bold">
                  0880
                </span>
              </div>
              <p className="text-[9px] text-zinc-500 tracking-widest uppercase font-display hidden sm:block">
                Good Luck Edition
              </p>
            </div>
          </Link>

          {/* ── Desktop Nav ── */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-display font-medium text-zinc-400">
            <a
              href="#catalog"
              className="hover:text-white transition-colors hover-underline flex items-center gap-1.5"
            >
              <Sparkles className="w-3 h-3 text-moya-green" />
              {t("catalog")}
            </a>
            <a href="#story" className="hover:text-white transition-colors hover-underline">
              {t("story")}
            </a>
          </nav>

          {/* ── Controls ── */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Currency */}
            <div className="hidden sm:flex items-center glass-dark rounded-xl p-0.5 border border-white/[0.06] text-xs font-mono">
              <button
                onClick={() => setCurrency("USD")}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  currency === "USD"
                    ? "bg-moya-red text-white font-bold shadow-sm"
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                USD
              </button>
              <button
                onClick={() => setCurrency("MXN")}
                className={`px-2.5 py-1.5 rounded-lg transition-all ${
                  currency === "MXN"
                    ? "bg-moya-red text-white font-bold shadow-sm"
                    : "text-zinc-500 hover:text-white"
                }`}
              >
                MXN
              </button>
            </div>

            {/* Language */}
            <div className="hidden sm:flex items-center gap-1 glass-dark px-2.5 py-1.5 rounded-xl text-xs font-display font-semibold text-zinc-400 border border-white/[0.06]">
              <Globe className="w-3.5 h-3.5 text-moya-green" />
              <button
                onClick={() => switchLocale("en")}
                className={`transition-colors ${
                  locale === "en"
                    ? "text-white font-bold underline decoration-moya-green decoration-2 underline-offset-4"
                    : "text-zinc-600 hover:text-zinc-300"
                }`}
              >
                EN
              </button>
              <span className="text-zinc-700">/</span>
              <button
                onClick={() => switchLocale("es")}
                className={`transition-colors ${
                  locale === "es"
                    ? "text-white font-bold underline decoration-moya-green decoration-2 underline-offset-4"
                    : "text-zinc-600 hover:text-zinc-300"
                }`}
              >
                ES
              </button>
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
              className="md:hidden border-t border-white/[0.06] bg-[#08080c] px-6 py-5 flex flex-col gap-5"
            >
              <a
                href="#catalog"
                onClick={() => setMobileMenuOpen(false)}
                className="text-zinc-200 hover:text-moya-red-light font-display font-semibold text-base"
              >
                {t("catalog")}
              </a>
              <a
                href="#story"
                onClick={() => setMobileMenuOpen(false)}
                className="text-zinc-200 hover:text-moya-red-light font-display font-semibold text-base"
              >
                {t("story")}
              </a>

              {/* Mobile-only controls */}
              <div className="flex items-center gap-3 pt-3 border-t border-white/[0.06]">
                <div className="flex items-center glass-dark rounded-xl p-0.5 border border-white/[0.06] text-xs font-mono">
                  <button
                    onClick={() => setCurrency("USD")}
                    className={`px-2.5 py-1.5 rounded-lg transition-all ${
                      currency === "USD"
                        ? "bg-moya-red text-white font-bold"
                        : "text-zinc-500"
                    }`}
                  >
                    USD
                  </button>
                  <button
                    onClick={() => setCurrency("MXN")}
                    className={`px-2.5 py-1.5 rounded-lg transition-all ${
                      currency === "MXN"
                        ? "bg-moya-red text-white font-bold"
                        : "text-zinc-500"
                    }`}
                  >
                    MXN
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-display font-semibold">
                  <Globe className="w-3.5 h-3.5 text-moya-green" />
                  <button
                    onClick={() => switchLocale("en")}
                    className={locale === "en" ? "text-white font-bold" : "text-zinc-600"}
                  >
                    EN
                  </button>
                  <span className="text-zinc-700">/</span>
                  <button
                    onClick={() => switchLocale("es")}
                    className={locale === "es" ? "text-white font-bold" : "text-zinc-600"}
                  >
                    ES
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}
