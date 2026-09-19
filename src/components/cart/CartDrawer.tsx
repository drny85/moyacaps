"use client";

import { useStore } from "@/store/useStore";
import { useTranslations, useLocale } from "next-intl";
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, MessageCircle, ShieldCheck, Check, AlertCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import confetti from "canvas-confetti";
import { useSafeUser, SafeSignInButton } from "@/lib/useSafeUser";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export function CartDrawer() {
  const { cart, isCartOpen, closeCart, updateQuantity, removeFromCart, clearCart, currency, clampCartToStock } = useStore();
  const t = useTranslations("cart");
  const locale = useLocale();
  const { user, isSignedIn } = useSafeUser();
  const createCheckoutSession = useAction(api.stripe.createCheckoutSession);
  const convexVariants = useQuery(api.products.getVariants, {
    includeUnavailable: true,
  });

  const [checkoutStep, setCheckoutStep] = useState<"idle" | "processing" | "success">("idle");
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [stockAdjustmentNotice, setStockAdjustmentNotice] = useState<string | null>(null);

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

  // Free shipping threshold: 2+ caps
  const freeShippingUnlocked = totalItems >= 2;
  const shippingFee = freeShippingUnlocked ? 0 : 8;
  const total = subtotal + shippingFee;

  // Launch WhatsApp order with itemized list
  const handleWhatsAppOrder = () => {
    if (hasOutOfStockItem || checkoutStep === "processing") return;

    let message = `${t("whatsappGreeting")}\n\n`;

    cart.forEach((item, index) => {
      message += `${index + 1}. ${item.name} (${item.quantity}x) - $${item.priceUsd} USD c/u\n`;
    });

    message += `\nSubtotal: $${subtotal}.00 USD\n`;
    message += `Envío/Shipping: ${freeShippingUnlocked ? "GRATIS / FREE" : "$8.00 USD"}\n`;
    message += `Total a pagar: $${total}.00 USD\n\n`;
    message += `Por favor confirmen disponibilidad para coordinar envío y pago. ¡Gracias!`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/5215500000000?text=${encoded}`, "_blank");
  };

  const handleStripeCheckout = async () => {
    if (hasOutOfStockItem || checkoutStep === "processing") return;

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
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-[#08080e] border-l border-black/[0.08] dark:border-white/[0.06] flex flex-col shadow-2xl transition-colors duration-300"
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-black/[0.06] dark:border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-moya-red" />
                <h2 className="font-display font-bold text-lg text-zinc-900 dark:text-white">{t("title")}</h2>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-zinc-700 dark:text-zinc-300">
                  {totalItems}
                </span>
              </div>
              <button
                onClick={closeCart}
                className="p-2 rounded-full glass-dark text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Free Shipping Progress Indicator */}
            <div className="px-6 py-3 bg-moya-red/10 dark:bg-moya-red-deep/20 border-b border-moya-red/20 text-xs">
              {freeShippingUnlocked ? (
                <p className="text-emerald-600 dark:text-moya-green-light font-display font-bold text-center">
                  {t("freeShippingAchieved")}
                </p>
              ) : (
                <p className="text-zinc-700 dark:text-zinc-300 text-center">
                  {t("freeShippingRemaining", {
                    amount: currency === "USD" ? `$${Math.max(0, 240 - subtotal)} USD (1 more cap)` : "1 gorra más",
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
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                            ${item.priceUsd}.00 USD
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
                      ${subtotal}.00 USD
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-600 dark:text-zinc-400">
                    <span>{t("shipping")}</span>
                    <span className="font-mono text-emerald-600 dark:text-moya-green-light font-bold">
                      {shippingFee === 0 ? t("shippingFree") : `$${shippingFee}.00 USD`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-display font-bold pt-2 border-t border-black/[0.06] dark:border-white/[0.06] text-zinc-900 dark:text-white">
                    <span>{t("total")}</span>
                    <span className="font-mono text-emerald-600 dark:text-moya-green-light text-base">
                      ${total}.00 USD
                    </span>
                  </div>
                </div>

                {checkoutStep === "success" ? (
                  <div className="p-4 rounded-xl bg-moya-green-deep/30 border border-moya-green/40 text-center">
                    <Check className="w-8 h-8 text-moya-green-light mx-auto mb-2 animate-bounce" />
                    <p className="font-display font-bold text-sm text-white">Order Confirmed!</p>
                    <p className="text-xs text-zinc-300 mt-1">
                      Your 0880 Good Luck drop is reserved. Tracking sent to email.
                    </p>
                  </div>
                ) : (
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
                            disabled={hasOutOfStockItem}
                            className={`w-full py-3.5 rounded-2xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl ${
                              hasOutOfStockItem
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
                        disabled={checkoutStep === "processing" || hasOutOfStockItem}
                        className={`w-full py-3.5 rounded-2xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl ${
                          hasOutOfStockItem
                            ? "bg-zinc-300 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                            : "bg-moya-red hover:bg-rose-500 text-white shadow-moya-red-deep/50"
                        }`}
                      >
                        {checkoutStep === "processing" ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                            <span>Connecting to Gateway...</span>
                          </>
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
                      disabled={checkoutStep === "processing" || hasOutOfStockItem}
                      className={`w-full py-3 rounded-2xl font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg ${
                        hasOutOfStockItem
                          ? "bg-zinc-300 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                          : "bg-moya-green-deep/80 hover:bg-moya-green text-white shadow-moya-green-deep/40"
                      }`}
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{t("checkoutWhatsApp")}</span>
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-center gap-2 text-[10px] text-zinc-500 text-center">
                  <ShieldCheck className="w-3.5 h-3.5 text-moya-green" />
                  <span>{t("secureCheckout")}</span>
                </div>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
