"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { useStore } from "@/store/useStore";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import {
  CheckCircle2,
  Package,
  Truck,
  MessageCircle,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  MapPin,
  Clock,
  Sparkles,
} from "lucide-react";
import confetti from "canvas-confetti";

export default function CheckoutSuccessPage() {
  const t = useTranslations("checkoutSuccess");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { clearCart } = useStore();

  const sessionId = searchParams.get("session_id") || "";
  const orderNumberParam = searchParams.get("order_number") || "";
  const isMock = searchParams.get("mock") === "true";

  const [copied, setCopied] = useState(false);

  // Clear cart on successful checkout
  useEffect(() => {
    clearCart();

    // Trigger celebratory confetti burst
    confetti({
      particleCount: 70,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#e11d48", "#059669", "#a855f7", "#fbbf24"],
    });

    const timer = setTimeout(() => {
      confetti({
        particleCount: 40,
        spread: 100,
        origin: { y: 0.7, x: 0.3 },
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [clearCart]);

  // Query order from Convex
  const lookupKey = sessionId || orderNumberParam;
  const order = useQuery(
    api.orders.getOrderBySessionOrNumber,
    lookupKey ? { identifier: lookupKey } : "skip"
  );

  const displayOrderNumber = order?.orderNumber || orderNumberParam || "MC-0880-SECURED";
  const trackingNumber = order?.trackingNumber || "MC-TRK-748921";

  const handleCopyOrder = () => {
    navigator.clipboard.writeText(displayOrderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppAlerts = () => {
    const text = encodeURIComponent(
      locale === "es"
        ? `¡Hola Moya Caps! Acabo de completar mi orden #${displayOrderNumber}. Me gustaría recibir actualizaciones de rastreo por WhatsApp.`
        : `Hi Moya Caps! I just secured Order #${displayOrderNumber}. I would like to receive tracking updates via WhatsApp.`
    );
    window.open(`https://wa.me/5215500000000?text=${text}`, "_blank");
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      {/* ── Confirmation Hero ── */}
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-500 shadow-2xl shadow-emerald-950/30">
            <CheckCircle2 className="w-9 h-9 sm:w-11 sm:h-11 text-emerald-500" />
          </div>
          <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-moya-red flex items-center justify-center text-white text-[10px] font-bold shadow">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
          <span>{t("badge")}</span>
          <span>•</span>
          <span>0880 GOOD LUCK</span>
        </div>

        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-zinc-900 dark:text-white tracking-tight">
          {t("title")}
        </h1>

        <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-md mt-2">
          {t("subtitle", { orderNumber: displayOrderNumber })}
        </p>

        {/* Order & Tracking Badges */}
        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          <button
            onClick={handleCopyOrder}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl glass-dark border border-black/[0.08] dark:border-white/[0.08] text-xs font-mono text-zinc-800 dark:text-zinc-200 hover:border-moya-red transition-all"
            title="Click to copy order number"
          >
            <span>Order #{displayOrderNumber}</span>
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
          </button>

          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl glass-dark border border-black/[0.08] dark:border-white/[0.08] text-xs font-mono text-zinc-600 dark:text-zinc-400">
            <span className="text-zinc-500">{t("trackingStub")}:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{trackingNumber}</span>
          </div>

          {isMock && (
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-400 text-[11px] font-mono font-bold">
              Simulation Sandbox Mode
            </span>
          )}
        </div>
      </div>

      {/* ── Order Stepper Timeline ── */}
      <div className="mt-10 p-5 sm:p-6 rounded-3xl glass-card border border-black/[0.06] dark:border-white/[0.06] shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Step 1 */}
          <div className="flex items-center gap-3.5 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-md">
              <Check className="w-4 h-4 font-bold" />
            </div>
            <div>
              <p className="font-display font-bold text-xs text-emerald-600 dark:text-emerald-400">
                {t("timelinePlaced")}
              </p>
              <p className="text-[11px] text-zinc-500">Stripe Verified</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-center gap-3.5 p-3 rounded-2xl glass-dark border border-black/[0.06] dark:border-white/[0.06]">
            <div className="w-9 h-9 rounded-xl bg-moya-red/20 text-moya-red border border-moya-red/30 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <p className="font-display font-bold text-xs text-zinc-900 dark:text-white">
                {t("timelinePacking")}
              </p>
              <p className="text-[11px] text-zinc-500">Rigid Collector Box</p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex items-center gap-3.5 p-3 rounded-2xl glass-dark border border-black/[0.06] dark:border-white/[0.06] opacity-75">
            <div className="w-9 h-9 rounded-xl bg-zinc-500/10 text-zinc-400 flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <p className="font-display font-semibold text-xs text-zinc-700 dark:text-zinc-300">
                {t("timelineDispatch")}
              </p>
              <p className="text-[11px] text-zinc-500">2–4 Day Air Courier</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Order Details Breakdown & Shipping Address ── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mt-6">
        {/* Left: Items list */}
        <div className="md:col-span-7 p-5 sm:p-6 rounded-3xl glass-card border border-black/[0.06] dark:border-white/[0.06] flex flex-col gap-4">
          <h2 className="font-display font-bold text-base text-zinc-900 dark:text-white flex items-center gap-2">
            <Package className="w-4 h-4 text-moya-red" />
            <span>{t("itemsTitle")}</span>
          </h2>

          <div className="space-y-3 divide-y divide-black/[0.06] dark:divide-white/[0.06]">
            {order?.items && order.items.length > 0 ? (
              order.items.map((item, idx) => (
                <div key={idx} className="pt-3 first:pt-0 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-xl bg-black/5 dark:bg-white/5 p-1 shrink-0">
                      <Image src={item.image} alt={item.name} fill className="object-contain" />
                    </div>
                    <div>
                      <h4 className="font-display font-bold text-xs sm:text-sm text-zinc-900 dark:text-white">
                        {item.name}
                      </h4>
                      <p className="text-[11px] font-mono text-zinc-500">Qty: {item.quantity}</p>
                    </div>
                  </div>
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-moya-green-light whitespace-nowrap">
                    ${item.price * item.quantity}.00 {order.currency}
                  </span>
                </div>
              ))
            ) : (
              <div className="py-4 text-center text-xs text-zinc-500">
                <span>0880 Good Luck Signature Edition</span>
              </div>
            )}
          </div>

          {/* Pricing Totals */}
          {order && (
            <div className="pt-4 border-t border-black/[0.06] dark:border-white/[0.06] space-y-1.5 text-xs">
              <div className="flex justify-between text-zinc-500">
                <span>{t("subtotal")}</span>
                <span className="font-mono text-zinc-800 dark:text-zinc-200">
                  ${order.subtotal || order.total}.00 {order.currency}
                </span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>{t("shipping")}</span>
                <span className="font-mono text-emerald-600 dark:text-moya-green-light font-semibold">
                  {order.shippingFee === 0 ? "FREE" : `$${order.shippingFee}.00 ${order.currency}`}
                </span>
              </div>
              <div className="flex justify-between font-display font-bold text-sm text-zinc-900 dark:text-white pt-2 border-t border-black/[0.06] dark:border-white/[0.06]">
                <span>{t("total")}</span>
                <span className="font-mono text-emerald-600 dark:text-moya-green-light text-base">
                  ${order.total}.00 {order.currency}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Right: Shipping Address & WhatsApp Alerts */}
        <div className="md:col-span-5 flex flex-col gap-4">
          {/* Address Box */}
          <div className="p-5 rounded-3xl glass-card border border-black/[0.06] dark:border-white/[0.06]">
            <h3 className="font-display font-bold text-xs uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 mb-3">
              <MapPin className="w-3.5 h-3.5 text-moya-green" />
              <span>{t("deliveryAddress")}</span>
            </h3>

            {order?.shippingAddress ? (
              <div className="space-y-1 text-xs text-zinc-800 dark:text-zinc-200">
                <p className="font-bold">{order.customerName || "Collector"}</p>
                <p>{order.shippingAddress.line1}</p>
                {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
                <p>
                  {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
                </p>
                <p className="font-mono uppercase text-zinc-500">{order.shippingAddress.country}</p>
                {order.customerPhone && <p className="text-zinc-500 mt-2 font-mono">{order.customerPhone}</p>}
              </div>
            ) : (
              <div className="text-xs text-zinc-500 space-y-1">
                <p>Standard Express Delivery Address</p>
                <p className="text-[11px] text-zinc-400">Captured securely via Stripe Checkout</p>
              </div>
            )}
          </div>

          {/* WhatsApp Tracking CTA */}
          <button
            onClick={handleWhatsAppAlerts}
            className="w-full py-3.5 rounded-2xl bg-moya-green-deep/90 hover:bg-moya-green text-white font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-moya-green-deep/30 active:scale-[0.98]"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{t("whatsappUpdates")}</span>
          </button>

          {/* Account Portal Link */}
          <Link
            href="/account/orders"
            className="w-full py-3 rounded-2xl glass-dark hover:bg-black/5 dark:hover:bg-white/10 text-zinc-900 dark:text-white font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-black/[0.06] dark:border-white/[0.06]"
          >
            <span>{t("viewOrders")}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>

          <Link
            href="/"
            className="text-center text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors font-display"
          >
            {t("continueShopping")}
          </Link>
        </div>
      </div>
    </div>
  );
}
