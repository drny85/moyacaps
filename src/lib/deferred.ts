/**
 * Run `callback` once the page has loaded and the main thread is idle (or after
 * `timeout` ms of waiting for idle). Returns a cancel function. Used to keep
 * non-critical work (Clerk for returning visitors, overlay widgets) out of the
 * first-load window that LCP and TBT measure.
 */
export function whenIdle(callback: () => void, { timeout = 2000 }: { timeout?: number } = {}): () => void {
  let cancelled = false;
  let idleId: number | null = null;
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const schedule = () => {
    if (cancelled) return;
    const run = () => {
      if (!cancelled) callback();
    };
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(run, { timeout });
    } else {
      timerId = setTimeout(run, 1);
    }
  };

  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });

  return () => {
    cancelled = true;
    window.removeEventListener("load", schedule);
    if (idleId !== null) window.cancelIdleCallback?.(idleId);
    if (timerId !== null) clearTimeout(timerId);
  };
}

const INTERACTION_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll", "wheel"] as const;

/**
 * Run `callback` on the visitor's first interaction (tap, key, scroll). Returns a cancel
 * function. Lab tools never interact, so work started here stays out of their numbers,
 * while a real visitor has the code warm before they open a drawer or modal.
 */
export function onFirstInteraction(callback: () => void): () => void {
  let done = false;
  const fire = () => {
    if (done) return;
    done = true;
    cancel();
    callback();
  };
  const cancel = () => {
    for (const event of INTERACTION_EVENTS) window.removeEventListener(event, fire);
  };
  for (const event of INTERACTION_EVENTS) window.addEventListener(event, fire, { passive: true, once: true });
  return () => {
    done = true;
    cancel();
  };
}
