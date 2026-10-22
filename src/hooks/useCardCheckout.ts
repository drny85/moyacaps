"use client";

import { useCallback } from "react";
import { useAction } from "convex/react";
import { useLocale } from "next-intl";
import { api } from "../../convex/_generated/api";
import { useStore } from "@/store/useStore";
import { useSafeUser } from "@/lib/useSafeUser";
import { cartCheckoutLines } from "@/lib/openCheckout";
import { getCheckoutPass } from "@/app/actions/checkoutPass";

/**
 * Card checkout with a Checkout Hold (ADR 0024). `startCheckout` passes the cart's previous
 * open session so the server expires it before holding the new one, and remembers the new
 * Order. `abandonOpenCheckout` (Stripe's back link) expires the open session right away.
 *
 * Both read the store when called, not from render: the first render after SSR hydration
 * sees the store's initial state (no cart, no open checkout), and a mount effect calling
 * these would otherwise act on that empty snapshot.
 */
export function useCardCheckout() {
  const locale = useLocale();
  const { user } = useSafeUser();
  const createCheckoutSession = useAction(api.payments.checkout.createCheckoutSession);
  const abandonCheckoutSession = useAction(api.payments.checkout.abandonCheckoutSession);

  const startCheckout = useCallback(async () => {
    const { cart, currency, openCheckout, setOpenCheckout } = useStore.getState();
    // Guests get a per-IP rate limit through a Checkout Pass (ADR 0029); without one the
    // server uses the shared guest bucket, so a failed fetch never blocks checkout.
    const checkoutPass = user ? null : await getCheckoutPass().catch(() => null);
    const result = await createCheckoutSession({
      items: cartCheckoutLines(cart),
      currency,
      locale,
      origin: window.location.origin,
      customerEmail: user?.primaryEmailAddress?.emailAddress,
      ...(openCheckout ? { previousSessionId: openCheckout.sessionId } : {}),
      ...(checkoutPass ? { checkoutPass } : {}),
    });
    setOpenCheckout({ orderNumber: result.orderNumber, sessionId: result.sessionId });
    return result;
  }, [locale, user, createCheckoutSession]);

  const abandonOpenCheckout = useCallback(async () => {
    const { openCheckout, setOpenCheckout } = useStore.getState();
    if (!openCheckout) return;
    setOpenCheckout(null);
    try {
      await abandonCheckoutSession({ sessionId: openCheckout.sessionId });
    } catch (err) {
      // The webhook and the backstop still release the hold.
      console.warn("Could not expire the abandoned checkout session:", err);
    }
  }, [abandonCheckoutSession]);

  return { startCheckout, abandonOpenCheckout };
}
