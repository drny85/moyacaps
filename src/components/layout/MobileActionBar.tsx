"use client";

import { useStore } from "@/store/useStore";
import { useTranslations } from "next-intl";
import { ShoppingBag, Compass, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

export function MobileActionBar() {
  const { cart, toggleCart, currency } = useStore();
  const t = useTranslations("nav");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const totalItems = isMounted ? cart.reduce((sum, item) => sum + item.quantity, 0) : 0;
  const subtotal = isMounted
    ? cart.reduce((sum, item) => {
        const price = currency === "USD" ? item.priceUsd : item.priceMxn;
        return sum + price * item.quantity;
      }, 0)
    : 0;

  const handleWhatsApp = () => {
    const text = encodeURIComponent("¡Hola Moya Caps! Quisiera consultar sobre las gorras de la colección Good Luck 0880.");
    window.open(`https://wa.me/5215500000000?text=${text}`, "_blank");
  };

  return (
    <div className="md:hidden fixed bottom-0 inset-x-0 z-40 p-3 pointer-events-none">
      <div className="max-w-md mx-auto glass-dark bg-white/90 dark:bg-[#0a0a10]/90 border border-black/[0.08] dark:border-white/[0.08] rounded-2xl p-1.5 sm:p-2 flex items-center justify-between shadow-2xl shadow-black/10 dark:shadow-black/80 pointer-events-auto">
        {/* Catalog shortcut */}
        <a
          href="#catalog"
          className="flex-1 py-1.5 px-2 rounded-xl flex flex-col items-center justify-center text-zinc-600 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors active:scale-95"
        >
          <Compass className="w-5 h-5 text-moya-red" />
          <span className="text-[9px] font-display font-semibold mt-0.5 tracking-tight">
            {t("catalog")}
          </span>
        </a>

        {/* WhatsApp */}
        <button
          onClick={handleWhatsApp}
          className="flex-1 py-1.5 px-2 rounded-xl flex flex-col items-center justify-center text-zinc-600 dark:text-zinc-500 hover:text-moya-green transition-colors active:scale-95"
          title="WhatsApp Concierge"
        >
          <MessageCircle className="w-5 h-5 text-moya-green" />
          <span className="text-[9px] font-display font-semibold mt-0.5 tracking-tight">
            WhatsApp
          </span>
        </button>

        {/* Theme Switcher */}
        <div className="px-1 flex items-center justify-center">
          <ThemeToggle compact={true} />
        </div>

        {/* Cart Button */}
        <button
          onClick={toggleCart}
          className="py-2 px-3.5 sm:px-4 rounded-xl bg-moya-red hover:bg-rose-500 active:bg-moya-red-deep text-white font-display font-bold text-xs flex items-center gap-2 shadow-lg shadow-moya-red-deep/40 transition-transform active:scale-95 shrink-0"
        >
          <div className="relative">
            <ShoppingBag className="w-4 h-4" />
            {totalItems > 0 && (
              <motion.span
                key={totalItems}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-2 -right-2.5 w-4 h-4 rounded-full bg-moya-green text-black text-[9px] font-display font-black flex items-center justify-center shadow"
              >
                {totalItems}
              </motion.span>
            )}
          </div>
          <span className="font-mono text-[10px]">
            {totalItems > 0
              ? currency === "USD"
                ? `$${subtotal}`
                : `$${subtotal}`
              : t("cart")}
          </span>
        </button>
      </div>
    </div>
  );
}
