/**
 * Calls `onRestore` when the browser restores this page from its back-forward cache, for
 * example the Back button on Stripe Checkout. A restored page keeps its JS state as it was
 * when the shopper left, so a checkout button would otherwise stay on "Processing".
 * Returns the unsubscribe function.
 */
export function onPageRestore(target: Pick<EventTarget, "addEventListener" | "removeEventListener">, onRestore: () => void) {
  const handler = (event: Event) => {
    if ((event as PageTransitionEvent).persisted) onRestore();
  };
  target.addEventListener("pageshow", handler);
  return () => target.removeEventListener("pageshow", handler);
}
