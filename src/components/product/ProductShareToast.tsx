"use client";

import { useEffect } from "react";
import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { useStore } from "@/store/useStore";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, MessageCircle, Copy, Sparkles, ExternalLink } from "lucide-react";

export function ProductShareToast() {
  const t = useTranslations("share");
  const locale = useLocale();
  const shareToast = useStore((s) => s.shareToast);
  const hideShareToast = useStore((s) => s.hideShareToast);

  // Auto-dismiss after 5.5 seconds
  useEffect(() => {
    if (!shareToast?.isOpen) return;

    const timer = setTimeout(() => {
      hideShareToast();
    }, 5500);

    return () => clearTimeout(timer);
  }, [shareToast?.isOpen, hideShareToast]);

  if (!shareToast?.isOpen) return null;

  const { capName, url, capImage } = shareToast;

  const handleWhatsAppShare = () => {
    const message =
      locale === "es"
        ? `¡Checa esta gorra de Good Luck! ${capName} (Edición 0880): ${url}`
        : `Check out this cap from Good Luck! ${capName} (0880 Edition): ${url}`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/?text=${encoded}`, "_blank");
  };

  const handleReCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      // Ignored
    }
  };

  return (
    <AnimatePresence>
      {shareToast?.isOpen && (
        <motion.div
          key="share-toast"
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed bottom-24 sm:bottom-8 right-4 sm:right-8 z-50 w-[calc(100vw-2rem)] sm:w-[420px] max-w-full"
          role="status"
          aria-live="polite"
        >
          <div className="relative rounded-2xl glass-card bg-white/95 dark:bg-zinc-950/95 border border-emerald-500/30 dark:border-emerald-500/40 p-4 shadow-2xl shadow-emerald-950/20 dark:shadow-black/60 backdrop-blur-xl">
            {/* Ambient emerald glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

            {/* Header row */}
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-black/[0.06] dark:border-white/[0.08]">
              <div className="flex items-center gap-1.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <Check className="w-3 h-3 stroke-[3]" />
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest font-bold text-emerald-600 dark:text-emerald-400">
                  {t("toastBadge")}
                </span>
              </div>

              <button
                onClick={hideShareToast}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                aria-label={t("dismiss")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Content */}
            <div className="flex gap-3 pt-3 items-start">
              {/* Product Thumbnail */}
              <div className="relative w-14 h-14 rounded-xl bg-gradient-to-b from-black/[0.04] dark:from-white/[0.05] to-transparent p-1 border border-black/[0.06] dark:border-white/[0.08] shrink-0 flex items-center justify-center overflow-hidden">
                <Image
                  src={capImage}
                  alt={capName}
                  width={56}
                  height={56}
                  className="object-contain drop-shadow-md"
                />
              </div>

              {/* Text & Guidance */}
              <div className="flex-1 min-w-0">
                <h4 className="font-display font-bold text-xs sm:text-sm text-zinc-900 dark:text-white truncate">
                  {capName}
                </h4>
                <p className="text-[11px] sm:text-xs text-zinc-600 dark:text-zinc-400 mt-1 leading-relaxed">
                  {t("toastDesc")}
                </p>
              </div>
            </div>

            {/* URL pill with quick re-copy */}
            <div className="mt-3 p-2 rounded-xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.05] dark:border-white/[0.05] flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 truncate select-all">
                {url}
              </span>
              <button
                onClick={handleReCopy}
                className="shrink-0 p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                title={t("copyLink")}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 mt-3 pt-2">
              <button
                onClick={handleWhatsAppShare}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-display font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-950/20"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>{t("whatsAppAction")}</span>
              </button>

              <button
                onClick={hideShareToast}
                className="py-2 px-3 rounded-xl text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-display font-medium text-xs hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                {t("dismiss")}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
