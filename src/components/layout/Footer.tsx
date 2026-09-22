"use client";

import { useTranslations, useLocale } from "next-intl";
import { MessageCircle, ShieldCheck, RotateCcw, Truck } from "lucide-react";
import { useStore } from "@/store/useStore";
import { usePathname } from "@/i18n/routing";
import { getWhatsAppConciergeUrl } from "@/lib/whatsapp";

export function Footer() {
  const t = useTranslations("footer");
  const locale = useLocale();
  const { currency } = useStore();
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return null;
  }

  const handleSupportChat = () => {
    window.open(getWhatsAppConciergeUrl(locale), "_blank");
  };

  return (
    <footer className="border-t border-zinc-200 dark:border-white/[0.04] bg-[#f8f8fb] dark:bg-[#040406] py-16 sm:py-20 px-4 sm:px-6 lg:px-8 text-zinc-500 relative overflow-hidden transition-colors duration-300">
      {/* Subtle texture */}
      <div className="absolute inset-0 texture-lines pointer-events-none opacity-20 dark:opacity-50" />

      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-8 relative z-10">
        {/* Brand */}
        <div className="flex flex-col items-center md:items-start gap-2">
          <div className="flex items-center gap-2">
            <span className="font-display text-xl font-bold text-zinc-900 dark:text-white tracking-tight">
              GOOD<span className="text-moya-red">LUCK</span>
            </span>
            <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded-md bg-moya-red-deep/20 dark:bg-moya-red-deep/30 border border-moya-red/30 text-moya-red dark:text-moya-red-light font-bold">
              0880
            </span>
          </div>
          <p className="text-xs text-zinc-600 dark:text-zinc-500 max-w-sm text-center md:text-left font-sans">
            {t("tagline")}
          </p>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono mt-1">
            {t("currencyNote", { currency })}
          </div>
        </div>

        {/* WhatsApp CTA */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={handleSupportChat}
            className="px-5 py-2.5 rounded-xl glass-dark hover:bg-moya-green-deep/30 hover:border-moya-green/40 text-zinc-900 dark:text-white text-xs font-display font-semibold flex items-center gap-2 transition-all hover:scale-105 border border-zinc-200 dark:border-white/[0.06] shadow-sm"
          >
            <MessageCircle className="w-4 h-4 text-moya-green" />
            <span>WhatsApp Concierge</span>
          </button>
          <p className="text-[10px] text-zinc-500 dark:text-zinc-600 text-center max-w-xs">{t("support")}</p>
        </div>

        {/* Copyright */}
        <div className="text-xs text-zinc-500 dark:text-zinc-600 text-center md:text-right">
          <p>© {new Date().getFullYear()} Good Luck. {t("rights")}</p>
          <p className="text-[10px] text-zinc-400 dark:text-zinc-700 mt-1 font-display">
            Crafted for streetwear connoisseurs
          </p>
        </div>
      </div>

      {/* ── Trust Badges & Payment Icons ── */}
      <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-zinc-200 dark:border-white/[0.04] relative z-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Payment methods */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-zinc-500 dark:text-zinc-600 font-display uppercase tracking-wider mr-1">We Accept</span>
            {["Visa", "MC", "Apple Pay", "PayPal"].map((method) => (
              <span
                key={method}
                className="px-2 py-1 rounded-md glass-dark text-[9px] font-mono font-bold text-zinc-700 dark:text-zinc-400 border border-zinc-200 dark:border-white/[0.06]"
              >
                {method}
              </span>
            ))}
          </div>

          {/* Trust indicators */}
          <div className="flex items-center gap-4 text-[10px] text-zinc-600 dark:text-zinc-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-moya-green" />
              <span className="font-display font-semibold">Secure Checkout</span>
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-moya-violet" />
              <span className="font-display font-semibold">30-Day Returns</span>
            </span>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <span className="flex items-center gap-1.5">
              <Truck className="w-3.5 h-3.5 text-moya-gold" />
              <span className="font-display font-semibold">Express Shipping</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
