"use client";

import { useCallback } from "react";
import { useAction } from "convex/react";
import { useLocale } from "next-intl";
import { api } from "../../convex/_generated/api";
import { useStore } from "@/store/useStore";
import { useSafeUser } from "@/lib/useSafeUser";
import { cartCheckoutLines } from "@/lib/openCheckout";

/**
 * Card checkout with a Checkout Hold (ADR 0024). `startCheckout` passes the cart's previous
 * open session so the server expires it before holding the new one, and remembers the new
 * Order. `abandonOpenCheckout` (Stripe's back link) expires the open session right away.
 */
export function useCardCheckout() {
  const locale = useLocale();
  const { user } = useSafeUser();
  const createCheckoutSession = useAction(api.payments.checkout.createCheckoutSession);
  const abandonCheckoutSession = useAction(api.payments.checkout.abandonCheckoutSession);
  const cart = useStore((s) => s.cart);
  const currency = useStore((s) => s.currency);
  const openCheckout = useStore((s) => s.openCheckout);
  const setOpenCheckout = useStore((s) => s.setOpenCheckout);

  const startCheckout = useCallback(async () => {
    const result = await createCheckoutSession({
      items: cartCheckoutLines(cart),
      currency,
      locale,
      origin: window.location.origin,
      clerkUserId: user?.id,
      customerEmail: user?.primaryEmailAddress?.emailAddress,
      ...(openCheckout ? { previousSessionId: openCheckout.sessionId } : {}),
    });
    setOpenCheckout({ orderNumber: result.orderNumber, sessionId: result.sessionId });
    return result;
  }, [cart, currency, locale, user, openCheckout, createCheckoutSession, setOpenCheckout]);

  const abandonOpenCheckout = useCallback(async () => {
    if (!openCheckout) return;
    setOpenCheckout(null);
    try {
      await abandonCheckoutSession({ sessionId: openCheckout.sessionId });
    } catch (err) {
      // The webhook and the hourly backstop still release the hold.
      console.warn("Could not expire the abandoned checkout session:", err);
    }
  }, [openCheckout, abandonCheckoutSession, setOpenCheckout]);

  return { startCheckout, abandonOpenCheckout };
}
