"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { useStore } from "@/store/useStore";
import { useSafeUser, SafeSignInButton } from "@/lib/useSafeUser";
import { useAction } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import {
  ShieldCheck,
  Package,
  ShoppingBag,
  ArrowRight,
  Loader2,
  ExternalLink,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";

export default function CheckoutPage() {
  const t = useTranslations("checkout");
  const locale = useLocale();
  const { user, isLoaded, isSignedIn } = useSafeUser();
  const { cart, currency } = useStore();
  const createCheckoutSession = useAction(api.stripe.createCheckoutSession);

  const [status, setStatus] = useState<"idle" | "connecting" | "redirecting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stripeUrl, setStripeUrl] = useState<string | null>(null);
  const hasInitiatedRef = useRef(false);
  const isSubmittingRef = useRef(false);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => {
    return sum + item.priceUsd * item.quantity;
  }, 0);
  const freeShipping = totalItems >= 2;
  const shippingFee = freeShipping ? 0 : 8;
  const total = subtotal + shippingFee;

  const handleCheckout = async () => {
    if (cart.length === 0 || !user?.id || isSubmittingRef.current) return;

    try {
      isSubmittingRef.current = true;
      setStatus("connecting");
      setErrorMessage(null);

      const result = await createCheckoutSession({
        items: cart.map((item) => ({
          variantId: item.id,
          quantity: item.quantity,
        })),
        currency,
        locale,
        origin: window.location.origin,
        clerkUserId: user.id,
        customerEmail: user.primaryEmailAddress?.emailAddress,
      });

      if (result.url) {
        setStripeUrl(result.url);
        setStatus("redirecting");
        window.location.href = result.url;
      } else {
        throw new Error("Stripe checkout gateway did not return a valid session URL.");
      }
    } catch (err: any) {
      console.error("Checkout dispatch error:", err);
      isSubmittingRef.current = false;
      setStatus("error");
      setErrorMessage(err?.data || err?.message || "Failed to establish Stripe checkout session.");
    }
  };

  // Automatically initiate checkout as soon as the authenticated user and cart are ready
  useEffect(() => {
    if (isLoaded && isSignedIn && user?.id && cart.length > 0 && !hasInitiatedRef.current) {
      hasInitiatedRef.current = true;
      handleCheckout();
    }
  }, [isLoaded, isSignedIn, user?.id, cart.length]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
      <div className="w-full max-w-lg">
        {/* Loading User Identity */}
        {!isLoaded ? (
          <div className="p-8 sm:p-10 rounded-3xl glass-card border border-black/[0.08] dark:border-white/[0.08] text-center space-y-4">
            <Loader2 className="w-10 h-10 text-moya-red animate-spin mx-auto" />
            <p className="font-display font-bold text-sm text-zinc-900 dark:text-white">
              Authenticating session...
            </p>
          </div>
        ) : !isSignedIn ? (
          /* Unauthenticated Fallback */
          <div className="p-8 sm:p-10 rounded-3xl glass-card border border-black/[0.08] dark:border-white/[0.08] text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 rounded-2xl bg-moya-red/10 border border-moya-red/20 flex items-center justify-center text-moya-red mx-auto">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-zinc-900 dark:text-white">
                Collector Authentication Required
              </h2>
              <p className="text-xs text-zinc-500 mt-1.5 max-w-sm mx-auto">
                Sign in or register to secure your 0880 drop. You will be redirected immediately to payment.
              </p>
            </div>
            <SafeSignInButton
              mode="modal"
              forceRedirectUrl={`/${locale}/checkout`}
              fallbackRedirectUrl={`/${locale}/checkout`}
              signUpForceRedirectUrl={`/${locale}/checkout`}
              signUpFallbackRedirectUrl={`/${locale}/checkout`}
            >
              <button className="w-full py-3.5 rounded-2xl bg-moya-red hover:bg-rose-500 text-white font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl shadow-moya-red-deep/40">
                <span>Sign In & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </SafeSignInButton>
          </div>
        ) : cart.length === 0 ? (
          /* Empty Bag State */
          <div className="p-8 sm:p-10 rounded-3xl glass-card border border-black/[0.08] dark:border-white/[0.08] text-center space-y-5 shadow-xl">
            <div className="w-16 h-16 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center text-zinc-400 mx-auto">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-display font-bold text-zinc-900 dark:text-white">
                {t("emptyTitle")}
              </h2>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
                {t("emptySubtitle")}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <Link
                href="/#catalog"
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-moya-red hover:bg-rose-500 text-white font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-moya-red/30"
              >
                <span>{t("exploreCta")}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/account/orders"
                className="w-full sm:w-auto px-6 py-3 rounded-2xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-black/[0.06] dark:border-white/[0.06]"
              >
                <Package className="w-3.5 h-3.5 text-moya-red" />
                <span>{t("viewOrders")}</span>
              </Link>
            </div>
          </div>
        ) : (
          /* Active Checkout Dispatch Screen */
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 sm:p-8 rounded-3xl glass-card border border-black/[0.08] dark:border-white/[0.08] shadow-2xl space-y-6"
          >
            {/* Header */}
            <div className="text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-moya-red/10 border border-moya-red/20 text-moya-red text-xs font-mono font-bold uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-moya-red animate-pulse" />
                <span>0880 Good Luck Drop</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-zinc-900 dark:text-white">
                {t("title")}
              </h1>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                {status === "redirecting" ? t("redirecting") : t("subtitle")}
              </p>
            </div>

            {/* Visual Progress Bar */}
            <div className="w-full bg-black/10 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
              <motion.div
                className="bg-gradient-to-r from-moya-red via-moya-violet to-moya-green h-full rounded-full"
                animate={{
                  x: ["-100%", "100%"],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 1.5,
                  ease: "easeInOut",
                }}
                style={{ width: "60%" }}
              />
            </div>

            {/* Cart Overview */}
            <div className="p-4 rounded-2xl bg-black/[0.03] dark:bg-white/[0.03] border border-black/[0.06] dark:border-white/[0.06] space-y-3">
              <div className="flex items-center justify-between text-xs font-display font-bold text-zinc-900 dark:text-white pb-2 border-b border-black/[0.06] dark:border-white/[0.06]">
                <span>{t("orderSummary")}</span>
                <span className="font-mono font-normal text-zinc-500">
                  {totalItems} {t("items")}
                </span>
              </div>

              <div className="max-h-44 overflow-y-auto space-y-2 divide-y divide-black/[0.04] dark:divide-white/[0.04]">
                {cart.map((item) => (
                  <div key={item.id} className="pt-2 first:pt-0 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="relative w-9 h-9 rounded-lg bg-black/5 dark:bg-white/5 p-1 shrink-0">
                        <Image src={item.image} alt={item.name} fill className="object-contain" />
                      </div>
                      <span className="font-display font-semibold text-zinc-800 dark:text-zinc-200 truncate">
                        {item.name}
                      </span>
                    </div>
                    <span className="font-mono text-zinc-500 shrink-0">
                      {item.quantity}x • ${item.priceUsd}.00 USD
                    </span>
                  </div>
                ))}
              </div>

              {/* Price Breakdown */}
              <div className="pt-3 border-t border-black/[0.06] dark:border-white/[0.06] space-y-1.5 text-xs">
                <div className="flex justify-between text-zinc-500">
                  <span>{t("subtotal")}</span>
                  <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">
                    ${subtotal}.00 {currency}
                  </span>
                </div>
                <div className="flex justify-between text-zinc-500">
                  <span>{t("shipping")}</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-moya-green-light">
                    {freeShipping ? t("freeShipping") : `$${shippingFee}.00 ${currency}`}
                  </span>
                </div>
                <div className="flex justify-between font-display font-bold text-sm text-zinc-900 dark:text-white pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                  <span>{t("total")}</span>
                  <span className="font-mono text-emerald-600 dark:text-moya-green-light text-base">
                    ${total}.00 {currency}
                  </span>
                </div>
              </div>
            </div>

            {/* Status Messages & Manual Trigger */}
            {status === "error" ? (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center space-y-3">
                <div className="flex items-center justify-center gap-2 text-rose-500 text-xs font-display font-bold">
                  <AlertCircle className="w-4 h-4" />
                  <span>{t("outOfStockTitle")}</span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  {errorMessage || t("outOfStockDesc")}
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      isSubmittingRef.current = false;
                      handleCheckout();
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-moya-red hover:bg-rose-500 text-white font-display font-bold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-moya-red-deep/40"
                  >
                    {t("retry")}
                  </button>
                  <Link
                    href="/"
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-zinc-700 dark:text-zinc-300 font-display font-bold text-xs uppercase tracking-wider transition-colors border border-black/[0.08] dark:border-white/[0.08]"
                  >
                    {t("exploreCta")}
                  </Link>
                </div>
              </div>
            ) : stripeUrl ? (
              <div className="text-center space-y-2">
                <a
                  href={stripeUrl}
                  className="w-full py-3.5 rounded-2xl bg-moya-red hover:bg-rose-500 text-white font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl shadow-moya-red-deep/40"
                >
                  <span>Continue to Stripe</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
                <p className="text-[10px] text-zinc-500 font-mono">
                  {t("manualRedirect")}
                </p>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 text-xs font-mono text-zinc-500">
                <Loader2 className="w-4 h-4 text-moya-red animate-spin" />
                <span>{t("connectingGateway")}</span>
              </div>
            )}

            {/* Footer security badge */}
            <div className="flex items-center justify-center gap-2 text-[10px] font-mono text-zinc-500 pt-2">
              <ShieldCheck className="w-3.5 h-3.5 text-moya-green" />
              <span>{t("secureNotice")}</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
