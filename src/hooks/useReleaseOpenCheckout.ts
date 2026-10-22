"use client";

import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useCardCheckout } from "@/hooks/useCardCheckout";
import { checkoutToReleaseOnLoad, stripeTabSession } from "@/lib/openCheckout";
import { onPageRestore } from "@/lib/pageRestore";

/**
 * Releases the cart's open checkout when the tab that went to Stripe comes back without paying
 * (ADR 0024): a fresh page load (Back from Stripe that reloads, a reload) or a restore from the
 * back-forward cache. Never in another tab, nor on the success page, which clears it instead.
 */
export function useReleaseOpenCheckout() {
  const { abandonOpenCheckout } = useCardCheckout();

  useEffect(() => {
    const release = () => {
      const open = checkoutToReleaseOnLoad(useStore.getState().openCheckout, window.location.pathname, stripeTabSession(window.sessionStorage));
      if (open) void abandonOpenCheckout();
    };
    release();
    return onPageRestore(window, release);
    // Once per page load; abandonOpenCheckout reads the store when called.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
