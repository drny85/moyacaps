"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { Link } from "@/i18n/routing";
import { useTranslations, useLocale } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useQuery } from "convex/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  trackingLookupSchema,
  type TrackingLookupValues,
} from "@/lib/validations/tracking";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { api } from "../../../../convex/_generated/api";
import { getCarrierTrackingUrl } from "@/lib/tracking";
import {
  Package,
  Truck,
  CheckCircle2,
  Clock,
  ExternalLink,
  Search,
  MessageCircle,
  MapPin,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  XCircle,
  Lock,
} from "lucide-react";
import { useSafeUser, SafeSignInButton } from "@/lib/useSafeUser";

export default function TrackOrderPage() {
  const t = useTranslations("track");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const { isSignedIn } = useSafeUser();

  const initialOrder = searchParams.get("order") || "";
  const initialEmail = searchParams.get("email") || "";

  const [activeQuery, setActiveQuery] = useState<{
    orderNumber: string;
    email: string;
  } | null>(
    initialOrder && initialEmail
      ? { orderNumber: initialOrder, email: initialEmail }
      : null
  );

  const [hasSearched, setHasSearched] = useState(Boolean(initialOrder && initialEmail));

  const form = useForm<TrackingLookupValues>({
    resolver: zodResolver(trackingLookupSchema),
    defaultValues: {
      orderNumber: initialOrder,
      email: initialEmail,
    },
    mode: "onSubmit",
  });

  useEffect(() => {
    if (initialOrder || initialEmail) {
      form.reset({
        orderNumber: initialOrder,
        email: initialEmail,
      });
    }
  }, [initialOrder, initialEmail, form]);

  // Convex Query for guest / public order tracking
  const orderResult = useQuery(
    api.orders.getOrderByOrderNumberAndEmail,
    activeQuery
      ? { orderNumber: activeQuery.orderNumber, email: activeQuery.email }
      : "skip"
  );

  const isLoading = activeQuery !== null && orderResult === undefined;
  const isOwnerOrAdmin = Boolean(isSignedIn && orderResult && !orderResult.isGuestView);

  const handleSearchSubmit = (data: TrackingLookupValues) => {
    const cleanNum = data.orderNumber.trim().toUpperCase().replace(/^#/, "");
    const cleanMail = data.email.trim().toLowerCase();
    setActiveQuery({
      orderNumber: cleanNum,
      email: cleanMail,
    });
    setHasSearched(true);
  };

  const handleOpenWhatsAppConcierge = (orderNumber: string) => {
    const greeting =
      locale === "es"
        ? `¡Hola! Necesito asistencia con el seguimiento de mi pedido Moya Caps #${orderNumber}.`
        : `Hi! I need assistance tracking my Moya Caps order #${orderNumber}.`;
    const url = `https://wa.me/5215500000000?text=${encodeURIComponent(greeting)}`;
    window.open(url, "_blank");
  };

  const getStatusStep = (status: string) => {
    switch (status) {
      case "pending":
      case "whatsapp_initiated":
        return 1;
      case "paid":
        return 2;
      case "dispatched":
        return 3;
      case "delivered":
        return 4;
      case "cancelled":
        return -1;
      default:
        return 2;
    }
  };

  const currentStep = orderResult ? getStatusStep(orderResult.status) : 1;

  return (
    <div className="min-h-screen bg-[#fafafc] dark:bg-[#07070b] pt-28 pb-20 px-4 sm:px-6 transition-colors">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-semibold uppercase tracking-wider bg-moya-red/10 text-moya-red border border-moya-red/20 mb-2">
            <Package className="w-3.5 h-3.5" />
            <span>{t("badge")}</span>
          </div>
          <h1 className="font-display font-black text-3xl sm:text-4xl text-zinc-900 dark:text-white tracking-tight">
            {t("title")}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 max-w-md mx-auto leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        {/* Lookup Card */}
        <div className="p-6 rounded-3xl bg-white dark:bg-[#0c0c14] border border-black/[0.06] dark:border-white/[0.08] shadow-xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSearchSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="orderNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("orderNumberLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder={t("orderNumberPlaceholder")}
                          className="uppercase"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("emailLabel")}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t("emailPlaceholder")}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl bg-moya-red hover:bg-rose-500 text-white font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-moya-red/25 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t("searching")}</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>{t("searchBtn")}</span>
                  </>
                )}
              </button>
            </form>
          </Form>
        </div>

        {/* Results Container */}
        {hasSearched && !isLoading && (
          <div>
            {orderResult ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                {/* Status Hero Card */}
                <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0c0c14] border border-black/[0.06] dark:border-white/[0.08] shadow-xl space-y-6">
                  {/* Top Meta */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-black/[0.06] dark:border-white/[0.06]">
                    <div>
                      <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-wider block">
                        {t("dropOrder")}
                      </span>
                      <h2 className="text-xl sm:text-2xl font-display font-black text-zinc-900 dark:text-white mt-0.5">
                        #{orderResult.orderNumber}
                      </h2>
                    </div>

                    <div className="flex items-center gap-3">
                      {orderResult.status === "cancelled" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                          <XCircle className="w-4 h-4" /> {t("statusCancelled")}
                        </span>
                      ) : orderResult.status === "delivered" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                          <ShieldCheck className="w-4 h-4" /> {t("statusDelivered")}
                        </span>
                      ) : orderResult.status === "dispatched" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                          <Truck className="w-4 h-4" /> {t("statusDispatched")}
                        </span>
                      ) : orderResult.status === "pending" || orderResult.status === "whatsapp_initiated" ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          <Clock className="w-4 h-4" /> {t("statusPlaced")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-4 h-4" /> {t("statusPaid")}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Fulfillment Timeline Steps */}
                  {orderResult.status !== "cancelled" && (
                    <div className="py-2">
                      <div className="grid grid-cols-4 relative gap-2 text-center">
                        {/* Connecting Line */}
                        <div className="absolute top-4 left-6 right-6 h-0.5 bg-black/[0.06] dark:bg-white/[0.08] -z-0" />
                        <div
                          className="absolute top-4 left-6 h-0.5 bg-moya-red transition-all duration-500 -z-0"
                          style={{
                            width: `${Math.max(0, Math.min(100, ((currentStep - 1) / 3) * 100))}%`,
                          }}
                        />

                        {/* Step 1: Placed */}
                        <div className="flex flex-col items-center gap-2 relative z-10">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-colors ${
                              currentStep >= 1
                                ? "bg-moya-red text-white shadow-md shadow-moya-red/30"
                                : "bg-black/10 dark:bg-white/10 text-zinc-500"
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] sm:text-xs font-medium text-zinc-900 dark:text-white">
                            {t("statusPlaced")}
                          </span>
                        </div>

                        {/* Step 2: Paid & Verified */}
                        <div className="flex flex-col items-center gap-2 relative z-10">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-colors ${
                              currentStep >= 2
                                ? "bg-moya-red text-white shadow-md shadow-moya-red/30"
                                : "bg-black/10 dark:bg-white/10 text-zinc-500"
                            }`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] sm:text-xs font-medium text-zinc-900 dark:text-white">
                            {t("statusPaid")}
                          </span>
                        </div>

                        {/* Step 3: Dispatched */}
                        <div className="flex flex-col items-center gap-2 relative z-10">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-colors ${
                              currentStep >= 3
                                ? "bg-moya-red text-white shadow-md shadow-moya-red/30"
                                : "bg-black/10 dark:bg-white/10 text-zinc-500"
                            }`}
                          >
                            <Truck className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] sm:text-xs font-medium text-zinc-900 dark:text-white">
                            {t("statusDispatched")}
                          </span>
                        </div>

                        {/* Step 4: Delivered */}
                        <div className="flex flex-col items-center gap-2 relative z-10">
                          <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono font-bold transition-colors ${
                              currentStep >= 4
                                ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30"
                                : "bg-black/10 dark:bg-white/10 text-zinc-500"
                            }`}
                          >
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                          <span className="text-[10px] sm:text-xs font-medium text-zinc-900 dark:text-white">
                            {t("statusDelivered")}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Courier & Tracking Card (If dispatched or delivered) */}
                  {orderResult.trackingNumber && (
                    <div className="p-4 rounded-2xl bg-blue-500/[0.06] dark:bg-blue-500/[0.08] border border-blue-500/20 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-blue-600 dark:text-blue-400 font-semibold">
                            {t("carrier")}: {orderResult.carrier || t("defaultCarrier")}
                          </span>
                          <p className="text-sm font-mono font-bold text-zinc-900 dark:text-white">
                            {t("trackingCode")}: {orderResult.trackingNumber}
                          </p>
                        </div>

                        <a
                          href={getCarrierTrackingUrl(orderResult.carrier, orderResult.trackingNumber) || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/20 transition-all self-start sm:self-auto"
                        >
                          <span>{t("openCarrier", { carrier: orderResult.carrier ? orderResult.carrier.split(" ")[0] : t("courierFallback") })}</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Items Ordered Breakdown */}
                  <div className="space-y-3 pt-2">
                    <h3 className="text-xs font-mono font-semibold uppercase tracking-wider text-zinc-500">
                      {t("itemsTitle")} ({orderResult.items.length})
                    </h3>
                    <div className="space-y-2">
                      {orderResult.items.map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-black/[0.02] dark:bg-white/[0.02] border border-black/[0.04] dark:border-white/[0.06] flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-black/5 dark:bg-white/5 relative overflow-hidden shrink-0">
                              <Image
                                src={item.image}
                                alt={item.name}
                                fill
                                sizes="48px"
                                className="object-contain p-1"
                              />
                            </div>
                            <div>
                              <span className="text-xs font-bold text-zinc-900 dark:text-white block">
                                {item.name}
                              </span>
                              <span className="text-[11px] font-mono text-zinc-500">
                                {t("quantity")}: {item.quantity}
                                {isOwnerOrAdmin && item.price > 0 && ` • $${item.price}.00 ${orderResult.currency}`}
                              </span>
                            </div>
                          </div>

                          {isOwnerOrAdmin && item.price > 0 && (
                            <span className="font-mono font-bold text-xs text-zinc-900 dark:text-white">
                              ${item.price * item.quantity}.00
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Destination & Summary Footer */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-black/[0.06] dark:border-white/[0.06] text-xs">
                    {orderResult.shippingAddress && (
                      <div className="space-y-1.5 text-zinc-600 dark:text-zinc-400">
                        <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-500 block">
                          {isOwnerOrAdmin ? t("destinationTitle") : t("destinationCityOnly")}
                        </span>
                        {isOwnerOrAdmin ? (
                          <>
                            {orderResult.customerName && (
                              <p className="font-bold text-zinc-900 dark:text-white">
                                {orderResult.customerName}
                              </p>
                            )}
                            {orderResult.shippingAddress.line1 && orderResult.shippingAddress.line1 !== "***" && (
                              <p>{orderResult.shippingAddress.line1}</p>
                            )}
                            {orderResult.shippingAddress.line2 && <p>{orderResult.shippingAddress.line2}</p>}
                            <p>
                              {orderResult.shippingAddress.city}, {orderResult.shippingAddress.state}{" "}
                              {orderResult.shippingAddress.postalCode && orderResult.shippingAddress.postalCode !== "***"
                                ? orderResult.shippingAddress.postalCode
                                : ""}
                            </p>
                            <p className="uppercase font-mono text-[10px]">{orderResult.shippingAddress.country}</p>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 pt-0.5">
                            <MapPin className="w-4 h-4 text-moya-red shrink-0" />
                            <p className="font-semibold text-zinc-900 dark:text-white">
                              {[
                                orderResult.shippingAddress.city,
                                orderResult.shippingAddress.state,
                                orderResult.shippingAddress.country,
                              ]
                                .filter(Boolean)
                                .join(", ")}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {isOwnerOrAdmin ? (
                      <div className="space-y-1.5 sm:text-right">
                        <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-zinc-500 block">
                          {t("orderSummaryTitle")}
                        </span>
                        {orderResult.subtotal !== undefined && (
                          <p className="text-zinc-500">
                            {t("subtotal")}: <span className="font-mono">${Number(orderResult.subtotal).toFixed(2)}</span>
                          </p>
                        )}
                        <p className="text-zinc-500">
                          {t("shipping")}:{" "}
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            {orderResult.shippingFee ? `$${Number(orderResult.shippingFee).toFixed(2)}` : t("freeShipping")}
                          </span>
                        </p>
                        {orderResult.tax !== undefined && orderResult.tax > 0 && (
                          <p className="text-zinc-500">
                            {t("tax")}{orderResult.taxDetails?.jurisdiction ? ` (${orderResult.taxDetails.jurisdiction})` : ""}:{" "}
                            <span className="font-mono text-zinc-900 dark:text-white">
                              ${orderResult.tax.toFixed(2)}
                            </span>
                          </p>
                        )}
                        {orderResult.total !== undefined && (
                          <p className="text-base font-mono font-bold text-zinc-900 dark:text-white pt-1 border-t border-black/[0.04] dark:border-white/[0.06]">
                            {t("total")}: ${Number(orderResult.total).toFixed(2)} {orderResult.currency}
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-white/[0.02] border border-zinc-200/60 dark:border-white/[0.06] flex flex-col justify-between gap-2.5">
                        <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                          <Lock className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="text-[11px] leading-tight">
                            {t("privacyNotice")}
                          </span>
                        </div>
                        {!isSignedIn && (
                          <SafeSignInButton mode="modal">
                            <button
                              type="button"
                              className="inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-[11px] font-semibold hover:opacity-90 transition-opacity self-start sm:self-auto cursor-pointer"
                            >
                              <span>{t("signInToView")}</span>
                            </button>
                          </SafeSignInButton>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* WhatsApp Concierge Banner: only visible to verified owner or admin */}
                {isOwnerOrAdmin && (
                  <div className="p-4 rounded-2xl bg-emerald-500/[0.08] border border-emerald-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-3 text-emerald-700 dark:text-emerald-300">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <MessageCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span>{t("conciergeBanner")}</span>
                    </div>

                    <button
                      onClick={() => handleOpenWhatsAppConcierge(orderResult.orderNumber)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors shrink-0 shadow-md shadow-emerald-600/20 cursor-pointer"
                    >
                      {t("chatWhatsApp")}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Order Not Found */
              <div className="p-8 sm:p-12 rounded-3xl bg-white dark:bg-[#0c0c14] border border-black/[0.06] dark:border-white/[0.08] shadow-xl text-center space-y-4 animate-in fade-in">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="font-display font-bold text-lg text-zinc-900 dark:text-white">
                  {t("notFoundTitle")}
                </h3>
                <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                  {t("notFoundDesc")}
                </p>
                <button
                  onClick={() => handleOpenWhatsAppConcierge(form.getValues("orderNumber") || t("supportFallback"))}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-display font-bold text-xs uppercase tracking-wider transition-colors shadow-lg shadow-emerald-600/20 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{t("chatWhatsApp")}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
