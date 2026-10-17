import { useSyncExternalStore } from "react";
import { whenIdle } from "@/lib/deferred";

/**
 * One app-wide "the first page has loaded and gone idle" flag (ADR 0020). Below-the-fold
 * images wait for it so they do not share bandwidth with the LCP image on a cold visit.
 * It stays true afterwards, so pages reached by client navigation render images at once.
 */
let settled = false;
let started = false;
const listeners = new Set<() => void>();

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  whenIdle(
    () => {
      settled = true;
      for (const listener of listeners) listener();
    },
    { timeout: 3000 }
  );
}

function subscribe(listener: () => void) {
  start();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePageSettled(): boolean {
  // Server and hydration render "not settled" so the HTML matches
  return useSyncExternalStore(subscribe, () => settled, () => false);
}
