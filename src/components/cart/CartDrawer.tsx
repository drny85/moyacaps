"use client";

import { useStore } from "@/store/useStore";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, ArrowLeft, MessageCircle, ShieldCheck, Check, AlertCircle, Loader2, MapPin, Clock, ChevronDown, CreditCard, Edit3 } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { useSafeUser, SafeSignInButton } from "@/lib/useSafeUser";
import { useLockBodyScroll } from "@/lib/useLockBodyScroll";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getWhatsAppOrderUrl, formatUsd } from "@/lib/whatsapp";
import { capitalizeWords } from "@/lib/usStates";

export function CartDrawer() {
  const { cart, isCartOpen, closeCart, updateQuantity, removeFromCart, clearCart, currency, clampCartToStock } = useStore();
  useLockBodyScroll(isCartOpen);
  const t = useTranslations("cart");
  const locale = useLocale();
  const router = useRouter();
  const { user, isSignedIn } = useSafeUser();
  const createCheckoutSession = useAction(api.stripe.createCheckoutSession);
  const createWhatsAppCheckoutSession = useAction(api.stripe.createWhatsAppCheckoutSession);
  const convexVariants = useQuery(api.products.getVariants, {
    includeUnavailable: true,
  });

  const [checkoutStep, setCheckoutStep] = useState<"idle" | "processing" | "success">("idle");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [stockAdjustmentNotice, setStockAdjustmentNotice] = useState<string | null>(null);

  // WhatsApp pre-redirect lead state
  const [isWhatsAppFormOpen, setIsWhatsAppFormOpen] = useState(false);
  const [waName, setWaName] = useState("");
  const [waEmail, setWaEmail] = useState("");
  const [waPhone, setWaPhone] = useState("");
  const [waFieldErrors, setWaFieldErrors] = useState<Record<string, string>>({});
  const [waFormError, setWaFormError] = useState<string | null>(null);
  const [isSubmittingWhatsApp, setIsSubmittingWhatsApp] = useState(false);
  // Reservation confirmed state: rendered inside the drawer with a native <a> link so
  // popup blockers can't kill the WhatsApp handoff (window.open after await is blocked).
  const [waReservation, setWaReservation] = useState<{
    orderNumber: string;
    waUrl: string;
    trackUrl: string;
  } | null>(null);

  useEffect(() => {
    if (user?.fullName && !waName) {
      setWaName(user.fullName);
    }
    if (user?.primaryEmailAddress?.emailAddress && !waEmail) {
      setWaEmail(user.primaryEmailAddress.emailAddress);
    }
  }, [user, waName, waEmail]);

  // Synchronize cart with live Convex database stock whenever drawer is opened or variants change
  useEffect(() => {
    if (isCartOpen && convexVariants && convexVariants.length > 0) {
      const result = clampCartToStock(convexVariants);
      if (result.adjusted) {
        setStockAdjustmentNotice(
          `${t("stockAdjusted")}${result.adjustedNames.length > 0 ? ` (${result.adjustedNames.join(", ")})` : ""}`
        );
      }
    }
  }, [isCartOpen, convexVariants, clampCartToStock, t]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = cart.reduce((sum, item) => {
    return sum + item.priceUsd * item.quantity;
  }, 0);

  // Check if any cart item exceeds live stock or is unavailable
  const hasOutOfStockItem = cart.some((item) => {
    const variant = convexVariants?.find((v) => v.variantId === item.id);
    if (!variant) return false;
    return variant.isAvailable === false || variant.stock <= 0 || item.quantity > variant.stock;
  });

  // Check if any cart item is an unreleased upcoming drop
  const hasUnreleasedDropItem = cart.some((item) => {
    const variant = convexVariants?.find((v) => v.variantId === item.id);
    if (!variant) return false;
    return Boolean(
      variant.isDrop &&
      variant.dropStatus !== "live" &&
      ((typeof variant.dropDate === "number" && Date.now() < variant.dropDate) || variant.dropStatus === "scheduled")
    );
  });

  const cannotCheckout = hasOutOfStockItem || hasUnreleasedDropItem;

  // Free shipping threshold: 2+ caps
  const freeShippingUnlocked = totalItems >= 2;
  const shippingFee = freeShippingUnlocked ? 0 : 8;
  const total = subtotal + shippingFee;

  // Open WhatsApp pre-redirect lead capture form
  const handleWhatsAppOrder = () => {
    if (cannotCheckout || checkoutStep === "processing") return;
    setWaFieldErrors({});
    setWaFormError(null);
    setIsWhatsAppFormOpen(true);
  };

  const localizeConciergeError = (raw: string | undefined): string => {
    const msg = raw || "";
    if (msg.includes("MAX_ACTIVE_RESERVATIONS")) {
      return locale === "es"
        ? "Ya tienes 3 reservas activas pendientes de pago. Completa el pago o espera a que caduquen."
        : "You already have 3 active reservations awaiting payment. Complete a payment or wait for holds to expire.";
    }
    if (msg.includes("RESERVATION_RATE_LIMITED")) {
      return locale === "es"
        ? "Has creado muchas reservas recientemente. Inténtalo más tarde."
        : "Too many reservations created recently. Please try again later.";
    }
    if (msg.includes("PAYMENT_LINK_FAILED")) {
      return locale === "es"
        ? "No pudimos generar tu enlace de pago. Inténtalo de nuevo o escríbenos por WhatsApp."
        : "We could not generate your payment link. Please try again or message us on WhatsApp.";
    }
    if (msg.includes("MISSING_IDENTITY")) {
      return locale === "es"
        ? "Necesitamos tu correo para reservar."
        : "We need your email to hold a reservation.";
    }
    if (msg.includes("sold out") || msg.includes("Insufficient stock") || msg.includes("no longer available")) {
      return locale === "es"
        ? "Un artículo de tu bolsa se agotó. Revisa tu bolsa e inténtalo de nuevo."
        : "An item in your bag just sold out. Review your bag and try again.";
    }
    return locale === "es"
      ? "No pudimos reservar tu inventario. Inténtalo de nuevo."
      : "Failed to reserve inventory. Please try again.";
  };

  const handleConfirmAndLaunchWhatsApp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (cannotCheckout || isSubmittingWhatsApp) return;

    const trimmedName = capitalizeWords(waName.trim());
    const trimmedEmail = waEmail.trim().toLowerCase() || user?.primaryEmailAddress?.emailAddress || "";
    const trimmedPhone = waPhone.replace(/\D/g, "");

    const errors: Record<string, string> = {};
    if (!trimmedName || trimmedName.length < 2) {
      errors.name = locale === "es" ? "Ingresa tu nombre completo." : "Please enter your full name.";
    }
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      errors.email = locale === "es" ? "Ingresa un correo electrónico válido." : "Please enter a valid email address.";
    }
    // Phone is optional, but when provided it must be a dialable number (E.164 digits).
    if (trimmedPhone && trimmedPhone.length < 10) {
      errors.phone = locale === "es"
        ? "Ingresa un número de WhatsApp válido (con código de país)."
        : "Enter a valid WhatsApp number (with country code).";
    }

    if (Object.keys(errors).length > 0) {
      setWaFieldErrors(errors);
      setWaFormError(
        locale === "es"
          ? "Por favor completa correctamente tus datos para continuar."
          : "Please complete your details correctly to proceed."
      );
      return;
    }

    setWaFieldErrors({});
    setWaFormError(null);
    setIsSubmittingWhatsApp(true);

    try {
      const result = await createWhatsAppCheckoutSession({
        items: cart.map((i) => ({
          variantId: i.id,
          quantity: i.quantity,
        })),
        currency: "USD",
        locale,
        origin: window.location.origin,
        customerName: trimmedName,
        customerEmail: trimmedEmail,
        customerPhone: trimmedPhone || undefined,
        clerkUserId: user?.id || undefined,
      });

      // Itemized message from SERVER-VERIFIED totals, never client cart math.
      const waUrl = getWhatsAppOrderUrl({
        orderNumber: result.orderNumber,
        items: result.items,
        subtotal: result.subtotal,
        shippingFee: result.shippingFee,
        total: result.total,
        currency: "USD",
        customerName: trimmedName,
        customerEmail: trimmedEmail,
        customerPhone: trimmedPhone || undefined,
        paymentUrl: result.paymentUrl,
        locale,
      });

      const trackUrl = `/track?order=${encodeURIComponent(result.orderNumber)}&email=${encodeURIComponent(trimmedEmail)}`;

      confetti({
        particleCount: 60,
        spread: 80,
        origin: { y: 0.6 },
        colors: ["#e11d48", "#10b981", "#fbbf24"],
      });

      clearCart();
      setWaReservation({ orderNumber: result.orderNumber, waUrl, trackUrl });
    } catch (err: any) {
      console.error("WhatsApp checkout error:", err);
      setWaFormError(localizeConciergeError(err?.message));
    } finally {
      setIsSubmittingWhatsApp(false);
    }
  };

  const handleStripeCheckout = async () => {
    if (cannotCheckout || checkoutStep === "processing") return;

    try {
      setCheckoutStep("processing");
      setCheckoutError(null);
      const result = await createCheckoutSession({
        items: cart.map((i) => ({ variantId: i.id, quantity: i.quantity })),
        currency,
        locale,
        origin: window.location.origin,
        clerkUserId: user?.id,
        customerEmail: user?.primaryEmailAddress?.emailAddress,
      });

      if (result.url) {
        window.location.href = result.url;
      } else {
        throw new Error("Failed to initialize Stripe checkout session");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      setCheckoutError(err.message || "Failed to proceed to checkout");
      setCheckoutStep("idle");
    }
  };

  return (
    <AnimatePresence>
      {isCartOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCart}
            className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
          />

          {/* Drawer Panel */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            data-lenis-prevent
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-[#08080e] border-l border-black/[0.08] dark:border-white/[0.06] flex flex-col shadow-2xl transition-colors duration-300 overscroll-contain"
            style={{ overscrollBehavior: "contain" }}
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
              {isWhatsAppFormOpen ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsWhatsAppFormOpen(false)}
                    className="p-1.5 rounded-lg glass-dark text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                    title="Back to Loot Bag"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Concierge
                      </span>
                      <h2 className="font-display font-bold text-base text-zinc-900 dark:text-white">
                        {t("whatsappLeadTitle")}
                      </h2>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-mono">
                      {totalItems} {totalItems === 1 ? "cap" : "caps"} • Total: {formatUsd(total)} USD
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-moya-red" />
                  <h2 className="font-display font-bold text-lg text-zinc-900 dark:text-white">{t("title")}</h2>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-zinc-700 dark:text-zinc-300">
                    {totalItems}
                  </span>
                </div>
              )}
              <button
                onClick={closeCart}
                className="p-2 rounded-full glass-dark text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isWhatsAppFormOpen && waReservation ? (
              <div className="flex-1 flex flex-col overflow-y-auto p-6 gap-4">
                <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-center space-y-3">
                  <Check className="w-10 h-10 text-emerald-600 dark:text-emerald-400 mx-auto" />
                  <h3 className="font-display font-bold text-base text-zinc-900 dark:text-white">
                    {locale === "es" ? "¡Reserva confirmada!" : "Reservation held!"}
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {locale === "es"
                      ? `Tu pedido ${waReservation.orderNumber} está reservado por 24 horas. El concierge lo revisará y te enviará el enlace de pago seguro por WhatsApp.`
                      : `Order ${waReservation.orderNumber} is held for 24 hours. The concierge reviews it and sends your secure payment link on WhatsApp.`}
                  </p>
                </div>

                <a
                  href={waReservation.waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    setIsWhatsAppFormOpen(false);
                    setWaReservation(null);
                    closeCart();
                  }}
                  className="w-full py-3.5 rounded-2xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 active:scale-[0.99]"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{locale === "es" ? "Enviar pedido por WhatsApp" : "Send order on WhatsApp"}</span>
                  <ArrowRight className="w-4 h-4" />
                </a>

                <button
                  type="button"
                  onClick={() => {
                    setIsWhatsAppFormOpen(false);
                    setWaReservation(null);
                    closeCart();
                    router.push(waReservation.trackUrl);
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-display uppercase tracking-wider text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  {locale === "es" ? "Ver mi pedido" : "Track my order"}
                </button>
              </div>
            ) : isWhatsAppFormOpen ? (
              <div className="flex-1 flex flex-col overflow-y-auto">
                {/* 24-hr Hold + US Shipping Indicator */}
                <div className="px-6 py-2.5 bg-emerald-500/10 dark:bg-emerald-950/20 border-b border-emerald-500/20 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono font-semibold">
                    <Clock className="w-3.5 h-3.5" />
                    <span>24h Stock Reservation</span>
                  </div>
                  <span className="text-[11px] font-mono text-zinc-500">US Domestic Only</span>
                </div>

                <form
                  onSubmit={handleConfirmAndLaunchWhatsApp}
                  data-lenis-prevent
                  className="flex-1 p-6 space-y-4 overflow-y-auto"
                >
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                    {t("whatsappLeadSubtitle")}
                  </p>

                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center gap-2">
                    <MapPin className="w-4 h-4 shrink-0 text-amber-500" />
                    <span>{t("whatsappUsOnlyNotice")}</span>
                  </div>

                  {/* Input Fields: Name & Email */}
                  <div className="space-y-3 pt-1">
                    {/* Full Name */}
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
                        {t("whatsappLeadName")} *
                      </label>
                      <input
                        type="text"
                        value={waName}
                        onChange={(e) => {
                          setWaName(e.target.value);
                          if (waFieldErrors.name) setWaFieldErrors((prev) => ({ ...prev, name: "" }));
                        }}
                        placeholder={t("whatsappLeadNamePlaceholder")}
                        className={`w-full px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none capitalize transition-colors ${
                          waFieldErrors.name
                            ? "border-rose-500 focus:border-rose-500"
                            : "border-black/[0.08] dark:border-white/[0.08] focus:border-emerald-500"
                        }`}
                      />
                      {waFieldErrors.name && (
                        <p className="text-[10px] text-rose-500 mt-1 flex items-center gap-1 font-medium">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          {waFieldErrors.name}
                        </p>
                      )}
                    </div>

                    {/* Email Address */}
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
                        {t("whatsappLeadEmail")} *
                      </label>
                      <input
                        type="email"
                        value={waEmail}
                        onChange={(e) => {
                          setWaEmail(e.target.value.toLowerCase());
                          if (waFieldErrors.email) setWaFieldErrors((prev) => ({ ...prev, email: "" }));
                        }}
                        placeholder={t("whatsappLeadEmailPlaceholder")}
                        className={`w-full px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none transition-colors ${
                          waFieldErrors.email
                            ? "border-rose-500 focus:border-rose-500"
                            : "border-black/[0.08] dark:border-white/[0.08] focus:border-emerald-500"
                        }`}
                      />
                      {waFieldErrors.email && (
                        <p className="text-[10px] text-rose-500 mt-1 flex items-center gap-1 font-medium">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          {waFieldErrors.email}
                        </p>
                      )}
                    </div>

                    {/* WhatsApp Phone (optional — enables direct payment-link delivery) */}
                    <div>
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500 mb-1">
                        {t("whatsappLeadPhone")}
                      </label>
                      <input
                        type="tel"
                        value={waPhone}
                        onChange={(e) => {
                          setWaPhone(e.target.value);
                          if (waFieldErrors.phone) setWaFieldErrors((prev) => ({ ...prev, phone: "" }));
                        }}
                        placeholder={t("whatsappLeadPhonePlaceholder")}
                        dir="ltr"
                        className={`w-full px-3.5 py-2.5 rounded-xl bg-black/5 dark:bg-white/5 border text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none transition-colors ${
                          waFieldErrors.phone
                            ? "border-rose-500 focus:border-rose-500"
                            : "border-black/[0.08] dark:border-white/[0.08] focus:border-emerald-500"
                        }`}
                      />
                      {waFieldErrors.phone ? (
                        <p className="text-[10px] text-rose-500 mt-1 flex items-center gap-1 font-medium">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          {waFieldErrors.phone}
                        </p>
                      ) : (
                        <p className="text-[10px] text-zinc-400 mt-1">
                          {locale === "es"
                            ? "Agrégalo para recibir tu enlace de pago directamente en WhatsApp."
                            : "Add it to receive your payment link directly on WhatsApp."}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Order Summary Card */}
                  <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.08] dark:border-white/[0.08] space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-display font-bold text-zinc-900 dark:text-white pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
                      <span>Order Summary</span>
                      <span className="font-mono text-[11px] font-normal text-zinc-500">
                        {totalItems} {totalItems === 1 ? "item" : "items"}
                      </span>
                    </div>

                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                      {cart.map((item) => (
                        <div key={item.id} className="flex items-center gap-2.5 text-xs">
                          <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-black/5 dark:bg-white/5 shrink-0 border border-black/[0.04] dark:border-white/[0.04]">
                            <Image src={item.image} alt={item.name} fill className="object-contain" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-display font-bold text-zinc-900 dark:text-white truncate text-[11px]">
                              {item.name}
                            </p>
                            <p className="font-mono text-[10px] text-zinc-500">Qty: {item.quantity}</p>
                          </div>
                          <span className="font-mono font-bold text-[11px] text-zinc-900 dark:text-white shrink-0">
                            {formatUsd(item.priceUsd * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-black/[0.06] dark:border-white/[0.06] space-y-1 text-xs">
                      <div className="flex justify-between text-zinc-500 text-[11px]">
                        <span>Subtotal</span>
                        <span className="font-mono text-zinc-700 dark:text-zinc-300 font-medium">{formatUsd(subtotal)} USD</span>
                      </div>
                      <div className="flex justify-between text-zinc-500 text-[11px]">
                        <span>US Shipping</span>
                        <span className="font-mono text-emerald-600 dark:text-moya-green-light font-bold">
                          {shippingFee === 0 ? (locale === "es" ? "GRATIS (2+ gorras)" : "FREE (2+ caps)") : `${formatUsd(shippingFee)} USD`}
                        </span>
                      </div>
                      <div className="flex justify-between font-display font-bold text-zinc-900 dark:text-white pt-1 text-sm">
                        <span>Total (Pre-Tax)</span>
                        <span className="font-mono text-emerald-600 dark:text-moya-green-light">
                          {formatUsd(total)} USD
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Payment Options Note */}
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 text-xs flex items-start gap-2.5">
                    <CreditCard className="w-4 h-4 shrink-0 text-blue-500 mt-0.5" />
                    <span className="leading-relaxed">{t("whatsappReviewPaymentNote")}</span>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
                    <Clock className="w-4 h-4 shrink-0 text-emerald-500" />
                    <span>{t("whatsappReservationNotice")}</span>
                  </div>

                  {waFormError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{waFormError}</span>
                    </div>
                  )}

                  <div className="pt-2 space-y-2">
                    <button
                      type="submit"
                      disabled={isSubmittingWhatsApp}
                      className="w-full py-3.5 rounded-2xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
                    >
                      {isSubmittingWhatsApp ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>{t("whatsappGeneratingPayment")}</span>
                        </>
                      ) : (
                        <>
                          <MessageCircle className="w-4 h-4" />
                          <span>{t("whatsappLeadContinue")}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsWhatsAppFormOpen(false)}
                      disabled={isSubmittingWhatsApp}
                      className="w-full py-2.5 rounded-xl text-xs font-display uppercase tracking-wider text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer"
                    >
                      {locale === "es" ? "← Volver a la bolsa" : "← Back to Loot Bag"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <>
                {/* Free Shipping Progress Indicator */}
                <div className="px-6 py-3 bg-moya-red/10 dark:bg-moya-red-deep/20 border-b border-moya-red/20 text-xs">
                  {freeShippingUnlocked ? (
                    <p className="text-emerald-600 dark:text-moya-green-light font-display font-bold text-center">
                      {t("freeShippingAchieved")}
                    </p>
                  ) : (
                    <p className="text-zinc-700 dark:text-zinc-300 text-center">
                      {t("freeShippingRemaining", {
                        amount: locale === "es"
                          ? `${Math.max(0, 2 - totalItems)} gorra${Math.max(0, 2 - totalItems) === 1 ? "" : "s"} más`
                          : `${Math.max(0, 2 - totalItems)} more cap${Math.max(0, 2 - totalItems) === 1 ? "" : "s"}`,
                      })}
                    </p>
                  )}
                  <div className="w-full bg-black/10 dark:bg-black/50 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-moya-red to-moya-green h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (totalItems / 2) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Cart Items List */}
                <div
                  data-lenis-prevent
                  className="flex-1 overflow-y-auto p-6 space-y-4 overscroll-contain"
                  style={{ overscrollBehavior: "contain" }}
                >
                  {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center py-16">
                      <div className="w-16 h-16 rounded-2xl bg-black/5 dark:bg-white/5 border border-black/[0.06] dark:border-white/[0.06] flex items-center justify-center mb-4 text-zinc-400 dark:text-zinc-500">
                        <ShoppingBag className="w-8 h-8" />
                      </div>
                      <h3 className="text-lg font-display font-bold text-zinc-900 dark:text-white mb-1">
                        {t("emptyTitle")}
                      </h3>
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 max-w-xs mb-6">
                        {t("emptyDesc")}
                      </p>
                      <button
                        onClick={closeCart}
                        className="px-6 py-3 rounded-xl bg-moya-red hover:bg-rose-500 text-white text-xs font-display font-bold uppercase tracking-wider transition-colors"
                      >
                        {t("exploreBtn")}
                      </button>
                    </div>
                  ) : (
                    cart.map((item) => {
                      const variant = convexVariants?.find((v) => v.variantId === item.id);
                      const stock = variant ? (typeof variant.stock === "number" ? variant.stock : 0) : (item.maxStock ?? 99);
                      const isOutOfStock = stock <= 0;
                      const isAtMaxStock = item.quantity >= stock;

                      return (
                        <div
                          key={item.id}
                          className={`glass-card rounded-2xl p-3.5 flex items-center gap-4 border transition-all ${
                            isOutOfStock
                              ? "border-rose-500/40 bg-rose-500/5 opacity-80"
                              : "border-black/[0.06] dark:border-white/[0.06]"
                          }`}
                        >
                          <div className="relative w-16 h-16 rounded-xl bg-black/5 dark:bg-white/5 shrink-0 overflow-hidden p-1">
                            <Image
                              src={item.image}
                              alt={item.name}
                              fill
                              className="object-contain"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <h4 className="font-display font-bold text-sm text-zinc-900 dark:text-white truncate">
                                {item.name}
                              </h4>
                              {isOutOfStock && (
                                <span className="text-[10px] font-display font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-500 shrink-0">
                                  {t("soldOutItem")}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs font-mono font-bold text-emerald-600 dark:text-moya-green-light">
                          {formatUsd(item.priceUsd)} USD
                              </span>
                              {!isOutOfStock && isAtMaxStock && (
                                <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-medium">
                                  ({t("onlyXAvailable", { count: stock })})
                                </span>
                              )}
                            </div>

                            {/* Quantity adjust */}
                            <div className="flex items-center gap-3 mt-2">
                              <div className="flex items-center glass-dark rounded-lg border border-black/[0.06] dark:border-white/[0.06]">
                                <button
                                  onClick={() => updateQuantity(item.id, -1, stock)}
                                  className="px-2 py-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="px-2 text-xs font-mono font-bold text-zinc-900 dark:text-white">
                                  {item.quantity}
                                </span>
                                <button
                                  disabled={isAtMaxStock || isOutOfStock}
                                  onClick={() => updateQuantity(item.id, 1, stock)}
                                  className={`px-2 py-1 transition-colors ${
                                    isAtMaxStock || isOutOfStock
                                      ? "text-zinc-300 dark:text-zinc-600 cursor-not-allowed opacity-40"
                                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
                                  }`}
                                  title={isAtMaxStock ? t("onlyXAvailable", { count: stock }) : undefined}
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>

                              <button
                                onClick={() => removeFromCart(item.id)}
                                className="p-1.5 text-zinc-400 hover:text-moya-red transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Drawer Footer & Checkout Controls */}
                {cart.length > 0 && (
                  <div className="p-6 border-t border-black/[0.06] dark:border-white/[0.06] bg-zinc-50 dark:bg-[#07070c] space-y-4">
                    {stockAdjustmentNotice && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-amber-700 dark:text-amber-400 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{stockAdjustmentNotice}</span>
                      </div>
                    )}

                    {checkoutError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-start gap-2 text-rose-600 dark:text-rose-400 text-xs">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{checkoutError}</span>
                      </div>
                    )}

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                        <span>{t("subtotal")}</span>
                        <span className="font-mono text-zinc-900 dark:text-white font-semibold">
                          {formatUsd(subtotal)} USD
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                        <span>{t("shipping")}</span>
                        <span className="font-mono text-emerald-600 dark:text-moya-green-light font-bold">
                          {shippingFee === 0 ? t("shippingFree") : `${formatUsd(shippingFee)} USD`}
                        </span>
                      </div>
                      <div className="flex justify-between text-[11px] text-zinc-500">
                        <span>{t("tax")}</span>
                        <span className="font-mono italic text-zinc-400">
                          {t("taxesNotice")}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm font-display font-bold pt-2 border-t border-black/[0.06] dark:border-white/[0.06] text-zinc-900 dark:text-white">
                        <span>{t("total")}</span>
                        <span className="font-mono text-emerald-600 dark:text-moya-green-light text-base">
                          {formatUsd(total)} USD
                        </span>
                      </div>
                    </div>

                    {(
                      <div className="flex flex-col gap-2.5">
                        {/* Authentication Check & Stripe Card Checkout */}
                        {!isSignedIn ? (
                          <div className="space-y-1.5">
                            <SafeSignInButton
                              mode="modal"
                              forceRedirectUrl={`/${locale}/checkout`}
                              fallbackRedirectUrl={`/${locale}/checkout`}
                              signUpForceRedirectUrl={`/${locale}/checkout`}
                              signUpFallbackRedirectUrl={`/${locale}/checkout`}
                            >
                              <button
                                disabled={cannotCheckout}
                                className={`w-full py-3.5 rounded-2xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl ${
                                  cannotCheckout
                                    ? "bg-zinc-300 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                                    : "bg-zinc-900 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 text-white dark:text-zinc-900 hover:scale-[1.01] active:scale-[0.99]"
                                }`}
                              >
                                <span>{t("signInToCheckout")}</span>
                                <ArrowRight className="w-4 h-4 text-moya-red" />
                              </button>
                            </SafeSignInButton>
                            <p className="text-[10px] text-center text-zinc-500 leading-tight">
                              {t("signInNotice")}
                            </p>
                          </div>
                        ) : (
                          <button
                            onClick={handleStripeCheckout}
                            disabled={checkoutStep === "processing" || cannotCheckout}
                            className={`w-full py-3.5 rounded-2xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl ${
                              cannotCheckout
                                ? "bg-zinc-300 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                                : "bg-moya-red hover:bg-rose-500 text-white shadow-moya-red-deep/50"
                            }`}
                          >
                            {checkoutStep === "processing" ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin text-white" />
                                <span>Connecting to Gateway...</span>
                              </>
                            ) : hasUnreleasedDropItem ? (
                              <span>{locale === "es" ? "Drop no disponible aún" : "Drop Not Released Yet"}</span>
                            ) : hasOutOfStockItem ? (
                              <span>{t("soldOutItem")}</span>
                            ) : (
                              <>
                                <span>{t("checkoutStripe")}</span>
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        )}

                        {/* WhatsApp Direct Order Button */}
                        <button
                          onClick={handleWhatsAppOrder}
                          disabled={checkoutStep === "processing" || cannotCheckout}
                          className={`w-full py-3 rounded-2xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
                            cannotCheckout
                              ? "bg-zinc-300 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                              : "bg-moya-green-deep/80 hover:bg-moya-green text-white shadow-moya-green-deep/40"
                          }`}
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>{t("checkoutWhatsApp")}</span>
                        </button>

                        {hasUnreleasedDropItem && (
                          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-xs">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span className="leading-tight">
                              {locale === "es"
                                ? "Tu bolsa contiene un drop exclusivo que aún no se ha liberado. No puede ser comprado hasta su hora de lanzamiento."
                                : "Your bag contains an exclusive drop that has not been released yet. It cannot be purchased until launch."}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 text-center">
                      <ShieldCheck className="w-3.5 h-3.5 text-moya-green" />
                      <span>{t("secureCheckout")}</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
