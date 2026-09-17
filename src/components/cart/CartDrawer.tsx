"use client";

import { useStore } from "@/store/useStore";
import { useTranslations, useLocale } from "next-intl";
import { X, Trash2, Plus, Minus, ShoppingBag, ArrowRight, MessageCircle, ShieldCheck, Check } from "lucide-react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import confetti from "canvas-confetti";

export function CartDrawer() {
  const { cart, isCartOpen, closeCart, updateQuantity, removeFromCart, clearCart, currency } = useStore();
  const t = useTranslations("cart");
  const locale = useLocale();

  const [checkoutStep, setCheckoutStep] = useState<"idle" | "processing" | "success">("idle");

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const subtotal = cart.reduce((sum, item) => {
    const price = currency === "USD" ? item.priceUsd : item.priceMxn;
    return sum + price * item.quantity;
  }, 0);

  // Free shipping threshold: 2+ caps
  const freeShippingUnlocked = totalItems >= 2;
  const shippingFee = freeShippingUnlocked ? 0 : currency === "USD" ? 8 : 150;
  const total = subtotal + shippingFee;

  // Launch WhatsApp order with itemized list
  const handleWhatsAppOrder = () => {
    let message = `${t("whatsappGreeting")}\n\n`;

    cart.forEach((item, index) => {
      const price = currency === "USD" ? `$${item.priceUsd}` : `$${item.priceMxn} MXN`;
      message += `${index + 1}. ${item.name} (${item.quantity}x) - ${price} c/u\n`;
    });

    const formattedSubtotal = currency === "USD" ? `$${subtotal} USD` : `$${subtotal} MXN`;
    const formattedTotal = currency === "USD" ? `$${total} USD` : `$${total} MXN`;

    message += `\nSubtotal: ${formattedSubtotal}\n`;
    message += `Envío/Shipping: ${freeShippingUnlocked ? "GRATIS / FREE" : (currency === "USD" ? "$8 USD" : "$150 MXN")}\n`;
    message += `Total a pagar: ${formattedTotal}\n\n`;
    message += `Por favor confirmen disponibilidad para coordinar envío y pago. ¡Gracias!`;

    const encoded = encodeURIComponent(message);
    window.open(`https://wa.me/5215500000000?text=${encoded}`, "_blank");
  };

  const handleStripeCheckout = () => {
    setCheckoutStep("processing");
    setTimeout(() => {
      setCheckoutStep("success");
      confetti({
        particleCount: 80,
        spread: 100,
        origin: { y: 0.5 },
      });
      setTimeout(() => {
        clearCart();
        setCheckoutStep("idle");
        closeCart();
      }, 3500);
    }, 1200);
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
            className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-[#08080e] border-l border-white/[0.06] flex flex-col shadow-2xl"
          >
            {/* Drawer Header */}
            <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-moya-red" />
                <h2 className="font-display font-bold text-lg text-white">{t("title")}</h2>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-300">
                  {totalItems}
                </span>
              </div>
              <button
                onClick={closeCart}
                className="p-2 rounded-full glass-dark text-zinc-500 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Free Shipping Progress Indicator */}
            <div className="px-6 py-3 bg-moya-red-deep/20 border-b border-moya-red/20 text-xs">
              {freeShippingUnlocked ? (
                <p className="text-moya-green-light font-display font-bold text-center">
                  {t("freeShippingAchieved")}
                </p>
              ) : (
                <p className="text-zinc-300 text-center">
                  {t("freeShippingRemaining", {
                    amount: currency === "USD" ? `$${45 - subtotal > 0 ? 45 - subtotal : 45} USD` : "1 más",
                  })}
                </p>
              )}
              <div className="w-full bg-black/50 h-1.5 rounded-full mt-2 overflow-hidden">
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
                    <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/[0.06] flex items-center justify-center mb-4 text-zinc-500">
                    <ShoppingBag className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-display font-bold text-white mb-1">
                    {t("emptyTitle")}
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-xs mb-6">
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
                  const itemPrice = currency === "USD" ? item.priceUsd : item.priceMxn;
                  return (
                    <div
                      key={item.id}
                      className="glass-card rounded-2xl p-3.5 flex items-center gap-4 border border-white/[0.06]"
                    >
                      <div className="relative w-16 h-16 rounded-xl bg-white/5 shrink-0 overflow-hidden p-1">
                        <Image
                          src={item.image}
                          alt={item.name}
                          fill
                          className="object-contain"
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-display font-bold text-sm text-white truncate">
                          {item.name}
                        </h4>
                        <div className="text-xs font-mono font-bold text-moya-green-light mt-0.5">
                          {currency === "USD" ? `$${itemPrice}` : `$${itemPrice} MXN`}
                        </div>

                        {/* Quantity adjust */}
                        <div className="flex items-center gap-3 mt-2">
                          <div className="flex items-center glass-dark rounded-lg border border-white/[0.06]">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="px-2 py-1 text-zinc-400 hover:text-white"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2 text-xs font-mono font-bold text-white">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="px-2 py-1 text-zinc-400 hover:text-white"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1.5 text-zinc-500 hover:text-moya-red transition-colors"
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
              <div className="p-6 border-t border-white/[0.06] bg-[#07070c] space-y-4">
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-zinc-400">
                    <span>{t("subtotal")}</span>
                    <span className="font-mono text-white">
                      {currency === "USD" ? `$${subtotal}.00 USD` : `$${subtotal}.00 MXN`}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>{t("shipping")}</span>
                    <span className="font-mono text-moya-green-light font-bold">
                      {shippingFee === 0 ? t("shippingFree") : currency === "USD" ? `$${shippingFee}.00 USD` : `$${shippingFee}.00 MXN`}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm font-display font-bold pt-2 border-t border-white/[0.06] text-white">
                    <span>{t("total")}</span>
                    <span className="font-mono text-moya-green-light text-base">
                      {currency === "USD" ? `$${total}.00 USD` : `$${total}.00 MXN`}
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
                    {/* Stripe Card Checkout */}
                    <button
                      onClick={handleStripeCheckout}
                      disabled={checkoutStep === "processing"}
                      className="w-full py-3.5 rounded-2xl bg-moya-red hover:bg-rose-500 text-white font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xl shadow-moya-red-deep/50"
                    >
                      {checkoutStep === "processing" ? (
                        <span>Connecting to Gateway...</span>
                      ) : (
                        <>
                          <span>{t("checkoutStripe")}</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>

                    {/* WhatsApp Direct Order Button */}
                    <button
                      onClick={handleWhatsAppOrder}
                      className="w-full py-3 rounded-2xl bg-moya-green-deep/80 hover:bg-moya-green text-white font-display font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-moya-green-deep/40"
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
