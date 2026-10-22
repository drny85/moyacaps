"use client";

import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useCardCheckout } from "@/hooks/useCardCheckout";
import { checkoutToReleaseOnLoad } from "@/lib/openCheckout";
import { onPageRestore } from "@/lib/pageRestore";

/**
 * Releases the cart's open checkout whenever the shopper comes back to the store without
 * paying (ADR 0024): a fresh page load (Back from Stripe that reloads, a reload, a new tab) or a
 * restore from the back-forward cache. Never on the success page, which clears it instead.
 */
export function useReleaseOpenCheckout() {
  const { abandonOpenCheckout } = useCardCheckout();

  useEffect(() => {
    const release = () => {
      if (checkoutToReleaseOnLoad(useStore.getState().openCheckout, window.location.pathname)) void abandonOpenCheckout();
    };
    release();
    return onPageRestore(window, release);
    // Once per page load; abandonOpenCheckout reads the store when called.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
