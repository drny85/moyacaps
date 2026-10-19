"use client";

import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname, useRouter } from "@/i18n/routing";
import { useStore } from "@/store/useStore";
import { useStoreSettings } from "@/hooks/useStoreSettings";
import { ShoppingBag, Globe, Menu, X, User, Package, Shield } from "lucide-react";
import { Suspense, useState, useEffect, useRef } from "react";
import { m, AnimatePresence } from "framer-motion";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { SoundToggle } from "@/components/ui/SoundToggle";
import { SafeUserButton, useSafeUser } from "@/lib/useSafeUser";
import { useIsAdmin } from "@/lib/useIsAdmin";
import { PRIMARY_NAV, activeNavKey, type NavKey } from "@/lib/navigation";

const DRAWER_ID = "mobile-nav";

export function Navbar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const { isSignedIn } = useSafeUser();
  const { isAdmin } = useIsAdmin();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  // Publish the bar's real height so sticky sub-bars (Shop filters) sit flush under it at every breakpoint.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const publish = () => document.documentElement.style.setProperty("--navbar-h", `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Navigating closes the drawer (adjusting state during render, not in an effect)
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMobileMenuOpen(false);
  }

  // Escape closes the drawer and hands focus back to the button that opened it
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMobileMenuOpen(false);
      menuButtonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  const { cart, toggleCart } = useStore();
  const { freeShippingThresholdUnits } = useStoreSettings();
  const totalItems = isMounted ? cart.reduce((sum, item) => sum + item.quantity, 0) : 0;

  if (pathname.startsWith("/admin")) {
    return null;
  }

  const ordersActive = pathname.startsWith("/account/orders");

  return (
    <>
      {/* ── Announcement bar (static: read once by screen readers, no motion cost) ── */}
      <div className="bg-moya-red-deep text-white">
        <p className="mx-auto max-w-7xl truncate px-4 py-2 text-center font-display text-[10px] font-semibold tracking-wider sm:text-xs">
          {t("freeShippingBanner", { threshold: freeShippingThresholdUnits })}
        </p>
      </div>

      <header ref={headerRef} className="sticky top-0 z-40 w-full glass-dark border-b border-black/[0.06] dark:border-white/[0.06] transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-3">
          {/* ── Brand Logo ── */}
          <Link href="/" className="flex min-w-0 items-center gap-2.5 group">
            <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 rounded-xl bg-gradient-to-br from-moya-red to-moya-red-deep p-0.5 shadow-lg shadow-moya-red-deep/30 flex items-center justify-center">
              <div className="w-full h-full bg-[#09090c] rounded-[10px] flex items-center justify-center font-display font-bold text-moya-red text-base sm:text-lg group-hover:scale-105 transition-transform">
                ☘
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-display font-bold text-lg sm:text-xl tracking-tight text-zinc-900 dark:text-white group-hover:text-moya-red transition-colors">
                  GOOD<span className="text-moya-red">LUCK</span>
                </span>
                <span className="hidden min-[400px]:inline text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-md bg-moya-red-deep/10 dark:bg-moya-red-deep/30 border border-moya-red/30 text-moya-red font-bold">
                  0880
                </span>
              </div>
              <p className="text-[9px] text-zinc-500 tracking-widest uppercase font-display hidden sm:block">
                Headwear & Heavyweight Tees
              </p>
            </div>
          </Link>

          {/* ── Desktop Nav ── */}
          <nav aria-label={t("primary")} className="hidden md:flex items-center gap-7 text-sm font-display font-medium text-zinc-600 dark:text-zinc-400">
            <Suspense fallback={<NavLinks active={null} variant="desktop" />}>
              <ActiveNavLinks variant="desktop" />
            </Suspense>
          </nav>

          {/* ── Controls ── */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
            {/* Sound and theme live in the drawer (and the bottom bar) on phones */}
            <div className="hidden md:flex items-center gap-2.5">
              <SoundToggle compact={true} />
              <ThemeToggle compact={true} />
              <LocaleSwitch className="glass-dark px-2.5 py-1.5 rounded-xl border border-black/[0.06] dark:border-white/[0.06]" />
            </div>

            {/* Orders Quick Tab for Logged-In Users */}
            {isSignedIn && (
              <Link
                href="/account/orders"
                aria-current={ordersActive ? "page" : undefined}
                className={`hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-xs font-display font-semibold transition-all border ${ordersActive
                  ? "border-moya-red text-moya-red bg-moya-red/5 font-bold"
                  : "border-black/[0.06] dark:border-white/[0.06] text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
                  }`}
              >
                <Package className="w-3.5 h-3.5 text-moya-red" />
                <span>{t("orders")}</span>
              </Link>
            )}

            {/* Admin Dashboard shortcut for authorized staff */}
            {isAdmin && (
              <Link
                href="/admin/analytics"
                className="hidden md:inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-red-600/90 to-rose-700 hover:from-red-600 hover:to-rose-600 text-white text-xs font-display font-bold shadow-lg shadow-red-500/20 border border-red-400/30 transition-colors"
                title="Good Luck Operations HQ (Admin Dashboard)"
              >
                <span className="inline-flex rounded-full h-2 w-2 bg-emerald-500" aria-hidden />
                <Shield className="w-3.5 h-3.5" />
                <span>Admin</span>
              </Link>
            )}

            {/* Account / Vault */}
            <div className="flex items-center">
              <SafeUserButton
                fallback={
                  <Link
                    href="/account/orders"
                    className="w-10 h-10 rounded-xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-all border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-center"
                    aria-label={t("account")}
                  >
                    <User className="w-5 h-5" />
                  </Link>
                }
              />
            </div>

            {/* Cart */}
            <button
              onClick={toggleCart}
              className="relative w-10 h-10 rounded-xl bg-moya-red hover:bg-rose-500 text-white shadow-lg shadow-moya-red-deep/30 transition-all hover:scale-105 active:scale-95 flex items-center justify-center"
              aria-label={t("cart")}
            >
              <ShoppingBag className="w-5 h-5" />
              {totalItems > 0 && (
                <m.span
                  key={totalItems}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-moya-green text-black font-display font-extrabold text-[10px] flex items-center justify-center shadow"
                >
                  {totalItems}
                </m.span>
              )}
            </button>

            {/* Mobile Menu */}
            <button
              ref={menuButtonRef}
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label={mobileMenuOpen ? t("closeMenu") : t("menu")}
              aria-expanded={mobileMenuOpen}
              aria-controls={DRAWER_ID}
              className="md:hidden w-10 h-10 -mr-1.5 rounded-xl flex items-center justify-center text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* ── Mobile Drawer ── */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <m.nav
              id={DRAWER_ID}
              aria-label={t("primary")}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden overflow-hidden border-t border-black/[0.06] dark:border-white/[0.06] bg-white/95 dark:bg-[#08080c] shadow-2xl"
            >
              <div className="px-4 py-3 flex flex-col">
                <Suspense fallback={<NavLinks active={null} variant="drawer" onNavigate={() => setMobileMenuOpen(false)} />}>
                  <ActiveNavLinks variant="drawer" onNavigate={() => setMobileMenuOpen(false)} />
                </Suspense>
                <Link
                  href="/account/orders"
                  onClick={() => setMobileMenuOpen(false)}
                  aria-current={ordersActive ? "page" : undefined}
                  className={drawerLinkClass(ordersActive)}
                >
                  {isSignedIn ? t("orders") : t("account")}
                </Link>

                {isAdmin && (
                  <Link
                    href="/admin/analytics"
                    onClick={() => setMobileMenuOpen(false)}
                    className="mt-2 flex items-center gap-3 p-3 rounded-2xl bg-moya-red/10 border border-moya-red/30"
                  >
                    <span className="w-9 h-9 rounded-xl bg-moya-red text-white flex items-center justify-center">
                      <Shield className="w-5 h-5" />
                    </span>
                    <span className="font-display font-bold text-sm text-zinc-900 dark:text-white">Admin Operations HQ</span>
                  </Link>
                )}

                {/* Phone-only controls */}
                <div className="mt-3 flex items-center justify-between gap-3 pt-4 pb-1 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <LocaleSwitch />
                  <div className="flex items-center gap-2">
                    <SoundToggle compact={true} />
                    <ThemeToggle compact={true} />
                  </div>
                </div>
              </div>
            </m.nav>
          )}
        </AnimatePresence>
      </header>
    </>
  );
}

const drawerLinkClass = (active: boolean) =>
  `flex min-h-11 items-center rounded-xl px-2 font-display text-lg font-semibold transition-colors ${active ? "text-moya-red" : "text-zinc-900 dark:text-zinc-100 hover:text-moya-red"
  }`;

type LinksVariant = "desktop" | "drawer";

/** Reads the query string, so it renders inside Suspense (static pages prerender the fallback) */
function ActiveNavLinks({ variant, onNavigate }: { variant: LinksVariant; onNavigate?: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams();
  return <NavLinks active={activeNavKey(PRIMARY_NAV, pathname, search.toString())} variant={variant} onNavigate={onNavigate} />;
}

function NavLinks({ active, variant, onNavigate }: { active: NavKey | null; variant: LinksVariant; onNavigate?: () => void }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  return (
    <>
      {PRIMARY_NAV.map(({ key, href }) => {
        const isActive = key === active;
        const className =
          variant === "drawer"
            ? drawerLinkClass(isActive)
            : `hover-underline transition-colors ${isActive ? "text-zinc-950 dark:text-white font-semibold" : "hover:text-zinc-900 dark:hover:text-white"}`;
        // In-page anchors use a plain link: a client-side route change lands at the top
        // under smooth scrolling, while a document navigation scrolls to the anchor.
        if (href.includes("#")) {
          return (
            <a key={key} href={`/${locale}${href.replace(/^\/(?=#)/, "")}`} onClick={onNavigate} className={className}>
              {t(key)}
            </a>
          );
        }
        return (
          <Link key={key} href={href} onClick={onNavigate} aria-current={isActive ? "page" : undefined} className={className}>
            {t(key)}
          </Link>
        );
      })}
    </>
  );
}

function LocaleSwitch({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const switchLocale = (next: "en" | "es") => router.replace(pathname, { locale: next });
  return (
    <div className={`flex items-center gap-1 text-xs font-display font-semibold text-zinc-600 dark:text-zinc-400 ${className}`}>
      <Globe className="w-3.5 h-3.5 text-moya-green" aria-hidden />
      {(["en", "es"] as const).map((code, i) => (
        <span key={code} className="flex items-center gap-1">
          {i > 0 && <span className="text-zinc-400 dark:text-zinc-700" aria-hidden>/</span>}
          <button
            onClick={() => switchLocale(code)}
            aria-pressed={locale === code}
            lang={code}
            className={`px-1 py-1 transition-colors ${locale === code
              ? "text-zinc-900 dark:text-white font-bold underline decoration-moya-green decoration-2 underline-offset-4"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300"
              }`}
          >
            {code.toUpperCase()}
          </button>
        </span>
      ))}
    </div>
  );
}
