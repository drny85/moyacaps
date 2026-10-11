"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/store/useStore";
import type { CapVariant } from "@/data/caps";

/**
 * Cart, stock and drop state for a single cap — the branching that decides
 * which CTA (add, add another, max reached, sold out, VIP alert) to show.
 */
export function useCapPurchaseState(cap: CapVariant) {
  const cart = useStore((s) => s.cart);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const stock = typeof cap.stock === "number" ? cap.stock : 0;
  const inCartQty = isMounted ? cart.find((i) => i.id === cap.id)?.quantity || 0 : 0;

  const isDropUpcoming = Boolean(
    cap.isDrop &&
      cap.dropStatus !== "live" &&
      ((typeof cap.dropDate === "number" && Date.now() < cap.dropDate) || cap.dropStatus === "scheduled")
  );

  return {
    stock,
    inCartQty,
    isInCart: inCartQty > 0,
    isOutOfStock: stock <= 0,
    isMaxInCart: inCartQty >= stock,
    isDropUpcoming,
  };
}
