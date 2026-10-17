"use client";

import { useEffect } from "react";

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Native scrolling for visitors who ask for reduced motion, and on touch screens,
    // where Lenis leaves touch scrolling native anyway. Lenis loads as its own chunk
    // so it stays off the first-load path (ADR 0018).
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !window.matchMedia("(pointer: fine)").matches
    ) {
      settleHashScroll();
      return;
    }

    let cancelled = false;
    let frame = 0;
    let lenis: import("lenis").default | null = null;

    import("lenis").then(({ default: Lenis }) => {
      if (cancelled) return;
      const instance = new Lenis({
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        orientation: "vertical",
        gestureOrientation: "vertical",
        smoothWheel: true,
      });
      lenis = instance;
      (window as any).__lenis = instance;
      settleHashScroll(instance);

      function raf(time: number) {
        instance.raf(time);
        frame = requestAnimationFrame(raf);
      }
      frame = requestAnimationFrame(raf);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      if (lenis) {
        if ((window as any).__lenis === lenis) {
          delete (window as any).__lenis;
        }
        lenis.destroy();
      }
    };
  }, []);

  return <>{children}</>;
}

/**
 * A page opened at `#anchor` (e.g. /en#story from the navbar) is scrolled by the browser
 * before scroll-pinned scenes size themselves on mount, which pushes the anchor further
 * down. Once layout has settled, scroll to the anchor again.
 */
function settleHashScroll(lenis?: import("lenis").default) {
  if (!window.location.hash) return;
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
      if (!target) return;
      if (lenis) {
        lenis.resize();
        lenis.scrollTo(target, { immediate: true, force: true });
      } else {
        target.scrollIntoView();
      }
    })
  );
}
