"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useStore } from "@/store/useStore";
import { useSafeUser } from "@/lib/useSafeUser";
import { onFirstInteraction } from "@/lib/deferred";

/**
 * App-wide overlays, loaded off the first-load path (ADR 0018). Each one's code is a
 * separate chunk that downloads the first time it is needed and stays mounted after
 * that, so exit animations and in-progress state (checkout form, try-on photo) survive
 * closing. Chunks are warmed on the visitor's first interaction, so opening the cart
 * does not wait on the network.
 */
const loadCartDrawer = () => import("@/components/cart/CartDrawer");
const loadDropAlertModal = () => import("@/components/drops/DropAlertModal");
const loadVirtualTryOnModal = () => import("@/components/tryon/VirtualTryOnModal");
const loadProductShareToast = () => import("@/components/product/ProductShareToast");

const CartDrawer = dynamic(() => loadCartDrawer().then((m) => m.CartDrawer), { ssr: false });
const DropAlertModal = dynamic(() => loadDropAlertModal().then((m) => m.DropAlertModal), { ssr: false });
const VirtualTryOnModal = dynamic(() => loadVirtualTryOnModal().then((m) => m.VirtualTryOnModal), { ssr: false });
const ProductShareToast = dynamic(() => loadProductShareToast().then((m) => m.ProductShareToast), { ssr: false });
const AdminQuickBar = dynamic(() => import("@/components/admin/AdminQuickBar").then((m) => m.AdminQuickBar), {
  ssr: false,
});

/** True from the first render where `value` is true, forever after */
function useLatch(value: boolean): boolean {
  const [latched, setLatched] = useState(value);
  if (value && !latched) setLatched(true);
  return latched || value;
}

export function DeferredOverlays() {
  const cartNeeded = useLatch(useStore((s) => s.isCartOpen));
  const dropAlertNeeded = useLatch(useStore((s) => s.dropAlertCap !== null));
  const tryOnNeeded = useLatch(useStore((s) => s.isTryOnOpen));
  const shareNeeded = useLatch(useStore((s) => Boolean(s.shareToast?.isOpen)));
  const { isSignedIn } = useSafeUser();

  useEffect(
    () =>
      onFirstInteraction(() => {
        void loadCartDrawer();
        void loadDropAlertModal();
        void loadProductShareToast();
      }),
    []
  );

  return (
    <>
      {cartNeeded && <CartDrawer />}
      {dropAlertNeeded && <DropAlertModal />}
      {tryOnNeeded && <VirtualTryOnModal />}
      {shareNeeded && <ProductShareToast />}
      {isSignedIn && <AdminQuickBar />}
    </>
  );
}
