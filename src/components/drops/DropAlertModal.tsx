"use client";

import React, { useState, useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, MessageSquare, Mail, CheckCircle2, Sparkles, Loader2, Send } from "lucide-react";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { useSafeUser } from "@/lib/useSafeUser";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import confetti from "canvas-confetti";

export function DropAlertModal() {
  const { dropAlertCap, closeDropAlert } = useStore();
  useLockBodyScroll(Boolean(dropAlertCap));
  const t = useTranslations("dropAlert");
  const locale = useLocale();
  const { user } = useSafeUser();

  const [channel, setChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [contact, setContact] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const subscribeMutation = useMutation(api.products.subscribeToDropAlert);

  // Auto-fill user info if available
  useEffect(() => {
    if (user) {
      if (user.fullName && !name) {
        setName(user.fullName);
      }
      const email = user.primaryEmailAddress?.emailAddress;
      if (email && channel === "email" && !contact) {
        setContact(email);
      }
    }
  }, [user, channel, dropAlertCap]);

  // Reset form when modal opens
  useEffect(() => {
    if (dropAlertCap) {
      setSubmittedSuccess(false);
      setAlreadySubscribed(false);
      setErrorMessage(null);
      if (user?.primaryEmailAddress?.emailAddress && channel === "email") {
        setContact(user.primaryEmailAddress.emailAddress);
      }
    }
  }, [dropAlertCap?.id]);

  if (!dropAlertCap) return null;

  const capName = locale === "es" ? dropAlertCap.nameEs : dropAlertCap.nameEn;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanContact = contact.trim();
    if (!cleanContact) {
      setErrorMessage(channel === "whatsapp" ? "Please enter your WhatsApp number" : "Please enter your email");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await subscribeMutation({
        variantId: dropAlertCap.id,
        contact: cleanContact,
        channel,
        name: name.trim() || undefined,
        clerkUserId: user?.id,
        locale,
      });

      if (result.alreadySubscribed) {
        setAlreadySubscribed(true);
      } else {
        setSubmittedSuccess(true);
        confetti({
          particleCount: 45,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#e11d48", "#10b981", "#fbbf24"],
        });
      }
    } catch (err: any) {
      console.error("Failed to subscribe to drop alert", err);
      setErrorMessage(err?.message || "Failed to secure VIP alert. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenWhatsAppTest = () => {
    const text = encodeURIComponent(
      locale === "es"
        ? `¡Hola Moya Caps! Acabo de registrarme para la Alerta VIP del drop: ${capName}.`
        : `Hi Moya Caps! I just registered for the VIP Drop Alert for: ${capName}.`
    );
    window.open(`https://wa.me/5215500000000?text=${text}`, "_blank");
  };

  return (
    <AnimatePresence>
      <div
        onClick={closeDropAlert}
        data-lenis-prevent
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md overflow-y-auto overscroll-contain"
        style={{ overscrollBehavior: "contain" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
          data-lenis-prevent
          className="relative w-full max-w-lg glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-7 border border-black/[0.08] dark:border-white/[0.08] shadow-2xl overflow-hidden overscroll-contain max-h-[90vh] overflow-y-auto"
          style={{ overscrollBehavior: "contain" }}
        >
          {/* Glowing Top Radar Accent */}
          <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-48 h-24 bg-moya-red/20 blur-2xl pointer-events-none rounded-full" />

          {/* Close Button */}
          <button
            onClick={closeDropAlert}
            className="absolute top-4 right-4 p-2 rounded-full glass-dark text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors z-20"
            aria-label={t("close")}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Header Preview */}
          <div className="flex items-center gap-3.5 mb-5">
            <div className="relative w-16 h-16 rounded-xl bg-zinc-100 dark:bg-zinc-900/60 border border-black/[0.06] dark:border-white/[0.06] p-1 shrink-0 overflow-hidden flex items-center justify-center">
              <Image
                src={dropAlertCap.image}
                alt={capName}
                width={56}
                height={56}
                className="object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider text-moya-red uppercase font-semibold">
                <Sparkles className="w-3 h-3" />
                <span>VIP DROP TELEMETRY</span>
              </div>
              <h3 className="font-display font-extrabold text-base sm:text-lg text-zinc-900 dark:text-white truncate">
                {capName}
              </h3>
              <p className="text-[11px] font-mono text-zinc-500">
                ${dropAlertCap.priceUsd}.00 USD • Limited Edition 0880
              </p>
            </div>
          </div>

          {/* Body Content */}
          {submittedSuccess || alreadySubscribed ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center py-4 sm:py-6"
            >
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mb-3 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="font-display font-bold text-lg text-zinc-900 dark:text-white mb-1">
                {alreadySubscribed ? t("alreadySubscribed") : t("successTitle")}
              </h4>
              <p className="text-xs sm:text-sm text-zinc-500 max-w-sm mb-6">
                {t("successDesc", { name: capName })}
              </p>

              <div className="flex flex-col sm:flex-row gap-2.5 w-full">
                {channel === "whatsapp" && (
                  <button
                    onClick={handleOpenWhatsAppTest}
                    className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-900/20"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>{t("whatsappTestBtn")}</span>
                  </button>
                )}
                <button
                  onClick={closeDropAlert}
                  className="py-3 px-5 rounded-xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 font-display font-bold text-xs uppercase tracking-wider transition-all"
                >
                  {t("close")}
                </button>
              </div>
            </motion.div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mb-3 leading-relaxed">
                  {t("subtitle")}
                </p>

                {/* Channel Switcher */}
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900/80 border border-black/[0.05] dark:border-white/[0.05]">
                  <button
                    type="button"
                    onClick={() => setChannel("whatsapp")}
                    className={`py-2 px-3 rounded-lg text-xs font-display font-semibold flex items-center justify-center gap-2 transition-all ${
                      channel === "whatsapp"
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-black/5 dark:border-white/5"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{t("channelWhatsApp")}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel("email")}
                    className={`py-2 px-3 rounded-lg text-xs font-display font-semibold flex items-center justify-center gap-2 transition-all ${
                      channel === "email"
                        ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-sm border border-black/5 dark:border-white/5"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5 text-moya-red" />
                    <span>{t("channelEmail")}</span>
                  </button>
                </div>
              </div>

              {/* Contact Input */}
              <div>
                <label className="block text-[11px] font-display font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {channel === "whatsapp" ? t("contactLabelWhatsApp") : t("contactLabelEmail")}
                </label>
                <div className="relative">
                  {channel === "whatsapp" ? (
                    <MessageSquare className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  ) : (
                    <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  )}
                  <input
                    type={channel === "whatsapp" ? "tel" : "email"}
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder={
                      channel === "whatsapp"
                        ? t("contactPlaceholderWhatsApp")
                        : t("contactPlaceholderEmail")
                    }
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-zinc-900/80 border border-black/[0.1] dark:border-white/[0.08] focus:border-moya-red focus:ring-1 focus:ring-moya-red text-xs sm:text-sm text-zinc-900 dark:text-white outline-none transition-all placeholder:text-zinc-400"
                    required
                  />
                </div>
              </div>

              {/* Collector Tag / Name (Optional) */}
              <div>
                <label className="block text-[11px] font-display font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t("nameLabel")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("namePlaceholder")}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-zinc-900/80 border border-black/[0.1] dark:border-white/[0.08] focus:border-moya-red focus:ring-1 focus:ring-moya-red text-xs sm:text-sm text-zinc-900 dark:text-white outline-none transition-all placeholder:text-zinc-400"
                />
              </div>

              {errorMessage && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-mono">
                  {errorMessage}
                </div>
              )}

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-moya-red hover:bg-rose-500 active:bg-moya-red-deep disabled:opacity-50 text-white font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-moya-red-deep/30"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t("submitting")}</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-4 h-4" />
                    <span>{t("submitBtn")}</span>
                  </>
                )}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
